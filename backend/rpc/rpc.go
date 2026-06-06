// Package rpc implements a minimal newline-delimited JSON-RPC dispatcher used
// to talk to the Luna UI over stdio. It carries no domain logic — feature
// packages register handlers against it.
package rpc

import "encoding/json"

// Request is one inbound call. Each line on stdin decodes into a Request.
type Request struct {
	ID     uint64          `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

// Response is one outbound reply. Each line on stdout encodes a Response.
// Exactly one of Result / Error is meaningful.
type Response struct {
	ID     uint64 `json:"id"`
	Result any    `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

// Handler processes the params of a single method and returns a result.
type Handler func(params json.RawMessage) (any, error)

// Dispatcher routes method names to handlers.
type Dispatcher struct {
	handlers map[string]Handler
}

// NewDispatcher returns an empty Dispatcher.
func NewDispatcher() *Dispatcher {
	return &Dispatcher{handlers: make(map[string]Handler)}
}

// Register binds a handler to a method name. It panics on duplicate
// registration so collisions surface at startup, not at runtime.
func (d *Dispatcher) Register(method string, h Handler) {
	if _, exists := d.handlers[method]; exists {
		panic("rpc: duplicate handler for method " + method)
	}
	d.handlers[method] = h
}

// Dispatch runs the handler for req.Method and wraps the outcome in a Response
// carrying the original request ID.
func (d *Dispatcher) Dispatch(req Request) Response {
	h, ok := d.handlers[req.Method]
	if !ok {
		return Response{ID: req.ID, Error: "unknown method: " + req.Method}
	}
	result, err := h(req.Params)
	if err != nil {
		return Response{ID: req.ID, Error: err.Error()}
	}
	return Response{ID: req.ID, Result: result}
}
