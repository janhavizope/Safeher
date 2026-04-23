# SafeHer Mobile App

React Native cross-platform (Android / iOS) mobile app for the SafeHer Safety Route Finder using Mappls APIs.

## Features

- Real-time GPS tracking
- Destination search via Mappls Autosuggest
- Safe route calculation prioritizing lower-risk paths
- Turn-by-turn navigation
- Nearby safety landmarks (police, hospital, fire station)
- SOS emergency location sharing
- Auto-reroute when deviating from planned path
- Dark mode for low-light safety
- Offline support (coming soon)

## Setup

### Prerequisites

- Node.js >= 16
- React Native CLI: `npm install -g react-native-cli`
- Android Studio (for Android) or Xcode (for iOS)
- Mappls Mobile SDK key from https://auth.mappls.com/console

### Install Dependencies

```bash
cd mobile
npm install
# or
yarn install
```

### Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Mappls credentials:
   ```
   MAPPLS_MOBILE_SDK_KEY=your_mobile_sdk_key_from_console
   MAPPLS_CLIENT_ID=optional_client_id
   MAPPLS_CLIENT_SECRET=optional_client_secret
   ```

### Run on Android

```bash
npm run android
```

Requires:
- Android Studio installed
- Android emulator running or physical device connected
- SHA-256 fingerprint registered in Mappls Console

### Run on iOS

```bash
npm run ios
```

Requires:
- Xcode installed
- iOS simulator running or physical device connected

## Project Structure

```
mobile/
  ├── src/
  │   ├── screens/
  │   │   ├── MapScreen.tsx          # Main map + route UI
  │   │   ├── SearchScreen.tsx       # Destination search
  │   │   ├── DirectionsScreen.tsx   # Turn-by-turn nav
  │   │   └── SettingsScreen.tsx     # Preferences (night mode, etc)
  │   ├── components/
  │   │   ├── MapView.tsx            # Mappls map wrapper
  │   │   ├── RouteCard.tsx          # Route summary
  │   │   ├── NearbyLandmarks.tsx    # Safety points
  │   │   └── SOSButton.tsx          # Emergency button
  │   ├── services/
  │   │   ├── mappls.ts             # Mappls API client
  │   │   ├── location.ts           # Geolocation service
  │   │   └── storage.ts            # Local data persistence
  │   ├── hooks/
  │   │   ├── useLocation.ts        # GPS tracking hook
  │   │   ├── useRoute.ts           # Route planning hook
  │   │   └── useDarkMode.ts        # Theme hook
  │   ├── utils/
  │   │   ├── polyline.ts           # Polyline decode/encode
  │   │   ├── distance.ts           # Distance calculations
  │   │   └── risk.ts               # Route risk scoring
  │   ├── App.tsx                    # Root navigation
  │   └── index.ts
  ├── android/
  │   ├── app/
  │   │   └── src/
  │   │       ├── main/
  │   │       │   ├── AndroidManifest.xml
  │   │       │   └── java/com/safeher/
  │   │       │       └── MainActivity.java
  │   │       └── debug/
  │   │           └── AndroidManifest.xml
  │   ├── gradle.properties
  │   └── build.gradle
  ├── ios/
  │   ├── SafeherMobile/
  │   │   ├── Info.plist
  │   │   └── AppDelegate.m
  │   ├── SafeherMobile.xcodeproj/
  │   └── Podfile
  ├── package.json
  ├── .env.example
  ├── .env              (create locally, git-ignored)
  └── README.md
```

## Getting Mappls Keys

### Android Credentials

1. Open Android Studio or run:
   ```bash
   keytool -list -v -alias androiddebugkey -keystore "%USERPROFILE%\.android\debug.keystore" -storepass android -keypass android
   ```

2. Copy the **SHA256** fingerprint.

3. In Mappls Console:
   - Create Mobile app → Android
   - Package Name: `com.safeher.app`
   - Signing Certificate (SHA256): Paste the fingerprint
   - Save to get Mobile SDK Key

### iOS Credentials

1. In Xcode, open `ios/SafeherMobile.xcodeproj`
2. Note your Bundle ID (typically `com.safeher.app`)
3. In Mappls Console:
   - Create Mobile app → iOS
   - Bundle ID: `com.safeher.app`
   - Save to get Mobile SDK Key

## API Integration

All Mappls API calls route through the backend server to keep keys secure:

- `POST /api/mappls/directions` - Route calculation
- `GET /api/mappls/autosuggest` - Place search
- `GET /api/mappls/nearby` - Nearby landmarks

Backend is at: `http://localhost:3000` (dev) or your production URL.

## Testing Locally

1. Start backend:
   ```bash
   cd ..
   npm run dev
   ```

2. Start mobile:
   ```bash
   npm run android
   # or
   npm run ios
   ```

3. On app launch:
   - Allow location permission
   - Search for a destination
   - View calculated route
   - Test SOS sharing

## Dark Mode

Toggle in Settings or use device system theme.

Night mode reduces screen brightness and uses dark colors for safety during low-light conditions.

## Build for Production

### Android Release APK

```bash
cd android
./gradlew assembleRelease
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### iOS App Bundle

```bash
# In Xcode or via command line:
xcodebuild -scheme SafeherMobile -configuration Release archive -archivePath ./build/SafeherMobile.xcarchive
xcodebuild -exportArchive -archivePath ./build/SafeherMobile.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath ./build/Release
```

## Contributing

See ../CONTRIBUTING.md (if exists) or follow the main project guidelines.

## License

MIT
