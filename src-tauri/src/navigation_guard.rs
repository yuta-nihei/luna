use tauri::{plugin::Plugin, Runtime, Webview};
use url::Url;

/// Keep the Luna shell on the app origin. Block file:// navigations and stray
/// new-window requests that would show workspace HTML outside the editor.
pub struct NavigationGuard;

impl<R: Runtime> Plugin<R> for NavigationGuard {
    fn name(&self) -> &'static str {
        "luna-navigation-guard"
    }

    fn on_navigation(&mut self, _webview: &Webview<R>, url: &Url) -> bool {
        is_allowed_app_url(url)
    }
}

fn is_allowed_app_url(url: &Url) -> bool {
    match url.scheme() {
        "tauri" => true,
        "http" | "https" => {
            if cfg!(debug_assertions) {
                matches!(url.host_str(), Some("localhost") | Some("127.0.0.1"))
            } else {
                matches!(
                    url.host_str(),
                    Some("localhost") | Some("127.0.0.1") | Some("tauri.localhost")
                )
            }
        }
        _ => false,
    }
}
