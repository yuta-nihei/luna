package command

import (
	"fmt"
	"net/url"
	"os/exec"
	"runtime"
)

// OpenURL launches rawURL in the user's default browser. It is the backend for
// Left Palette actions of type "url". Only http/https URLs are allowed, and the
// URL is passed to the opener as a separate argument (never through a shell), so
// there is no command-injection surface.
func OpenURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid url: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("unsupported url scheme %q: only http/https allowed", u.Scheme)
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", u.String())
	case "darwin":
		cmd = exec.Command("open", u.String())
	default:
		cmd = exec.Command("xdg-open", u.String())
	}
	// Fire and forget: the opener detaches the browser; we don't wait for it.
	return cmd.Start()
}
