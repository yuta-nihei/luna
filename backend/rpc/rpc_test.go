package rpc

import (
	"encoding/json"
	"testing"
)

func TestDispatchUnknownMethod(t *testing.T) {
	d := NewDispatcher()
	resp := d.Dispatch(Request{ID: 7, Method: "nope"})
	if resp.ID != 7 {
		t.Fatalf("id = %d, want 7", resp.ID)
	}
	if resp.Error == "" {
		t.Fatal("expected error for unknown method")
	}
}

func TestDispatchSuccessAndError(t *testing.T) {
	d := NewDispatcher()
	d.Register("echo", func(params json.RawMessage) (any, error) {
		return string(params), nil
	})
	resp := d.Dispatch(Request{ID: 1, Method: "echo", Params: json.RawMessage(`"hi"`)})
	if resp.Error != "" {
		t.Fatalf("unexpected error: %s", resp.Error)
	}
	if resp.Result != `"hi"` {
		t.Fatalf("result = %v", resp.Result)
	}
}

func TestRegisterDuplicatePanics(t *testing.T) {
	d := NewDispatcher()
	d.Register("x", func(json.RawMessage) (any, error) { return nil, nil })
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic on duplicate registration")
		}
	}()
	d.Register("x", func(json.RawMessage) (any, error) { return nil, nil })
}
