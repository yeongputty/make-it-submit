#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "windows")]
pub use windows::{
    install_cursor_interaction, install_exit_shortcut, keep_above, set_interaction_regions,
    InteractionRegion,
};

#[cfg(target_os = "macos")]
pub use macos::keep_above;

#[cfg(target_os = "macos")]
pub fn install_exit_shortcut(_app: tauri::AppHandle) {}

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
pub struct InteractionRegion {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[cfg(target_os = "macos")]
pub fn install_cursor_interaction<R: tauri::Runtime>(_window: tauri::WebviewWindow<R>) {}

#[cfg(target_os = "macos")]
pub fn set_interaction_regions(_regions: Vec<InteractionRegion>) {}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn keep_above<R: tauri::Runtime>(_window: &tauri::WebviewWindow<R>) -> tauri::Result<()> {
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn install_exit_shortcut(_app: tauri::AppHandle) {}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[derive(Clone, Copy)]
pub struct InteractionRegion {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn install_cursor_interaction<R: tauri::Runtime>(_window: tauri::WebviewWindow<R>) {}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn set_interaction_regions(_regions: Vec<InteractionRegion>) {}
