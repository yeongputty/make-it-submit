mod commands;
mod platform;

use tauri::{
    Manager, PhysicalPosition, PhysicalSize, Position, Runtime, Size, WebviewWindow, WindowEvent,
};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = configure_widget_window(&window);
                platform::install_cursor_interaction(window.clone());
                platform::install_exit_shortcut(app.handle().clone());

                let widget_window = window.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::Focused(_) | WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                        let _ = platform::keep_above(&widget_window);
                    }
                    _ => {}
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::trigger_enter,
            commands::update_interaction_region
        ])
        .run(tauri::generate_context!())
        .expect("error while running Whip");
}

fn configure_widget_window<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    window.set_fullscreen(false)?;
    window.set_decorations(false)?;
    window.set_shadow(false)?;
    window.set_skip_taskbar(true)?;
    window.set_focusable(false)?;
    window.set_visible_on_all_workspaces(true)?;
    window.set_ignore_cursor_events(true)?;

    if let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) {
        let position = monitor.position();
        let size = monitor.size();

        window.set_position(Position::Physical(PhysicalPosition::new(
            position.x, position.y,
        )))?;
        window.set_size(Size::Physical(PhysicalSize::new(size.width, size.height)))?;
    }

    window.set_always_on_top(true)?;
    platform::keep_above(window)
}
