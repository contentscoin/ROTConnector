#!/bin/bash
# Android Release Build Script
# Prerequisites:
#   - Android SDK installed with build-tools
#   - Java 17+ installed
#   - android/keystore.properties configured (copy from keystore.properties.example)
#   - OR environment variables set: ANDROID_KEYSTORE_FILE, ANDROID_KEYSTORE_PASSWORD,
#     ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD

set -e

echo "=== 알비연 링크 Android Release Build ==="

# Step 1: Build the web app
echo "[1/4] Building web assets..."
pnpm build

# Step 2: Sync Capacitor
echo "[2/4] Syncing Capacitor..."
npx cap sync android

# Step 3: Clean previous build
echo "[3/4] Cleaning previous build..."
cd android
./gradlew clean

# Step 4: Build release AAB (Android App Bundle for Play Store)
echo "[4/4] Building release bundle..."
./gradlew bundleRelease

echo ""
echo "=== Build Complete ==="
echo "AAB location: android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "To also build an APK for testing:"
echo "  cd android && ./gradlew assembleRelease"
echo "  APK location: android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "To upload to Play Store, use the AAB file with Google Play Console"
echo "or configure Fastlane supply for automated uploads."
