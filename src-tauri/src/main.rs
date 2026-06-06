// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sidecar;

use serde_json::Value;
use sidecar::CoreBridge;
use tauri::Manager;

/// The entire Core API surface flows through this one bridge command. Rust stays
/// a thin Infrastructure layer; all file/search/git/terminal logic lives in the
/// Go core (CLAUDE.md / architecture.md).
#[tauri::command]
async fn core_request(
    bridge: tauri::State<'_, CoreBridge>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    bridge.request(method, params).await
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(CoreBridge::new())
        .setup(|app| {
            // Start the Go core sidecar as soon as the app is ready.
            app.state::<CoreBridge>().start(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![core_request])
        .run(tauri::generate_context!())
        .expect("error while running Luna");
}
