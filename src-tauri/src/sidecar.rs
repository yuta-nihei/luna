//! Luna Core sidecar bridge.
//!
//! Spawns the Go core as a Tauri sidecar and speaks newline-delimited JSON-RPC
//! over its stdio. This module is pure Infrastructure (architecture.md): it
//! carries no domain logic, only request/response correlation by id.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde_json::{json, Value};
use tauri::async_runtime;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::oneshot;

type Pending = Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>;

struct Inner {
    child: Mutex<Option<CommandChild>>,
    pending: Pending,
    next_id: AtomicU64,
}

/// Managed Tauri state that owns the Core sidecar and its in-flight requests.
pub struct CoreBridge {
    inner: Arc<Inner>,
}

impl Default for CoreBridge {
    fn default() -> Self {
        Self::new()
    }
}

impl CoreBridge {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Inner {
                child: Mutex::new(None),
                pending: Mutex::new(HashMap::new()),
                next_id: AtomicU64::new(1),
            }),
        }
    }

    /// Spawn the `luna-core` sidecar and start the stdout reader loop.
    /// Call once during app setup.
    pub fn start(&self, app: &tauri::AppHandle) -> Result<(), String> {
        let sidecar = app
            .shell()
            .sidecar("luna-core")
            .map_err(|e| format!("failed to locate luna-core sidecar: {e}"))?;
        let (mut rx, child) = sidecar
            .spawn()
            .map_err(|e| format!("failed to spawn luna-core: {e}"))?;
        *self.inner.child.lock().unwrap() = Some(child);

        let inner = self.inner.clone();
        async_runtime::spawn(async move {
            // Accumulate bytes so we are correct whether the shell plugin emits
            // raw chunks (newline-terminated, possibly partial) or one stripped
            // line per event. See on_stdout for details.
            let mut buf: Vec<u8> = Vec::new();
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => on_stdout(&inner, &mut buf, &bytes),
                    CommandEvent::Stderr(_) => { /* core diagnostics; ignored */ }
                    CommandEvent::Error(e) => fail_all(&inner, format!("core error: {e}")),
                    CommandEvent::Terminated(_) => {
                        fail_all(&inner, "core sidecar terminated".to_string());
                        break;
                    }
                    _ => {}
                }
            }
        });
        Ok(())
    }

    /// Send a JSON-RPC request and await its correlated response.
    pub async fn request(&self, method: String, params: Value) -> Result<Value, String> {
        let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.inner.pending.lock().unwrap().insert(id, tx);

        let mut line = serde_json::to_vec(&json!({
            "id": id,
            "method": method,
            "params": params,
        }))
        .map_err(|e| e.to_string())?;
        line.push(b'\n');

        // Write to the child's stdin without holding the lock across the await.
        let write_result = {
            let mut guard = self.inner.child.lock().unwrap();
            match guard.as_mut() {
                Some(child) => child.write(&line).map_err(|e| e.to_string()),
                None => Err("core sidecar not started".to_string()),
            }
        };
        if let Err(e) = write_result {
            self.inner.pending.lock().unwrap().remove(&id);
            return Err(e);
        }

        match rx.await {
            Ok(outcome) => outcome,
            Err(_) => Err("core sidecar dropped the request".to_string()),
        }
    }
}

/// Feed stdout bytes through the framer and dispatch any complete messages.
fn on_stdout(inner: &Inner, buf: &mut Vec<u8>, bytes: &[u8]) {
    buf.extend_from_slice(bytes);

    // 1) Dispatch every complete, newline-terminated line (raw/chunked mode).
    while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
        let line: Vec<u8> = buf.drain(..=pos).collect();
        dispatch_bytes(inner, &line[..line.len() - 1]);
    }

    // 2) The remainder has no trailing newline. Some plugin versions deliver
    //    one already-stripped line per event; if the buffer is now a complete
    //    JSON value, dispatch it and reset. Luna's messages are always JSON
    //    objects, whose prefixes are never themselves valid JSON, so this can
    //    never misfire on a partial chunk.
    if !buf.is_empty()
        && !buf.iter().all(u8::is_ascii_whitespace)
        && serde_json::from_slice::<Value>(buf).is_ok()
    {
        let line = std::mem::take(buf);
        dispatch_bytes(inner, &line);
    }
}

fn dispatch_bytes(inner: &Inner, line: &[u8]) {
    if line.iter().all(u8::is_ascii_whitespace) {
        return;
    }
    if let Ok(value) = serde_json::from_slice::<Value>(line) {
        dispatch_value(inner, value);
    }
    // Non-JSON noise is ignored.
}

fn dispatch_value(inner: &Inner, value: Value) {
    // Messages without an id are handshakes/notifications, e.g. {"type":"ready"}.
    let Some(id) = value.get("id").and_then(Value::as_u64) else {
        return;
    };
    let tx = inner.pending.lock().unwrap().remove(&id);
    if let Some(tx) = tx {
        let outcome = match value.get("error").and_then(Value::as_str) {
            Some(err) => Err(err.to_string()),
            None => Ok(value.get("result").cloned().unwrap_or(Value::Null)),
        };
        let _ = tx.send(outcome);
    }
}

/// Fail every in-flight request (used when the sidecar dies).
fn fail_all(inner: &Inner, reason: String) {
    let mut pending = inner.pending.lock().unwrap();
    for (_, tx) in pending.drain() {
        let _ = tx.send(Err(reason.clone()));
    }
}
