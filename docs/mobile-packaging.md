# Mobile packaging guide (Android & iOS)

This document describes how to prepare, package, and distribute Ikki with Tauri Mobile for Android and iOS.

## High-level plan

1. Install platform toolchains and Tauri Mobile prerequisites.
2. Initialize the mobile projects (one-time per platform).
3. Configure signing assets for release builds.
4. Build, test on device/emulator, and iterate.
5. Produce distributable artifacts for Play Store / App Store.

## Prerequisites

- Tauri Mobile tooling: `npm install` (includes `@tauri-apps/cli`).
- Rust targets:
  - Android: `rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android`
  - iOS: `rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios`
- Platform SDKs:
  - **Android:** Android Studio (+ Android SDK & NDK r25c or newer), Java 17, and an Android 12+ emulator or device with USB debugging.
  - **iOS:** Xcode 15+, CocoaPods, an iOS 17+ simulator or physical device (Apple Developer Program required for App Store distribution).
- Environment setup:
  - Android: ensure `$ANDROID_HOME` / `$ANDROID_SDK_ROOT` are set and `platform-tools` on your `PATH`.
  - iOS: run `sudo xcode-select -s /Applications/Xcode.app` and accept Xcode license.

## One-time initialization

From repo root after `npm install`:

- Android: `npm run tauri:android:init`
- iOS: `npm run tauri:ios:init`

This creates `src-tauri/gen/android` and `src-tauri/gen/ios` projects with Gradle/Xcode scaffolding and links the Tauri binary.

## Iteration loop

- Android dev on device/emulator: `npm run tauri:android:dev`
- iOS dev on simulator/device: `npm run tauri:ios:dev`
- Open native projects:
  - Android Studio: `npm run tauri:android:open`
  - Xcode: `npm run tauri:ios:open`

Hot reload is not available; Tauri performs incremental builds for the Rust core and bundles the Svelte dist output.

## Release builds

- Android bundle (AAB): `npm run tauri:android:build`
  - Configure signing in `src-tauri/gen/android/app/keystore.properties` or via Gradle variables (store file, passwords, key alias).
  - Output: `src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab`
- iOS IPA: `npm run tauri:ios:build`
  - Configure signing in Xcode (team, bundle ID, profiles).
  - Output: `src-tauri/gen/ios/target/universal/release/bundle/Ikki.app` (archive with Xcode Organizer to produce the `.ipa`).

## Distribution notes

- **Bundle identifiers:** Update `identifier` in `src-tauri/tauri.conf.json` if store-specific IDs are needed. Keep consistent with native project settings.
- **App icons & splash:** Provide platform-specific assets in `src-tauri/icons/` and regenerate native assets after changes (`npm run tauri:android:init` or update via native tools).
- **Environment config:** Use Tauri `tauri.conf.json` for app metadata; avoid embedding secrets in the mobile projects. Use platform keychains / keystores for signing only.
- **Store submissions:**
  - Android: upload the `.aab` to Play Console, create closed testing track first, and set required permissions/privacy details.
  - iOS: export `.ipa` via Xcode Organizer, upload with Transporter or Xcode, and configure App Store Connect metadata.

## CI packaging workflows

GitHub Actions workflows live in `.github/workflows/` to exercise the mobile pipelines:

- `android-packages.yml` provisions the Android SDK/NDK, initializes the Tauri mobile project if needed, builds a debug APK (`npm run tauri:android:build -- --debug --apk true --aab false`), and uploads it as an artifact for sideloading.
- `ios-packages.yml` targets the iOS simulator on `macos-14`, initializes the project if missing, builds a debug bundle for the simulator architecture (`--target aarch64-sim`), and publishes the `.app` bundle as an artifact.
- For signed release artifacts, add the appropriate keystores or Apple signing assets as encrypted secrets and extend the workflows with the signing flags required by each platform.
- The Android workflow installs NDK `25.2.9519653` via `sdkmanager` to avoid relying on third-party actions; update the version there if you need newer toolchains.

## Troubleshooting

- If mobile builds fail after Rust toolchain updates, clean native targets:
  - Android: `rm -rf src-tauri/gen/android/app/.gradle src-tauri/gen/android/app/build`
  - iOS: `rm -rf src-tauri/gen/ios/target`
- Verify NDK/SDK paths in Android Studio. For signing issues, ensure keystore passwords are set via environment or Gradle properties.
- For iOS codesign errors, confirm the correct development team and provisioning profile in the Xcode project settings.
