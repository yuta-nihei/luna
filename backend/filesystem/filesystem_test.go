package filesystem

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestListDirOrdersAndSkips(t *testing.T) {
	root := t.TempDir()
	must(t, os.Mkdir(filepath.Join(root, "zeta"), 0o755))
	must(t, os.Mkdir(filepath.Join(root, ".git"), 0o755)) // should be skipped
	must(t, os.WriteFile(filepath.Join(root, "alpha.txt"), []byte("a"), 0o644))
	must(t, os.WriteFile(filepath.Join(root, "Beta.txt"), []byte("bb"), 0o644))

	entries, err := ListDir(root)
	if err != nil {
		t.Fatal(err)
	}

	var names []string
	for _, e := range entries {
		names = append(names, e.Name)
		if e.Name == ".git" {
			t.Fatal(".git should be skipped")
		}
	}
	// dir first, then files sorted case-insensitively
	want := []string{"zeta", "alpha.txt", "Beta.txt"}
	if strings.Join(names, ",") != strings.Join(want, ",") {
		t.Fatalf("order = %v, want %v", names, want)
	}
	if !entries[0].IsDir {
		t.Fatal("first entry should be a directory")
	}
}

func TestReadFile(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "main.go")
	must(t, os.WriteFile(path, []byte("package main"), 0o644))

	res, err := ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if res.Content != "package main" {
		t.Fatalf("content = %q", res.Content)
	}
	if res.Language != "go" {
		t.Fatalf("language = %q, want go", res.Language)
	}
}

func TestReadFileRejectsDirAndOversize(t *testing.T) {
	root := t.TempDir()
	if _, err := ReadFile(root); err == nil {
		t.Fatal("expected error reading a directory")
	}

	big := filepath.Join(root, "big.bin")
	must(t, os.WriteFile(big, make([]byte, maxFileSize+1), 0o644))
	if _, err := ReadFile(big); err == nil {
		t.Fatal("expected error for oversize file")
	}
}

func TestDetectLanguage(t *testing.T) {
	cases := map[string]string{
		"a.ts":       "typescript",
		"a.tsx":      "tsx",
		"a.json":     "json",
		"a.md":       "markdown",
		"a.go":       "go",
		"a.unknown":  "",
		"noext":      "",
		"UPPER.JSON": "json",
	}
	for path, want := range cases {
		if got := DetectLanguage(path); got != want {
			t.Errorf("DetectLanguage(%q) = %q, want %q", path, got, want)
		}
	}
}

func TestCreateFile(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "new.txt")

	abs, err := CreateFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(abs); err != nil {
		t.Fatalf("file not created: %v", err)
	}
	// Creating onto an existing path must fail (no clobber).
	if _, err := CreateFile(path); err == nil {
		t.Fatal("expected error creating an existing file")
	}
	if _, err := CreateFile("  "); err == nil {
		t.Fatal("expected error for empty path")
	}
}

func TestCreateDir(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "sub")

	if _, err := CreateDir(dir); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		t.Fatalf("dir not created: %v", err)
	}
	if _, err := CreateDir(dir); err == nil {
		t.Fatal("expected error creating an existing directory")
	}
}

func TestRename(t *testing.T) {
	root := t.TempDir()
	src := filepath.Join(root, "a.txt")
	dst := filepath.Join(root, "b.txt")
	must(t, os.WriteFile(src, []byte("x"), 0o644))

	if _, err := Rename(src, dst); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(src); !os.IsNotExist(err) {
		t.Fatal("source should no longer exist")
	}
	if _, err := os.Stat(dst); err != nil {
		t.Fatalf("target missing: %v", err)
	}

	// Renaming onto an existing target must fail (no overwrite).
	occupied := filepath.Join(root, "c.txt")
	must(t, os.WriteFile(occupied, []byte("c"), 0o644))
	if _, err := Rename(dst, occupied); err == nil {
		t.Fatal("expected error renaming onto an existing target")
	}
}

func TestDelete(t *testing.T) {
	root := t.TempDir()
	file := filepath.Join(root, "f.txt")
	must(t, os.WriteFile(file, []byte("f"), 0o644))
	if _, err := Delete(file); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(file); !os.IsNotExist(err) {
		t.Fatal("file should be deleted")
	}

	dir := filepath.Join(root, "tree")
	must(t, os.MkdirAll(filepath.Join(dir, "nested"), 0o755))
	must(t, os.WriteFile(filepath.Join(dir, "nested", "g.txt"), []byte("g"), 0o644))
	if _, err := Delete(dir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("directory tree should be deleted")
	}
}

func TestDuplicateFileAndCollision(t *testing.T) {
	root := t.TempDir()
	src := filepath.Join(root, "note.md")
	must(t, os.WriteFile(src, []byte("hello"), 0o644))

	first, err := Duplicate(src)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(first) != "note copy.md" {
		t.Fatalf("first copy = %q, want note copy.md", filepath.Base(first))
	}
	data, err := os.ReadFile(first)
	if err != nil || string(data) != "hello" {
		t.Fatalf("copy content = %q (err %v)", data, err)
	}

	// A second duplicate must not collide with the first.
	second, err := Duplicate(src)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(second) != "note copy 2.md" {
		t.Fatalf("second copy = %q, want note copy 2.md", filepath.Base(second))
	}
}

func TestDuplicateDir(t *testing.T) {
	root := t.TempDir()
	src := filepath.Join(root, "pkg")
	must(t, os.MkdirAll(filepath.Join(src, "inner"), 0o755))
	must(t, os.WriteFile(filepath.Join(src, "inner", "a.txt"), []byte("a"), 0o644))

	dst, err := Duplicate(src)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(dst) != "pkg copy" {
		t.Fatalf("dir copy = %q, want pkg copy", filepath.Base(dst))
	}
	data, err := os.ReadFile(filepath.Join(dst, "inner", "a.txt"))
	if err != nil || string(data) != "a" {
		t.Fatalf("nested copy content = %q (err %v)", data, err)
	}
}

func TestWriteFile(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "note.txt")

	// New file is created with the given content.
	if _, err := WriteFile(path, "hello"); err != nil {
		t.Fatal(err)
	}
	res, err := ReadFile(path)
	if err != nil || res.Content != "hello" {
		t.Fatalf("after write, content = %q (err %v)", res.Content, err)
	}

	// Existing file is overwritten.
	if _, err := WriteFile(path, "world"); err != nil {
		t.Fatal(err)
	}
	res, err = ReadFile(path)
	if err != nil || res.Content != "world" {
		t.Fatalf("after overwrite, content = %q (err %v)", res.Content, err)
	}

	// Empty path and writing onto a directory must fail.
	if _, err := WriteFile("  ", "x"); err == nil {
		t.Fatal("expected error for empty path")
	}
	if _, err := WriteFile(root, "x"); err == nil {
		t.Fatal("expected error writing onto a directory")
	}
}

func TestUserHome(t *testing.T) {
	home, err := UserHome()
	if err != nil {
		t.Fatal(err)
	}
	if home == "" {
		t.Fatal("expected a non-empty home directory")
	}
	want, _ := os.UserHomeDir()
	if home != want {
		t.Fatalf("home = %q, want %q", home, want)
	}
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
