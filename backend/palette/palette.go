// Package palette loads and seeds the user's Left Palette definition — Luna's
// central, user-configurable control panel. It is stored as human-editable
// JSON under the Luna config directory (architecture.md: ~/.luna/palette.json).
package palette

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"luna/core/rpc"
)

// Item is one Left Palette action. Mirrors the data structure in
// architecture.md. Type is one of: command | url | ai | workflow | terminal.
type Item struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	Type  string `json:"type"`
	Value string `json:"value"`
}

// ConfigDir resolves Luna's config directory. LUNA_HOME overrides the default
// (~/.luna), which keeps the path injectable for tests.
func ConfigDir() (string, error) {
	if v := os.Getenv("LUNA_HOME"); v != "" {
		return v, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".luna"), nil
}

// defaultItems is the palette seeded on first run so the panel is never empty.
func defaultItems() []Item {
	return []Item{
		{ID: "echo-hello", Label: "Echo Hello", Icon: "terminal", Type: "command", Value: "echo hello from luna"},
		{ID: "git-status", Label: "Git Status", Icon: "git-branch", Type: "command", Value: "git status"},
		{ID: "list-files", Label: "List Files", Icon: "list", Type: "command", Value: "ls -la"},
	}
}

// Load returns the palette items, seeding defaults to disk on first run.
func Load() ([]Item, error) {
	dir, err := ConfigDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "palette.json")

	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		items := defaultItems()
		if werr := write(path, items); werr != nil {
			return nil, werr
		}
		return items, nil
	}
	if err != nil {
		return nil, err
	}

	var items []Item
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

// Save validates and persists the user's palette to palette.json, replacing the
// existing file. Items come from the UI (the editor / drag-and-drop), so each is
// required to carry an ID, Label, and Value; an empty slice clears the palette.
func Save(items []Item) error {
	if items == nil {
		items = []Item{}
	}
	for i, it := range items {
		if it.ID == "" {
			return fmt.Errorf("item %d: id is required", i)
		}
		if strings.TrimSpace(it.Label) == "" {
			return fmt.Errorf("item %d (%s): label is required", i, it.ID)
		}
		if strings.TrimSpace(it.Value) == "" {
			return fmt.Errorf("item %d (%s): value is required", i, it.ID)
		}
	}
	dir, err := ConfigDir()
	if err != nil {
		return err
	}
	return write(filepath.Join(dir, "palette.json"), items)
}

func write(path string, items []Item) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// Register wires palette methods onto the dispatcher.
func Register(d *rpc.Dispatcher) {
	d.Register("palette.load", func(json.RawMessage) (any, error) {
		return Load()
	})
	d.Register("palette.save", func(raw json.RawMessage) (any, error) {
		var p struct {
			Items []Item `json:"items"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		if err := Save(p.Items); err != nil {
			return nil, err
		}
		return p.Items, nil
	})
}
