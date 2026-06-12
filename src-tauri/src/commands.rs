use crate::platform;
use serde::Deserialize;
use serde::Serialize;

#[derive(Clone, Copy, Deserialize)]
pub struct InteractionRegion {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[derive(Serialize)]
pub struct FocusActionResult {
    ok: bool,
    reason: Option<String>,
}

#[tauri::command]
pub fn update_interaction_region(regions: Vec<InteractionRegion>) {
    platform::set_interaction_regions(
        regions
            .into_iter()
            .map(|region| platform::InteractionRegion {
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
            })
            .collect(),
    );
}

#[tauri::command]
pub fn trigger_enter() -> FocusActionResult {
    match send_enter() {
        Ok(()) => FocusActionResult {
            ok: true,
            reason: None,
        },
        Err(reason) => FocusActionResult {
            ok: false,
            reason: Some(reason),
        },
    }
}

#[cfg(target_os = "windows")]
fn send_enter() -> Result<(), String> {
    use std::mem::size_of;

    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        MapVirtualKeyW, SendInput, INPUT, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE, MAPVK_VK_TO_VSC,
        VK_RETURN,
    };

    let scan_code = unsafe { MapVirtualKeyW(VK_RETURN as u32, MAPVK_VK_TO_VSC) } as u16;
    let inputs = [
        keyboard_input(scan_code, KEYEVENTF_SCANCODE),
        keyboard_input(scan_code, KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP),
    ];

    let sent = unsafe {
        SendInput(
            inputs.len() as u32,
            inputs.as_ptr(),
            size_of::<INPUT>() as i32,
        )
    };

    if sent == inputs.len() as u32 {
        Ok(())
    } else {
        Err(format!(
            "SendInput only sent {sent}/{} events",
            inputs.len()
        ))
    }
}

#[cfg(target_os = "windows")]
fn keyboard_input(
    scan_code: u16,
    flags: u32,
) -> windows_sys::Win32::UI::Input::KeyboardAndMouse::INPUT {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
    };

    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: 0,
                wScan: scan_code,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(not(target_os = "windows"))]
fn send_enter() -> Result<(), String> {
    Err("Enter injection is only implemented on Windows for now.".into())
}
