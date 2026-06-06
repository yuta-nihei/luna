// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod navigation_guard;
mod sidecar;

use serde_json::Value;
use sidecar::CoreBridge;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

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

fn build_app_menu(app: &tauri::App) -> tauri::Result<()> {
    let save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&save)
        .build()?;

    let menu = {
        #[cfg(target_os = "macos")]
        {
            // macOS menubar requires submenus only; the first becomes the app menu.
            let app_menu = SubmenuBuilder::new(app, "Luna")
                .about(None)
                .separator()
                .quit()
                .build()?;
            MenuBuilder::new(app)
                .items(&[&app_menu, &file_menu])
                .build()?
        }
        #[cfg(not(target_os = "macos"))]
        {
            MenuBuilder::new(app).item(&file_menu).build()?
        }
    };

    app.set_menu(menu)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(navigation_guard::NavigationGuard)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(CoreBridge::new())
        .on_menu_event(|app, event| {
            if event.id() == "save" {
                let _ = app.emit("luna:save", ());
            }
        })
        .setup(|app| {
            build_app_menu(app)?;
            // Start the Go core sidecar as soon as the app is ready.
            app.state::<CoreBridge>().start(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![core_request])
        .run(tauri::generate_context!())
        .expect("error while running Luna");
}
