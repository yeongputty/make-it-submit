# Whip 프로젝트 개발 계획

## 목표

마우스 드래그로 3D 느낌의 채찍을 휘두르고, 특정 제스처가 감지되면 이전 포커스 위치에 `Enter` 입력을 보내는 데스크톱 앱을 만든다.

초기 상용 목표는 다음과 같다.

- 1차 플랫폼: macOS
- 1차 배포 채널: Mac App Store
- 가격: USD 1.99
- 기술 스택: Tauri + Rust + TypeScript + Three.js/WebGL
- 입력 기능 제한: `Enter` 단일 입력
- 확장 방향: 채찍 스킨, 손잡이 컬러, 휘두를 때 효과, 맞을 때 효과, 사운드 팩을 인앱 결제로 판매

## 핵심 판단

### Three.js/WebGL 사용

사용자가 원하는 "3D 느낌"을 제품의 중심 경험으로 잡는다. Canvas 2D 물리 시각화가 아니라 WebGL 기반 렌더러를 사용한다.

초기 구현은 완전한 3D 물리 엔진보다, 2.5D 연출에 가까운 구조가 좋다.

- 채찍 물리는 점/관절 기반 Verlet 또는 Position Based Dynamics로 구현
- 채찍의 실제 충돌/입력 판정은 2D/2.5D 좌표계에서 단순화
- 렌더링은 Three.js의 tube, ribbon, trail, particles, postprocessing으로 3D처럼 표현
- 카메라 흔들림, 모션 블러, 라이트, 끝부분 spark를 통해 휘두르는 손맛 강화

### Mac App Store 우선의 리스크

Mac App Store 빌드는 반드시 초기에 기술 검증이 필요하다. 이 앱은 전역 입력 감지와 다른 앱에 `Enter` 입력을 보내는 기능 때문에 macOS 보안/샌드박스/Accessibility 권한과 충돌할 가능성이 있다.

따라서 프로젝트의 첫 번째 마일스톤은 "예쁜 채찍"이 아니라 "Mac App Store 제출 가능한 형태로 입력 기능이 동작하는지"를 확인하는 것이다.

결론적으로 빌드는 두 갈래로 유지한다.

- `mac-app-store`: 샌드박스, StoreKit, App Store Review 대응을 우선
- `windows`: Windows Store 또는 직접 배포를 고려한 Win32 입력 구현

## 추천 폴더 구조

```text
whip/
  apps/
    desktop/
      src/
        app/
          App.tsx
          routes/
          settings/
        renderer/
          scene/
          whip/
          effects/
          materials/
          audio/
        input/
          gesture.ts
          focus-action.ts
        store/
          purchases.ts
          entitlements.ts
        styles/
      public/
      src-tauri/
        src/
          main.rs
          commands.rs
          platform/
            mod.rs
            macos.rs
            windows.rs
          purchases/
            mod.rs
            macos_storekit.rs
            windows_store.rs
          input/
            mod.rs
            enter.rs
          config/
            mod.rs
        capabilities/
          default.json
          mac-app-store.json
          windows.json
        entitlements/
          macos-app-store.plist
          macos-dev.plist
        tauri.conf.json
        tauri.mac-app-store.conf.json
        tauri.windows.conf.json
      package.json
      vite.config.ts
      tsconfig.json

  crates/
    whip-core/
      src/
        gesture.rs
        license.rs
        settings.rs
    whip-input-macos/
      src/
        lib.rs
        accessibility.rs
        enter.rs
    whip-input-windows/
      src/
        lib.rs
        send_input.rs
    whip-storekit/
      src/
        lib.rs

  packages/
    whip-physics/
      src/
        chain.ts
        constraints.ts
        crack-detector.ts
    whip-renderer/
      src/
        WhipMesh.ts
        WhipTrail.ts
        HitEffect.ts
        materials.ts
    whip-catalog/
      src/
        base-items.ts
        iap-products.ts

  platforms/
    mac-app-store/
      README.md
      review-notes.md
      app-store-connect.md
      privacy.md
      screenshots/
      product-ids.md
    windows/
      README.md
      store-listing.md
      installer.md
      code-signing.md
      screenshots/

  assets/
    icons/
    sounds/
    skins/
    handles/
    effects/

  docs/
    architecture.md
    input-security.md
    pricing.md
    roadmap.md

  scripts/
    build-mac-app-store.sh
    build-windows.sh
    generate-icons.sh
    package-assets.ts
```

## 폴더 역할

### `apps/desktop`

실제 Tauri 앱이다. 프론트엔드, Three.js 렌더러, Tauri Rust backend가 함께 들어간다.

`src-tauri` 안에는 플랫폼별 native command를 둔다. Tauri 설정 파일은 공통 설정과 플랫폼별 override로 나눈다.

### `crates`

Rust 네이티브 기능을 플랫폼별로 격리한다.

- `whip-core`: 플랫폼 중립 로직
- `whip-input-macos`: macOS 입력, 권한, Accessibility 검증
- `whip-input-windows`: Windows `Enter` 입력 전송
- `whip-storekit`: macOS App Store 인앱 결제 브리지

### `packages`

TypeScript 공유 모듈이다. 렌더링/물리/상품 카탈로그를 앱 코드에서 분리해 향후 확장과 테스트를 쉽게 한다.

### `platforms/mac-app-store`

Mac App Store 제출에 필요한 모든 문서를 모은다.

- 리뷰 노트
- 개인정보 처리 설명
- App Store Connect 메타데이터
- 인앱 결제 product id
- 스크린샷 체크리스트

### `platforms/windows`

Windows 배포 자료를 모은다. Windows Store와 직접 배포 중 어느 쪽으로 가도 재사용할 수 있게 한다.

## 1차 제품 범위

### 포함

- 투명 또는 반투명 오버레이 창
- WebGL 기반 3D 채찍 렌더링
- 마우스 드래그 기반 휘두르기
- 채찍 끝 속도/가속도 기반 crack 판정
- crack 발생 시 이전 포커스 위치에 `Enter`
- 트레이 메뉴
- 일시 정지/재개
- 감도 조절
- 기본 채찍 1종
- 기본 손잡이 1종
- 기본 휘두르기 효과 1종
- 기본 맞는 효과 1종
- 기본 사운드 1종

### 제외

- `Enter` 외 다른 키 입력
- 매크로 시퀀스
- 키보드 입력 기록
- 마우스 클릭 자동화
- 앱별 자동 규칙
- 온라인 계정
- 서버 동기화

초기 버전은 보안 리뷰를 위해 입력 기능을 의도적으로 좁게 유지한다.

## Mac App Store 빌드 계획

### 주요 제약

Mac App Store 빌드는 샌드박스와 리뷰 정책을 고려해야 한다. 가장 큰 리스크는 "다른 앱에 `Enter` 입력을 보내는 행위"다.

검증해야 할 항목:

- 샌드박스 상태에서 `Enter` 입력 전송 가능 여부
- Accessibility 권한 요청 UX
- App Review에서 허용 가능한 기능 설명
- Secure Input, 비밀번호 필드, 시스템 권한 화면에서 동작 제한 처리
- 권한이 없을 때 앱이 조용히 실패하지 않고 명확히 안내하는지

### App Store 포지셔닝

권장 설명:

> A playful focus action tool that lets you trigger Enter with a whip gesture.

피해야 할 표현:

- key injector
- macro tool
- automation bot
- input recorder
- global hook

### 인앱 결제

디지털 콘텐츠 확장이므로 Mac App Store 빌드에서는 StoreKit 기반 인앱 결제를 사용한다.

초기 product id 예시:

- `whip.skin.classic.dark`
- `whip.skin.neon.red`
- `whip.handle.obsidian`
- `whip.effect.spark.lightning`
- `whip.effect.hit.flash`
- `whip.sound.crack.arcade`
- `whip.bundle.starter_pack`

초기 출시에는 IAP를 넣지 않고, 앱 내부 카탈로그 구조만 IAP 대응으로 설계한다. 첫 업데이트에서 IAP를 추가하는 편이 리뷰 리스크를 줄인다.

## Windows 빌드 계획

Windows는 Mac App Store보다 입력 전송 구현이 단순할 가능성이 높다.

검증해야 할 항목:

- 일반 데스크톱 앱에 `Enter` 전송
- 관리자 권한 앱에 대한 제한
- UAC 화면에서 동작 제한
- 게임/보안 프로그램에서 차단되는 상황
- Windows Store 패키징 시 native 입력 API 사용 가능성

Windows 배포는 두 가지를 열어둔다.

- Windows Store
- 직접 배포 설치 파일

Windows 전용 IAP는 초기에는 보류한다. 먼저 유료 앱 단일 가격으로 출시하고, 확장 콘텐츠가 충분히 쌓이면 Microsoft Store add-on 또는 앱 내 자체 결제 가능성을 검토한다.

## 개발 마일스톤

### M0. Mac App Store 입력 검증

목표: Mac App Store 계획이 가능한지 초기에 판정한다.

작업:

- 최소 Tauri 앱 생성
- macOS sandbox 빌드 설정
- Accessibility 권한 요청 플로우 작성
- `Enter` 단일 입력 전송 spike
- 권한 없음/거부/보안 필드 동작 확인
- 리뷰 노트 초안 작성

완료 기준:

- 일반 텍스트 입력 앱에서 `Enter` 전송 성공
- 권한 미승인 상태 처리 가능
- Mac App Store 제출 가능성에 대한 go/no-go 판단 문서화

### M1. 3D 채찍 프로토타입

목표: 제품의 손맛을 만든다.

작업:

- Three.js 씬 구성
- 채찍 chain physics 구현
- 마우스 드래그로 손잡이 제어
- tube/ribbon 기반 채찍 mesh 구현
- trail, spark, hit flash 기본 효과 구현
- crack detector 구현

완료 기준:

- 60fps에 가깝게 동작
- 빠른 휘두르기와 느린 움직임이 구분됨
- crack 판정이 과도하게 오작동하지 않음

### M2. Tauri 제품 셸

목표: 유틸리티 앱처럼 사용할 수 있게 만든다.

작업:

- 투명/반투명 오버레이 창
- always-on-top 옵션
- 트레이 메뉴
- enable/disable 토글
- 감도 설정
- 사운드 볼륨 설정
- 시작 시 실행 옵션 검토

완료 기준:

- 앱을 켜고 끄는 흐름이 명확함
- 오버레이가 작업을 방해하지 않음
- 설정이 재시작 후 유지됨

### M3. Mac App Store 준비

목표: USD 1.99 유료 앱으로 제출 가능한 상태를 만든다.

작업:

- App Sandbox 설정
- entitlements 정리
- privacy 문서 작성
- App Store Connect 메타데이터 작성
- 스크린샷 제작
- 리뷰 노트 작성
- 크래시/권한 실패 케이스 정리
- 유료 앱 가격 USD 1.99 설정

완료 기준:

- release 빌드 생성
- 로컬 설치 후 주요 기능 검증
- App Store 심사용 설명 문서 준비

### M4. Windows 빌드

목표: Windows 사용자를 위한 별도 배포 라인을 만든다.

작업:

- Windows `Enter` 전송 구현
- Windows 오버레이 창 테스트
- code signing 검토
- Store 제출 가능성 검토
- 직접 배포 installer 검토

완료 기준:

- Windows에서 핵심 기능 동작
- Windows 전용 제한 사항 문서화
- 배포 방식 결정

### M5. 인앱 결제 확장

목표: 시각/사운드 커스터마이징을 유료 확장으로 만든다.

작업:

- 아이템 카탈로그 구조 확정
- StoreKit product id 등록
- purchase/restore flow 구현
- 기본/유료 아이템 entitlement 분리
- preview UI 구현
- 사운드/효과/스킨 asset packaging

완료 기준:

- 구매, 복원, 환불 상태에 대응
- 구매하지 않은 아이템은 preview만 가능
- 오프라인 상태에서도 기존 구매 상태를 안정적으로 처리

## 기술 선택

### Frontend

- TypeScript
- Vite
- Three.js
- Zustand 또는 작은 custom store

React는 설정 화면과 상태 UI가 늘어날 가능성을 고려하면 사용하는 편이 좋다. 단, 렌더링 루프와 물리 루프는 React 상태와 분리한다.

### Native

- Tauri 2
- Rust
- Swift bridge for StoreKit/macOS-specific APIs if needed
- Windows `windows` crate

### Rendering

- Three.js WebGLRenderer
- MeshLine 또는 custom ribbon geometry
- ShaderMaterial은 M1 이후 필요할 때 도입
- postprocessing은 성능 확인 후 제한적으로 사용

### Physics

- TypeScript 구현으로 시작
- 필요하면 Rust/WASM로 이전
- 초기 목표는 정확한 시뮬레이션보다 조작감

## 리스크와 대응

### Mac App Store에서 입력 전송 거절

대응:

- M0에서 가장 먼저 검증
- 입력 기능을 `Enter`로 제한
- 권한 요청과 기능 설명을 투명하게 작성
- 실패 시 Mac App Store 빌드는 "gesture visualizer + sound/effects"로 축소할지, 직접 배포로 전환할지 결정

### WebView WebGL 성능 문제

대응:

- 저사양 모드 제공
- particle 수 제한
- postprocessing 옵션화
- 렌더링 해상도 스케일 조절

### 오작동으로 원치 않는 Enter 발생

대응:

- 기본 감도를 보수적으로 설정
- crack 후 cooldown
- 앱별/상태별 pause shortcut
- 명확한 on/off 상태 표시

### IAP가 장난감처럼 보이는 문제

대응:

- 기본 앱만으로 완성도 있게 제공
- IAP는 기능 잠금보다 취향 커스터마이징에 집중
- 구매 전 preview 제공

## 가격 전략

초기 가격은 USD 1.99로 설정한다.

이 가격은 진입 장벽이 낮고, 장난감/유틸리티 사이의 제품 포지션과 맞는다. 단, Mac App Store 수수료와 Apple Developer Program 비용을 고려하면 큰 매출보다 초기 검증과 리뷰 확보를 목표로 한다.

확장 매출은 다음 업데이트에서 IAP로 만든다.

- 단일 cosmetic: USD 0.99
- 효과/사운드 pack: USD 1.99
- starter bundle: USD 2.99

## 초기 작업 순서

1. Tauri 데스크톱 앱 scaffold
2. `platforms/mac-app-store`와 `platforms/windows` 문서 폴더 생성
3. M0 macOS 입력 검증
4. Three.js 채찍 프로토타입
5. Tauri overlay/window UX
6. Mac App Store 제출 준비
7. Windows 빌드 추가
8. IAP 확장

## 다음 결정 사항

- 앱 이름
- Mac App Store에서 사용할 카테고리
- 기본 채찍 비주얼 방향
- crack 판정 민감도 기본값
- 앱이 항상 화면 위에 떠야 하는지, 필요할 때만 나타나야 하는지
- Mac App Store가 막힐 경우 직접 배포로 전환할 기준
