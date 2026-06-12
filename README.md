# Whip

Whip is a small Tauri desktop app that renders a transparent 3D whip overlay. A quick whip gesture sends `Enter` to the currently focused window.

## Features

- Transparent always-on-top desktop overlay
- Three.js whip rendering
- Gesture-based crack detection
- `Enter` key trigger on crack
- Local whip counter
- Windows tray icon with show, hide, and quit actions
- `Alt + Shift + Q` global quit shortcut on Windows

## Development

Install dependencies:

```bash
pnpm install
```

Run the desktop app in development:

```bash
pnpm tauri dev
```

Build the frontend:

```bash
pnpm build
```

Check the Rust side:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## Project Layout

```text
src/                 Frontend entry point and styles
src-tauri/           Tauri and platform-specific Rust code
packages/            Shared TypeScript workspace packages
public/              Runtime assets served by Vite/Tauri
```

## Notes

The app is intentionally scoped to a single `Enter` action. It does not provide macro recording, arbitrary key injection, accounts, syncing, or analytics.
