package palette

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadSeedsThenReads(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("LUNA_HOME", dir)

	// First load seeds defaults and writes the file.
	items, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) == 0 {
		t.Fatal("expected seeded default items")
	}
	if _, err := os.Stat(filepath.Join(dir, "palette.json")); err != nil {
		t.Fatalf("palette.json not written: %v", err)
	}

	// Overwrite with a custom palette and confirm Load reads it back.
	custom := `[{"id":"x","label":"X","icon":"box","type":"url","value":"https://example.com"}]`
	if err := os.WriteFile(filepath.Join(dir, "palette.json"), []byte(custom), 0o644); err != nil {
		t.Fatal(err)
	}
	items, err = Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "x" || items[0].Type != "url" {
		t.Fatalf("unexpected items: %+v", items)
	}
}

func TestSaveThenLoad(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("LUNA_HOME", dir)

	want := []Item{
		{ID: "a", Label: "Dev", Icon: "play", Type: "command", Value: "npm run dev"},
		{ID: "b", Label: "Docs", Icon: "globe", Type: "url", Value: "https://example.com"},
	}
	if err := Save(want); err != nil {
		t.Fatal(err)
	}

	got, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != len(want) {
		t.Fatalf("got %d items, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("item %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestSaveRejectsInvalidItems(t *testing.T) {
	t.Setenv("LUNA_HOME", t.TempDir())

	cases := map[string][]Item{
		"missing id":    {{Label: "X", Value: "v"}},
		"missing label": {{ID: "x", Value: "v"}},
		"missing value": {{ID: "x", Label: "X"}},
		"blank label":   {{ID: "x", Label: "  ", Value: "v"}},
	}
	for name, items := range cases {
		if err := Save(items); err == nil {
			t.Errorf("%s: expected error, got nil", name)
		}
	}
}
