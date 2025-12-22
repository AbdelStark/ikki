# Mobile Packaging Guide (Android & iOS)

This document describes how to prepare, package, and distribute Ikki with Tauri Mobile for Android and iOS.

## Overview

Ikki uses Tauri 2's mobile support to build native iOS and Android applications from the same Svelte + Rust codebase. The mobile builds use:

- **Frontend:** Vite dev server with mobile-accessible host binding
- **Backend:** Rust compiled to platform-specific targets
- **TLS:** `ring` crypto backend on mobile (better compatibility than `aws-lc-rs`)

## Prerequisites

### Common Requirements

- Node.js 18+ and npm
- Rust 1.81+ via rustup
- Tauri CLI: `cargo install tauri-cli --version "^2.0"`

### Rust Targets

Install the required cross-compilation targets:

```bash
# iOS targets
rustup target add aarch64-apple-ios        # Physical devices
rustup target add aarch64-apple-ios-sim    # Apple Silicon simulators
rustup target add x86_64-apple-ios         # Intel simulators

# Android targets
rustup target add aarch64-linux-android    # ARM64 devices (most common)
rustup target add armv7-linux-androideabi  # ARMv7 devices
rustup target add x86_64-linux-android     # x86_64 emulators
rustup target add i686-linux-android       # x86 emulators
```

### iOS-Specific

- **macOS** (required for iOS development)
- **Xcode 15+** with Command Line Tools
- **CocoaPods:** `sudo gem install cocoapods`
- Select Xcode: `sudo xcode-select -s /Applications/Xcode.app`
- Accept Xcode license: `sudo xcodebuild -license accept`

### Android-Specific

- **Android Studio** with:
  - Android SDK (API 24+)
  - Android NDK r25c (25.2.9519653) or newer
  - Platform Tools
- **Java 17** (JDK)
- Environment variables:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
  export ANDROID_SDK_ROOT=$ANDROID_HOME
  export NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  ```

## Project Initialization

Initialize the mobile projects (one-time setup per platform):

```bash
# Install dependencies first
npm install

# Initialize iOS project (macOS only)
npm run tauri:ios:init

# Initialize Android project
npm run tauri:android:init
```

This creates:
- `src-tauri/gen/apple/` - Xcode project and iOS configuration
- `src-tauri/gen/android/` - Gradle project and Android configuration

## Development Workflow

### iOS Development

```bash
# Run on simulator (debug mode with live rebuild)
npm run tauri:ios:dev

# Open in Xcode for advanced configuration
npm run tauri:ios:open
```

The dev command will:
1. Start the Vite dev server
2. Build the Rust backend for iOS simulator
3. Launch the app in the iOS Simulator

### Android Development

```bash
# Run on emulator or connected device (debug mode)
npm run tauri:android:dev

# Open in Android Studio
npm run tauri:android:open
```

### Mobile Dev Server

For development on physical devices, the Vite server must be accessible over the network. Tauri handles this automatically via `TAURI_DEV_HOST`:

```typescript
// vite.config.ts - already configured
server: {
  host: process.env.TAURI_DEV_HOST || "localhost",
}
```

## Release Builds

### iOS Release

```bash
npm run tauri:ios:build
```

Output: `src-tauri/gen/apple/build/` directory

For App Store distribution:
1. Open in Xcode: `npm run tauri:ios:open`
2. Configure signing (Team, Bundle ID, Provisioning Profile)
3. Product → Archive
4. Distribute via App Store Connect

### Android Release

```bash
# Build AAB for Play Store
npm run tauri:android:build

# Build APK for sideloading
npm run tauri:android:build -- --apk
```

Output locations:
- AAB: `src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab`
- APK: `src-tauri/gen/android/app/build/outputs/apk/`

For signed releases, configure `src-tauri/gen/android/keystore.properties`:
```properties
storeFile=path/to/keystore.jks
storePassword=your_store_password
keyAlias=your_key_alias
keyPassword=your_key_password
```

## CI/CD Workflows

GitHub Actions workflows are configured for automated mobile builds:

### iOS Workflow (`.github/workflows/ios-packages.yml`)

- Runs on `macos-14` (Apple Silicon)
- Builds for iOS Simulator (`aarch64-apple-ios-sim`)
- Uploads `.app` bundle as artifact
- Triggered on push/PR affecting relevant paths

### Android Workflow (`.github/workflows/android-packages.yml`)

- Runs on `ubuntu-latest`
- Installs Android SDK, NDK 25.2.9519653, Java 17
- Builds debug APK for all architectures
- Uploads APK as artifact
- Triggered on push/PR affecting relevant paths

### Manual Triggers

Both workflows support `workflow_dispatch` for manual builds from the GitHub Actions UI.

### Signed Release Builds

To add signing for release artifacts:

1. Add secrets to your repository:
   - iOS: Export signing certificate and provisioning profile as base64-encoded secrets
   - Android: Add keystore file, passwords, and key alias as secrets

2. Extend workflows with signing steps (see Tauri documentation for platform-specific instructions)

## Configuration Reference

### tauri.conf.json

```json
{
  "bundle": {
    "iOS": {
      "developmentTeam": "YOUR_TEAM_ID",
      "minimumSystemVersion": "13.0"
    },
    "android": {
      "minSdkVersion": 24
    }
  }
}
```

### Cargo.toml (TLS Configuration)

The project uses platform-specific TLS backends for better compatibility:

```toml
# Mobile: use ring (better cross-compilation support)
[target.'cfg(any(target_os = "ios", target_os = "android"))'.dependencies]
rustls = { version = "0.23", features = ["ring"] }

# Desktop: use aws-lc-rs (better performance)
[target.'cfg(not(any(target_os = "ios", target_os = "android")))'.dependencies]
rustls = { version = "0.23", features = ["aws-lc-rs"] }
```

## NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run tauri:ios:init` | Initialize iOS project |
| `npm run tauri:ios:dev` | Run on iOS simulator |
| `npm run tauri:ios:build` | Build iOS release |
| `npm run tauri:ios:open` | Open Xcode with iOS project |
| `npm run tauri:android:init` | Initialize Android project |
| `npm run tauri:android:dev` | Run on Android emulator/device |
| `npm run tauri:android:build` | Build Android release |
| `npm run tauri:android:open` | Open Android Studio with project |

## Troubleshooting

### iOS Issues

**Build fails after Rust update:**
```bash
rm -rf src-tauri/gen/apple/build
rm -rf src-tauri/gen/apple/Pods
npm run tauri:ios:init
```

**Codesign errors:**
- Verify development team in Xcode project settings
- Check provisioning profile matches bundle ID
- Ensure certificates are valid in Keychain Access

**Simulator not found:**
- Open Xcode → Settings → Platforms → Install required simulator

### Android Issues

**Build fails with NDK error:**
```bash
# Verify NDK installation
ls $ANDROID_HOME/ndk/

# Install specific version
sdkmanager "ndk;25.2.9519653"
```

**Gradle sync failed:**
```bash
rm -rf src-tauri/gen/android/.gradle
rm -rf src-tauri/gen/android/app/build
npm run tauri:android:init
```

**Device not detected:**
- Enable USB debugging on device
- Run `adb devices` to verify connection
- Accept debugging prompt on device

### General Issues

**TLS/SSL errors on mobile:**
- The project uses `ring` on mobile which has broader compatibility
- If issues persist, check network configuration and certificate validity

**Large binary size:**
- Release builds are stripped automatically
- Consider enabling LTO in Cargo.toml for further size reduction:
  ```toml
  [profile.release]
  lto = true
  ```

## Store Distribution Checklist

### iOS (App Store)

- [ ] Apple Developer Program membership ($99/year)
- [ ] Configure bundle identifier in `tauri.conf.json`
- [ ] Set development team ID
- [ ] Create App Store Connect entry
- [ ] Prepare app icons (1024x1024 for store)
- [ ] Write privacy policy
- [ ] Build, archive, and upload via Xcode

### Android (Play Store)

- [ ] Google Play Developer account ($25 one-time)
- [ ] Generate release keystore and keep secure
- [ ] Configure signing in Gradle
- [ ] Create Play Console entry
- [ ] Prepare app icons and feature graphics
- [ ] Write privacy policy
- [ ] Build signed AAB and upload

## Related Documentation

- [Tauri Mobile Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Tauri iOS Guide](https://v2.tauri.app/distribute/app-store/)
- [Tauri Android Guide](https://v2.tauri.app/distribute/google-play/)
