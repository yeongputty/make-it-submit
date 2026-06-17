mod commands;
mod windows;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Runtime, Size, WebviewWindow,
    WindowEvent,
};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            install_tray_icon(app.handle())?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = configure_widget_window(&window);
                windows::install_cursor_interaction(window.clone());
                windows::install_exit_shortcut(app.handle().clone());

                let widget_window = window.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::Focused(_) | WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                        let _ = windows::keep_above(&widget_window);
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
        .expect("error while running Make It Submit");
}

fn install_tray_icon<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Make It Submit")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = windows::keep_above(&window);
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
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
    windows::keep_above(window)
}
