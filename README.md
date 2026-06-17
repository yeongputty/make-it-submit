# Make It Submit

Make It Submit은 화면 위에 작은 채찍을 띄워두고, 채찍을 빠르게 휘두르면 현재 선택된 창에 `Enter`를 입력해주는 Windows 앱입니다.

## 소개

이 앱은 Codex와 함께 바이브 코딩으로 만든 작은 실험용 데스크톱 도구입니다. 거창한 생산성 앱이라기보다는, 반복적으로 제출 버튼을 눌러야 하는 상황을 조금 장난스럽게 처리하기 위한 개인용 유틸리티입니다.

## 다운로드

앱만 사용하려면 GitHub Releases에서 최신 설치 파일을 내려받으면 됩니다.

```text
Make It Submit_0.1.1_x64-setup.exe
```

설치 파일을 실행한 뒤 안내에 따라 설치하세요.

## 설치 및 실행 파일 만들기

먼저 아래 도구가 설치되어 있어야 합니다.

- Node.js
- pnpm
- Rust
- Microsoft C++ Build Tools
- Microsoft Edge WebView2 Runtime

소스 코드를 받은 뒤 프로젝트 폴더에서 실행합니다.

```powershell
pnpm install
pnpm tauri build
```

빌드가 끝나면 실행 파일과 설치 파일은 보통 아래 폴더에 생성됩니다.

```text
src-tauri/target/release/bundle/
```

개발 중 바로 실행하려면 아래 명령을 사용합니다.

```powershell
pnpm tauri dev
```

## 배포 메모

빌드 산출물은 Git 저장소에 커밋하지 않고 GitHub Release의 첨부 파일로 배포합니다.

```text
src-tauri/target/release/bundle/nsis/Make It Submit_0.1.1_x64-setup.exe
```

`dist/`, `node_modules/`, `src-tauri/target/` 폴더는 저장소에 포함하지 않습니다.

## 사용 방법

1. 앱을 실행합니다.
2. 입력을 보낼 창이나 버튼을 먼저 클릭해서 포커스를 둡니다.
3. 화면의 채찍을 빠르게 아래로 휘두릅니다.
4. 채찍 소리가 나면 현재 포커스된 곳에 `Enter`가 입력됩니다.

## 버튼

- `Pardon`: 채찍 입력을 잠시 끄고 채찍을 위로 올립니다.
- `Punish`: 채찍 입력을 다시 켜고 채찍을 아래로 내립니다.

## 트레이

- `Show`: 화면에 다시 표시합니다.
- `Hide`: 화면에서 숨깁니다.
- `Quit`: 앱을 종료합니다.

## 종료

키보드에서 `Alt + Shift + Q`를 누르면 바로 종료됩니다.

## 오디오 출처

기본 채찍 소리는 Myinstants의 `Whip` 사운드를 사용합니다.

- Source: https://www.myinstants.com/en/instant/whip/
- Audio file: `public/audio/whip.mp3`
- Backup generated audio: `public/audio/whip-gen.mp3`

오디오 사용에 문제가 있거나 권리자 요청이 있으면 해당 파일은 삭제하거나 직접 생성한 대체 사운드로 교체합니다.

## 라이선스

이 프로젝트는 소스 공개 프로젝트이며, 상업적 이용과 재배포를 허용하지 않습니다.

- 개인적, 비상업적 사용만 허용됩니다.
- 소스 코드, 수정본, 빌드된 실행 파일, 설치 파일의 재배포는 금지됩니다.
- 자세한 내용은 `LICENSE` 파일을 확인하세요.

---

# Make It Submit

Make It Submit is a small Windows app that shows a whip on your screen. Swing the whip quickly to send `Enter` to the currently focused window.

## About

This is a small experimental desktop tool vibe-coded with Codex. It is not meant to be a serious productivity suite; it is a playful utility for moments where you repeatedly need to submit or confirm something.

## Download

If you just want to use the app, download the latest installer from GitHub Releases.

```text
Make It Submit_0.1.1_x64-setup.exe
```

Run the installer and follow the setup instructions.

## Install And Build

Install these tools first.

- Node.js
- pnpm
- Rust
- Microsoft C++ Build Tools
- Microsoft Edge WebView2 Runtime

After downloading the source code, run these commands in the project folder.

```powershell
pnpm install
pnpm tauri build
```

The executable and installer files are usually created here.

```text
src-tauri/target/release/bundle/
```

To run the app during development, use:

```powershell
pnpm tauri dev
```

## Release Notes

Build artifacts should not be committed to the Git repository. Attach the installer to a GitHub Release instead.

```text
src-tauri/target/release/bundle/nsis/Make It Submit_0.1.1_x64-setup.exe
```

Do not commit `dist/`, `node_modules/`, or `src-tauri/target/`.

## How To Use

1. Launch the app.
2. Click the window or button that should receive the input.
3. Swing the whip downward quickly.
4. When the whip sound plays, `Enter` is sent to the focused target.

## Buttons

- `Pardon`: Temporarily disables whip input and raises the whip.
- `Punish`: Enables whip input again and lowers the whip.

## Tray

- `Show`: Shows the app again.
- `Hide`: Hides the app from the screen.
- `Quit`: Quits the app.

## Quit Shortcut

Press `Alt + Shift + Q` to quit immediately.

## Audio Source

The default whip sound uses the `Whip` sound from Myinstants.

- Source: https://www.myinstants.com/en/instant/whip/
- Audio file: `public/audio/whip.mp3`
- Backup generated audio: `public/audio/whip-gen.mp3`

If there is any issue with the audio usage or a rights holder requests action, the file will be removed or replaced with a generated alternative.

## License

This is a source-available project. Commercial use and redistribution are not allowed.

- Personal, non-commercial use only.
- Redistribution of the source code, modified source code, built binaries, or installers is prohibited.
- See the `LICENSE` file for details.
