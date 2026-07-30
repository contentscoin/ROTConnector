#!/bin/bash
# iOS Release Build Script
# Prerequisites:
#   - macOS with Xcode 15+ installed
#   - Valid Apple Developer account
#   - Provisioning profile and signing certificate configured in Xcode
#   - CocoaPods installed (gem install cocoapods)

set -e

echo "=== 알비연 링크 iOS Release Build ==="

# Step 1: Build the web app
echo "[1/5] Building web assets..."
pnpm build

# Step 2: Sync Capacitor
echo "[2/5] Syncing Capacitor..."
npx cap sync ios

# Step 3: Install CocoaPods dependencies
echo "[3/5] Installing CocoaPods..."
cd ios/App
pod install
cd ../..

# Step 4: Archive the app
echo "[4/5] Archiving..."
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath build/AlbiyeonLink.xcarchive \
  archive \
  -allowProvisioningUpdates

# Step 5: Export IPA
echo "[5/5] Exporting IPA..."
xcodebuild -exportArchive \
  -archivePath build/AlbiyeonLink.xcarchive \
  -exportPath build/ipa \
  -exportOptionsPlist ios/App/ExportOptions.plist \
  -allowProvisioningUpdates

echo ""
echo "=== Build Complete ==="
echo "Archive: build/AlbiyeonLink.xcarchive"
echo "IPA: build/ipa/"
echo ""
echo "To upload to App Store Connect:"
echo "  xcrun altool --upload-app -f build/ipa/App.ipa -t ios"
echo "  OR use Transporter app / Fastlane deliver"
echo ""
echo "Note: Ensure ExportOptions.plist is configured with your"
echo "team ID and provisioning profile before running this script."
