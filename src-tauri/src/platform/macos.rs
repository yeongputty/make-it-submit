use std::{
    ffi::{c_char, c_void, CString},
    mem,
};

use tauri::{Runtime, WebviewWindow};

const NS_STATUS_WINDOW_LEVEL: isize = 25;
const NS_WINDOW_COLLECTION_BEHAVIOR_CAN_JOIN_ALL_SPACES: usize = 1 << 0;
const NS_WINDOW_COLLECTION_BEHAVIOR_STATIONARY: usize = 1 << 4;
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY: usize = 1 << 8;

type Id = *mut c_void;
type Sel = *mut c_void;

extern "C" {
    fn sel_registerName(name: *const c_char) -> Sel;
    fn objc_msgSend();
}

pub fn keep_above<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let ns_window = window.ns_window()? as Id;
    let collection_behavior = NS_WINDOW_COLLECTION_BEHAVIOR_CAN_JOIN_ALL_SPACES
        | NS_WINDOW_COLLECTION_BEHAVIOR_STATIONARY
        | NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY;

    unsafe {
        send_bool(ns_window, "setHidesOnDeactivate:", false);
        send_isize(ns_window, "setLevel:", NS_STATUS_WINDOW_LEVEL);
        send_usize(ns_window, "setCollectionBehavior:", collection_behavior);
    }

    Ok(())
}

unsafe fn send_bool(receiver: Id, selector: &str, value: bool) {
    let selector = selector_from_name(selector);
    let msg: extern "C" fn(Id, Sel, bool) = mem::transmute(objc_msgSend as *const ());
    msg(receiver, selector, value);
}

unsafe fn send_isize(receiver: Id, selector: &str, value: isize) {
    let selector = selector_from_name(selector);
    let msg: extern "C" fn(Id, Sel, isize) = mem::transmute(objc_msgSend as *const ());
    msg(receiver, selector, value);
}

unsafe fn send_usize(receiver: Id, selector: &str, value: usize) {
    let selector = selector_from_name(selector);
    let msg: extern "C" fn(Id, Sel, usize) = mem::transmute(objc_msgSend as *const ());
    msg(receiver, selector, value);
}

fn selector_from_name(selector: &str) -> Sel {
    let selector = CString::new(selector).expect("selector names cannot contain nul bytes");

    unsafe { sel_registerName(selector.as_ptr()) }
}
