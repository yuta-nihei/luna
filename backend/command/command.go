// Package command runs one-shot shell commands for Left Palette actions of type
// "command"/"terminal". It captures stdout/stderr/exit code and returns them;
// interactive PTY sessions are a separate, later concern (see terminal package).
package command

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"luna/core/rpc"
)

// Result is the captured outcome of a one-shot command.
type Result struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exitCode"`
}

// Run executes value through the platform shell, optionally in cwd, and returns
// its captured output. A non-zero exit is reported via Result.ExitCode, not as
// an error; an error is only returned when the command fails to start.
func Run(value, cwd string) (*Result, error) {
	if strings.TrimSpace(value) == "" {
		return nil, errors.New("value is required")
	}
	name, flag := shell()
	cmd := exec.Command(name, flag, value)
	if cwd != "" {
		cmd.Dir = cwd
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			exitCode = ee.ExitCode()
		} else {
			return nil, err
		}
	}
	return &Result{Stdout: stdout.String(), Stderr: stderr.String(), ExitCode: exitCode}, nil
}

// shell returns the platform command interpreter and its "run this string" flag.
func shell() (string, string) {
	if runtime.GOOS == "windows" {
		return "powershell", "-Command"
	}
	if sh := os.Getenv("SHELL"); sh != "" {
		return sh, "-c"
	}
	return "/bin/sh", "-c"
}

// Register wires command methods onto the dispatcher.
func Register(d *rpc.Dispatcher) {
	d.Register("command.run", func(raw json.RawMessage) (any, error) {
		var p struct {
			Value string `json:"value"`
			Cwd   string `json:"cwd"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		return Run(p.Value, p.Cwd)
	})
	d.Register("url.open", func(raw json.RawMessage) (any, error) {
		var p struct {
			URL string `json:"url"`
		}
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		if err := OpenURL(p.URL); err != nil {
			return nil, err
		}
		return map[string]bool{"ok": true}, nil
	})
}
