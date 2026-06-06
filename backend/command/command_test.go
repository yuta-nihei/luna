package command

import (
	"runtime"
	"strings"
	"testing"
)

func TestRunCapturesStdout(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("posix shell test")
	}
	res, err := Run("echo hello", "")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(res.Stdout, "hello") {
		t.Fatalf("stdout = %q", res.Stdout)
	}
	if res.ExitCode != 0 {
		t.Fatalf("exit = %d, want 0", res.ExitCode)
	}
}

func TestRunNonZeroExit(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("posix shell test")
	}
	res, err := Run("exit 3", "")
	if err != nil {
		t.Fatal(err)
	}
	if res.ExitCode != 3 {
		t.Fatalf("exit = %d, want 3", res.ExitCode)
	}
}

func TestRunEmptyValue(t *testing.T) {
	if _, err := Run("   ", ""); err == nil {
		t.Fatal("expected error for empty value")
	}
}

func TestOpenURLRejectsNonHTTP(t *testing.T) {
	// These must be rejected by scheme validation before any process is spawned.
	for _, raw := range []string{
		"file:///etc/passwd",
		"javascript:alert(1)",
		"ftp://example.com",
		"not a url",
	} {
		if err := OpenURL(raw); err == nil {
			t.Errorf("OpenURL(%q) = nil, want rejection", raw)
		}
	}
}
