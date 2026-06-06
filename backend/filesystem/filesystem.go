// Package filesystem owns all on-disk file operations for Luna's Core layer.
// The UI never touches the filesystem directly — it calls these methods over
// RPC (CLAUDE.md: Go owns file operations).
package filesystem

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"luna/core/rpc"
)

// maxFileSize caps how large a file ReadFile will load into memory, keeping the
// editor responsive and the RPC line bounded.
const maxFileSize = 5 * 1024 * 1024 // 5 MiB

// skip lists directory entries that bloat the tree and are almost never edited.
var skip = map[string]struct{}{
	".git":         {},
	"node_modules": {},
	".DS_Store":    {},
}

// Entry is a single item in a directory listing.
type Entry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

// ReadFileResult is the payload returned by ReadFile.
type ReadFileResult struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Language string `json:"language"`
}

// ListDir returns the immediate children of dir, directories first then files,
// each group sorted case-insensitively by name.
func ListDir(dir string) ([]Entry, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadDir(abs)
	if err != nil {
		return nil, err
	}
	entries := make([]Entry, 0, len(raw))
	for _, de := range raw {
		name := de.Name()
		if _, blocked := skip[name]; blocked {
			continue
		}
		var size int64
		if info, ierr := de.Info(); ierr == nil {
			size = info.Size()
		}
		entries = append(entries, Entry{
			Name:  name,
			Path:  filepath.Join(abs, name),
			IsDir: de.IsDir(),
			Size:  size,
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	return entries, nil
}

// UserHome returns the current user's home directory — the default starting
// point for the in-app folder picker (Luna opens folders without the OS dialog).
func UserHome() (string, error) {
	return os.UserHomeDir()
}

// ReadFile loads a single file's contents along with a detected language id.
func ReadFile(path string) (*ReadFileResult, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, fmt.Errorf("path is a directory: %s", abs)
	}
	if info.Size() > maxFileSize {
		return nil, fmt.Errorf("file too large: %d bytes (max %d)", info.Size(), maxFileSize)
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return nil, err
	}
	return &ReadFileResult{
		Path:     abs,
		Content:  string(data),
		Language: DetectLanguage(abs),
	}, nil
}

// WriteFile saves content to path, overwriting any existing file, and returns
// the absolute path written. It preserves an existing file's permission bits and
// falls back to 0o644 for a new file. The parent directory must already exist —
// creating new files is CreateFile's job; this is the editor's overwrite-save.
func WriteFile(path, content string) (string, error) {
	abs, err := requirePath(path)
	if err != nil {
		return "", err
	}
	mode := os.FileMode(0o644)
	if info, serr := os.Stat(abs); serr == nil {
		if info.IsDir() {
			return "", fmt.Errorf("path is a directory: %s", abs)
		}
		mode = info.Mode().Perm()
	}
	if err := os.WriteFile(abs, []byte(content), mode); err != nil {
		return "", err
	}
	return abs, nil
}

// DetectLanguage maps a file path to a CodeMirror-friendly language id. An
// empty string means "plain text".
func DetectLanguage(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".js", ".jsx", ".mjs", ".cjs":
		return "javascript"
	case ".ts":
		return "typescript"
	case ".tsx":
		return "tsx"
	case ".json":
		return "json"
	case ".md", ".markdown":
		return "markdown"
	case ".go":
		return "go"
	case ".rs":
		return "rust"
	case ".py":
		return "python"
	case ".html", ".htm":
		return "html"
	case ".css":
		return "css"
	case ".sh", ".bash":
		return "shell"
	case ".yml", ".yaml":
		return "yaml"
	case ".toml":
		return "toml"
	default:
		return ""
	}
}

// requirePath normalizes a mutation target: it rejects an empty path and
// resolves it to an absolute path. Mutations never operate on a relative path.
func requirePath(path string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", errors.New("path is required")
	}
	return filepath.Abs(path)
}

// CreateFile creates a new empty file and returns its absolute path. It fails if
// the path already exists, so a stray action can never clobber existing content.
func CreateFile(path string) (string, error) {
	abs, err := requirePath(path)
	if err != nil {
		return "", err
	}
	f, err := os.OpenFile(abs, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		return "", err
	}
	return abs, f.Close()
}

// CreateDir creates a new directory and returns its absolute path. It fails if
// the path already exists.
func CreateDir(path string) (string, error) {
	abs, err := requirePath(path)
	if err != nil {
		return "", err
	}
	if err := os.Mkdir(abs, 0o755); err != nil {
		return "", err
	}
	return abs, nil
}

// Rename moves oldPath to newPath and returns the new absolute path. It refuses
// to overwrite an existing target.
func Rename(oldPath, newPath string) (string, error) {
	oldAbs, err := requirePath(oldPath)
	if err != nil {
		return "", err
	}
	newAbs, err := requirePath(newPath)
	if err != nil {
		return "", err
	}
	if _, err := os.Lstat(newAbs); err == nil {
		return "", fmt.Errorf("target already exists: %s", newAbs)
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	if err := os.Rename(oldAbs, newAbs); err != nil {
		return "", err
	}
	return newAbs, nil
}

// Delete removes a file or directory tree and returns the deleted absolute path.
func Delete(path string) (string, error) {
	abs, err := requirePath(path)
	if err != nil {
		return "", err
	}
	if err := os.RemoveAll(abs); err != nil {
		return "", err
	}
	return abs, nil
}

// Duplicate copies a file or directory tree next to itself under a
// non-colliding "… copy" name and returns the new absolute path.
func Duplicate(path string) (string, error) {
	abs, err := requirePath(path)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	dst := uniqueCopyName(abs, info.IsDir())
	if info.IsDir() {
		if err := copyTree(abs, dst); err != nil {
			return "", err
		}
		return dst, nil
	}
	if err := copyFile(abs, dst, info.Mode()); err != nil {
		return "", err
	}
	return dst, nil
}

// uniqueCopyName returns a sibling path of src that does not yet exist, of the
// form "name copy.ext", then "name copy 2.ext", and so on. The extension is kept
// only for files so directories copy as "name copy".
func uniqueCopyName(src string, isDir bool) string {
	dir := filepath.Dir(src)
	base := filepath.Base(src)
	ext := ""
	stem := base
	if !isDir {
		ext = filepath.Ext(base)
		stem = strings.TrimSuffix(base, ext)
	}
	for i := 1; ; i++ {
		name := stem + " copy" + ext
		if i > 1 {
			name = fmt.Sprintf("%s copy %d%s", stem, i, ext)
		}
		candidate := filepath.Join(dir, name)
		if _, err := os.Lstat(candidate); errors.Is(err, os.ErrNotExist) {
			return candidate
		}
	}
}

// copyFile copies a single regular file, preserving its permission bits.
func copyFile(src, dst string, mode os.FileMode) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, mode.Perm())
}

// copyTree recursively copies the directory tree rooted at src into dst.
func copyTree(src, dst string) error {
	return filepath.WalkDir(src, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, p)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		info, err := d.Info()
		if err != nil {
			return err
		}
		if d.IsDir() {
			return os.MkdirAll(target, info.Mode().Perm())
		}
		return copyFile(p, target, info.Mode())
	})
}

// Register wires filesystem methods onto the dispatcher.
func Register(d *rpc.Dispatcher) {
	d.Register("fs.listDir", func(raw json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		if p.Path == "" {
			return nil, errors.New("path is required")
		}
		return ListDir(p.Path)
	})

	d.Register("fs.readFile", func(raw json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		if p.Path == "" {
			return nil, errors.New("path is required")
		}
		return ReadFile(p.Path)
	})

	d.Register("fs.home", func(json.RawMessage) (any, error) {
		home, err := UserHome()
		if err != nil {
			return nil, err
		}
		return map[string]string{"path": home}, nil
	})

	d.Register("fs.writeFile", func(raw json.RawMessage) (any, error) {
		var p struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		abs, err := WriteFile(p.Path, p.Content)
		if err != nil {
			return nil, err
		}
		return map[string]string{"path": abs}, nil
	})

	d.Register("fs.createFile", func(raw json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		abs, err := CreateFile(p.Path)
		if err != nil {
			return nil, err
		}
		return map[string]string{"path": abs}, nil
	})

	d.Register("fs.createDir", func(raw json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		abs, err := CreateDir(p.Path)
		if err != nil {
			return nil, err
		}
		return map[string]string{"path": abs}, nil
	})

	d.Register("fs.rename", func(raw json.RawMessage) (any, error) {
		var p struct {
			Path    string `json:"path"`
			NewPath string `json:"newPath"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		abs, err := Rename(p.Path, p.NewPath)
		if err != nil {
			return nil, err
		}
		return map[string]string{"path": abs}, nil
	})

	d.Register("fs.delete", func(raw json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		abs, err := Delete(p.Path)
		if err != nil {
			return nil, err
		}
		return map[string]string{"path": abs}, nil
	})

	d.Register("fs.duplicate", func(raw json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		abs, err := Duplicate(p.Path)
		if err != nil {
			return nil, err
		}
		return map[string]string{"path": abs}, nil
	})
}
