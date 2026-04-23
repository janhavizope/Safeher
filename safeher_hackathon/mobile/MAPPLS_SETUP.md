# Mappls Setup Guide for SafeHer (Web + Mobile)

This guide walks you through creating credentials in Mappls Console for both your web app and mobile apps.

## Step 1: Create Web App Credentials

These are used by your website at `http://localhost:3000/route`

1. Go to https://auth.mappls.com/console
2. Sign in with your account
3. Click "Your Apps" → "Web" card → "Create App"
4. Fill in:
   - App Name: `SafeHer Web`
   - Description: `Safety Route Finder Web App`
5. Click Create
6. Open the app details page
7. Go to "Keys" section and copy:
   - **REST API Key** ← use this in web .env
   - Map SDK Key (if shown separately, optional)
8. Go to "APIs" section and enable:
   - ✓ Places Search (Autosuggest)
   - ✓ Nearby Search
   - ✓ Directions / Routing
   - ✓ Web Maps SDK
9. Save

### Put Web Key in .env

In your project root `.env`:

```
MAPPLS_REST_API_KEY=YOUR_WEB_REST_KEY_HERE
MAPPLS_MAP_SDK_KEY=
MAPPLS_CLIENT_ID=
MAPPLS_CLIENT_SECRET=
```

Then restart:
```bash
pnpm dev
```

Test it works:
```
http://localhost:3000/api/maps/config
http://localhost:3000/route
```

---

## Step 2: Create Android Mobile App Credentials

For your Android app in `mobile/`.

### Get Android SHA-256 Fingerprint

Open terminal and run:

```bash
keytool -list -v -alias androiddebugkey -keystore "%USERPROFILE%\.android\debug.keystore" -storepass android -keypass android
```

Look for the line:
```
SHA256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:...
```

Copy the entire hash (remove colons for some setups, or keep them—Mappls will guide).

### Register in Mappls Console

1. Go to https://auth.mappls.com/console
2. Click "Your Apps" → "Mobile" card → "Create App"
3. Choose platform: **Android**
4. Fill in:
   - App Name: `SafeHer Android`
   - Package Name: `com.safeher.app`
   - SHA-256 Fingerprint: Paste your debug key SHA256
5. Click Create
6. Open the app details
7. Copy:
   - **Mobile SDK Key** ← use in `mobile/.env`
   - Client ID / Client Secret (if shown, optional for OAuth)
8. Enable APIs:
   - ✓ Maps SDK
   - ✓ Directions / Routing
   - ✓ Autosuggest
   - ✓ Nearby Places

### Put Android Key in mobile/.env

In `mobile/.env`:

```
MAPPLS_MOBILE_SDK_KEY=YOUR_ANDROID_MOBILE_SDK_KEY
MAPPLS_CLIENT_ID=
MAPPLS_CLIENT_SECRET=
API_BASE_URL=http://localhost:3000
```

---

## Step 3: Create iOS Mobile App Credentials

For your iOS app in `mobile/`.

### Get iOS Bundle ID

1. Open `mobile/ios/SafeherMobile.xcodeproj` in Xcode
2. Select target "SafeherMobile"
3. Go to Build Settings
4. Search for "Bundle Identifier"
5. Default is typically: `com.safeher.app` or `org.reactjs.native.example.safehermobile`
6. Copy this value

### Register in Mappls Console

1. Go to https://auth.mappls.com/console
2. Click "Your Apps" → "Mobile" card → "Create App"
3. Choose platform: **iOS**
4. Fill in:
   - App Name: `SafeHer iOS`
   - Bundle ID: `com.safeher.app` (or your actual bundle ID)
5. Click Create
6. Open the app details
7. Copy:
   - **Mobile SDK Key** ← use in `mobile/.env`
8. Enable APIs:
   - ✓ Maps SDK
   - ✓ Directions / Routing
   - ✓ Autosuggest
   - ✓ Nearby Places

### Put iOS Key in mobile/.env

In `mobile/.env`, update:

```
MAPPLS_MOBILE_SDK_KEY=YOUR_IOS_MOBILE_SDK_KEY
# (or create a separate .env.android and .env.ios if they differ)
```

---

## Summary Table

| Platform | Credentials Created | Where to Get Key | Where to Put Key |
|----------|----------------------|------------------|------------------|
| **Web** | Web App in Mappls | REST API Key | `/` root `.env` → `MAPPLS_REST_API_KEY` |
| **Android** | Mobile (Android) app in Mappls | Mobile SDK Key | `mobile/.env` → `MAPPLS_MOBILE_SDK_KEY` |
| **iOS** | Mobile (iOS) app in Mappls | Mobile SDK Key | `mobile/.env` → `MAPPLS_MOBILE_SDK_KEY` |

---

## Quick Test

### Web

```bash
pnpm dev
# Navigate to http://localhost:3000/route
# Search for destination, verify route draws
```

### Android

```bash
cd mobile
npm install
npm run android
# Follow React Native CLI prompts
# On emulator/device: Allow location, search destination
```

### iOS

```bash
cd mobile
npm install
npm run ios
# Xcode simulator opens
# On simulator: Allow location, search destination
```

---

## Troubleshooting

**"Mappls REST key missing"** on web
- Check `.env` has `MAPPLS_REST_API_KEY=your_key` (not empty)
- Restart `pnpm dev`
- Verify at http://localhost:3000/api/maps/config

**"Mobile SDK key not recognized"** on mobile
- Verify package name or bundle ID matches Mappls console registration
- Check SHA-256 fingerprint is correct for Android
- For iOS, verify Bundle ID in Xcode matches console entry

**"OAuth token failed"** 
- Only set `MAPPLS_CLIENT_ID` and `MAPPLS_CLIENT_SECRET` if your account requires OAuth
- Most free accounts use direct REST key; leave those fields empty

---

## Next Steps

1. Create all three app types in Mappls Console (Web, Android, iOS)
2. Copy credentials to `.env` files
3. Run `pnpm dev` for web
4. Run `npm run android` or `npm run ios` for mobile
5. Test destination search and route planning on each platform
