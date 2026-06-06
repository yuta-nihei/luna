// Command luna-core is the Luna Core sidecar. It is spawned by the Tauri shell
// and speaks newline-delimited JSON-RPC over stdio: one JSON request per line
// on stdin, one JSON response per line on stdout.
package main

import (
	"bufio"
	"encoding/json"
	"os"

	"luna/core/command"
	"luna/core/filesystem"
	"luna/core/palette"
	"luna/core/rpc"
)

// maxLine bounds a single inbound request line (requests are small; this only
// guards against a malformed peer).
const maxLine = 16 * 1024 * 1024

func main() {
	d := rpc.NewDispatcher()
	filesystem.Register(d)
	palette.Register(d)
	command.Register(d)

	out := bufio.NewWriter(os.Stdout)

	// Handshake: tell the host the core is up before reading requests.
	writeLine(out, map[string]string{"type": "ready"})

	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 64*1024), maxLine)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var req rpc.Request
		if err := json.Unmarshal(line, &req); err != nil {
			writeLine(out, rpc.Response{Error: "invalid request: " + err.Error()})
			continue
		}
		writeLine(out, d.Dispatch(req))
	}
	// stdin closed (host exited) → terminate.
}

// writeLine marshals v and writes it as a single newline-terminated line,
// flushing immediately so the host sees each response promptly.
func writeLine(w *bufio.Writer, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		b, _ = json.Marshal(rpc.Response{Error: "marshal error: " + err.Error()})
	}
	_, _ = w.Write(b)
	_ = w.WriteByte('\n')
	_ = w.Flush()
}
