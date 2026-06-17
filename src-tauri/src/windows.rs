use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    thread,
    time::Duration,
};

use tauri::{Manager, Runtime, WebviewWindow};
use windows_sys::Win32::Foundation::{LPARAM, LRESULT, POINT, WPARAM};
use windows_sys::Win32::System::Threading::GetCurrentThreadId;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_MENU, VK_Q, VK_SHIFT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetCursorPos, GetMessageW, PostThreadMessageW, SetWindowPos, SetWindowsHookExW,
    UnhookWindowsHookEx, HC_ACTION, HWND_TOPMOST, KBDLLHOOKSTRUCT, MSG, SWP_ASYNCWINDOWPOS,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WH_KEYBOARD_LL, WM_KEYDOWN, WM_QUIT,
    WM_SYSKEYDOWN,
};

static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static INTERACTION_REGIONS: OnceLock<Arc<Mutex<Vec<InteractionRegion>>>> = OnceLock::new();
static EXIT_REQUESTED: AtomicBool = AtomicBool::new(false);
static EXIT_HOOK_THREAD_ID: OnceLock<u32> = OnceLock::new();

#[derive(Clone, Copy)]
pub struct InteractionRegion {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

pub fn keep_above<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let hwnd = window.hwnd()?;

    unsafe {
        let _ = SetWindowPos(
            hwnd.0 as _,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_ASYNCWINDOWPOS | SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
    }

    Ok(())
}

pub fn set_interaction_regions(regions: Vec<InteractionRegion>) {
    let store = INTERACTION_REGIONS.get_or_init(|| Arc::new(Mutex::new(Vec::new())));

    if let Ok(mut current) = store.lock() {
        *current = regions;
    }
}

pub fn install_cursor_interaction<R: Runtime>(window: WebviewWindow<R>) {
    let store = INTERACTION_REGIONS
        .get_or_init(|| Arc::new(Mutex::new(Vec::new())))
        .clone();

    thread::spawn(move || {
        let mut is_interactive = false;

        loop {
            let Some(regions) = store.lock().ok().map(|current| current.clone()) else {
                thread::sleep(Duration::from_millis(16));
                continue;
            };

            let Ok(window_position) = window.outer_position() else {
                thread::sleep(Duration::from_millis(16));
                continue;
            };

            let mut cursor = POINT::default();

            if unsafe { GetCursorPos(&mut cursor) } != 0 {
                let local_x = cursor.x - window_position.x;
                let local_y = cursor.y - window_position.y;
                let is_inside = regions
                    .iter()
                    .any(|region| region.contains(local_x, local_y));

                if is_inside != is_interactive {
                    is_interactive = is_inside;
                    let _ = window.set_ignore_cursor_events(!is_interactive);
                }
            }

            thread::sleep(Duration::from_millis(16));
        }
    });
}

pub fn install_exit_shortcut(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let _ = APP_HANDLE.set(app);
        let _ = EXIT_HOOK_THREAD_ID.set(unsafe { GetCurrentThreadId() });

        let hook = unsafe {
            SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(exit_shortcut_keyboard_proc),
                std::ptr::null_mut(),
                0,
            )
        };

        if hook.is_null() {
            eprintln!("Failed to install exit keyboard hook.");
            return;
        }

        let mut message = MSG::default();

        while unsafe { GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) } > 0 {}

        unsafe {
            UnhookWindowsHookEx(hook);
        }
    });
}

impl InteractionRegion {
    fn contains(self, x: i32, y: i32) -> bool {
        x >= self.x && x <= self.x + self.width && y >= self.y && y <= self.y + self.height
    }
}

unsafe extern "system" fn exit_shortcut_keyboard_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code == HC_ACTION as i32 && (wparam as u32 == WM_KEYDOWN || wparam as u32 == WM_SYSKEYDOWN) {
        let key_event = unsafe { &*(lparam as *const KBDLLHOOKSTRUCT) };

        if key_event.vkCode == VK_Q as u32 && is_key_down(VK_MENU) && is_key_down(VK_SHIFT) {
            if !EXIT_REQUESTED.swap(true, Ordering::SeqCst) {
                if let Some(app) = APP_HANDLE.get() {
                    request_graceful_exit(app.clone());
                }
            }

            return 1;
        }
    }

    unsafe { CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam) }
}

fn request_graceful_exit(app: tauri::AppHandle) {
    let window_app = app.clone();
    let _ = app.run_on_main_thread(move || {
        for window in window_app.webview_windows().values() {
            let _ = window.set_ignore_cursor_events(false);
            let _ = window.close();
        }
    });

    if let Some(thread_id) = EXIT_HOOK_THREAD_ID.get() {
        unsafe {
            let _ = PostThreadMessageW(*thread_id, WM_QUIT, 0, 0);
        }
    }

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(120));
        app.exit(0);
    });
}

fn is_key_down(key: u16) -> bool {
    unsafe { GetAsyncKeyState(key as i32) & (0x8000u16 as i16) != 0 }
}
