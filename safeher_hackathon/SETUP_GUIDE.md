# SafeHer: Complete Setup & Next Steps (Web + Mobile)

## What's Done ✅

Your SafeHer app now has:

### **Web App** (React + TypeScript)
- Location: `/` root folder
- Map page: http://localhost:3000/route
- Features: GPS tracking, destination search, safe routing, turn-by-turn, SOS button, nearby landmarks, night mode
- **Status**: Code complete, needs Mappls REST API key

### **Mobile App** (React Native for Android + iOS)
- Location: `mobile/` folder
- Features: Same as web (GPS, search, routing, SOS)
- **Status**: Scaffold complete, needs Mappls Mobile SDK keys

### **Backend API** (Express.js + Mappls Proxy)
- Endpoints: `/api/mappls/autosuggest`, `/api/mappls/nearby`, `/api/mappls/directions`
- **Status**: Live at http://localhost:3000, working (returns 400 for missing keys, as expected)

### **Database** (PostgreSQL)
- Status: code converted to PostgreSQL + node-postgres
- Next step: create a new PostgreSQL service in Aiven and set `DATABASE_URL` to its connection string
- Note: existing MySQL rows are not migrated automatically

---

## Your Next Steps (Choose ONE Path)

### **Path A: Get Web App Working First** ⭐ (RECOMMENDED)

This validates everything works, then mobile is straightforward.

#### Step 1: Create Web App in Mappls Console

1. Go to https://auth.mappls.com/console
2. Sign in
3. Click "Your Apps" → "Web" → "Create App"
4. Fill in:
   - App Name: `SafeHer Web`
   - Description: `Safety Route Finder Web App`
5. Click Create
6. Go to "Keys" section
7. **Copy the REST API Key** (looks like `eyJhbGci...` or similar long string)

#### Step 2: Add Key to Web .env

1. Open `.env` in your root folder
2. Find: `MAPPLS_REST_API_KEY=`
3. Replace with: `MAPPLS_REST_API_KEY=YOUR_KEY_HERE` (paste the key you copied)
4. Save file

#### Step 3: Restart Dev Server

```bash
# Press Ctrl+C in terminal to stop current pnpm dev
pnpm dev
```

#### Step 4: Test Web App

Open browser: http://localhost:3000/route

**Test these actions:**
- ✓ Map loads with your current location (blue dot)
- ✓ Search box works (try "hospital")
- ✓ Autocomplete suggestions appear
- ✓ Click a suggestion → destination marker appears
- ✓ Route draws on map (route color line)
- ✓ Bottom panel shows distance + ETA
- ✓ Turn-by-turn instructions appear
- ✓ SOS button responds (or copies location)
- ✓ Night mode toggle works (toggle in top-right)

**If you see "Mappls REST key missing"**:
- Make sure you saved `.env` file
- Restart `pnpm dev`
- Refresh browser tab

---

### **Path B: Skip Web, Go Straight to Mobile**

If you want to test mobile app first instead:

#### For Android

1. **Get Android SHA-256:**
   ```bash
   keytool -list -v -alias androiddebugkey -keystore "%USERPROFILE%\.android\debug.keystore" -storepass android -keypass android
   ```
   Look for line: `SHA256: AA:BB:CC:...` (copy the entire hash)

2. **Create Android App in Mappls Console:**
   - Go to https://auth.mappls.com/console
   - Click "Your Apps" → "Mobile" → "Create App"
   - Platform: **Android**
   - App Name: `SafeHer Android`
   - Package Name: `com.safeher.app`
   - SHA-256: Paste your fingerprint
   - Click Create
   - Copy: **Mobile SDK Key**

3. **Add Key to mobile/.env:**
   ```
   MAPPLS_MOBILE_SDK_KEY=YOUR_ANDROID_KEY_HERE
   MAPPLS_CLIENT_ID=
   MAPPLS_CLIENT_SECRET=
   API_BASE_URL=http://localhost:3000
   ```

4. **Start Mobile App:**
   ```bash
   # Make sure pnpm dev is still running in another terminal
   cd mobile
   npm install
   npm run android
   ```
   (Requires Android Studio + emulator or device connected)

#### For iOS

1. **Get Bundle ID from Xcode:**
   - Open `mobile/ios/SafeherMobile.xcodeproj`
   - Select target → Build Settings → Search "Bundle"
   - Copy the value (usually `com.safeher.app` or `org.reactjs...app`)

2. **Create iOS App in Mappls Console:**
   - https://auth.mappls.com/console
   - "Your Apps" → "Mobile" → "Create App"
   - Platform: **iOS**
   - App Name: `SafeHer iOS`
   - Bundle ID: Paste your bundle ID
   - Click Create
   - Copy: **Mobile SDK Key**

3. **Add Key to mobile/.env:**
   ```
   MAPPLS_MOBILE_SDK_KEY=YOUR_IOS_KEY_HERE
   ```

4. **Start Mobile App:**
   ```bash
   cd mobile
   npm install
   npm run ios
   ```

---

## DO BOTH (Web + Both Mobile Platforms)

If you want all three (recommended for production):

| Platform | App Type | Create In Console | Key To Get | Where To Put |
|----------|----------|----------------------------|-----|------|
| **Website** | Web | "Your Apps" > **Web** | REST API Key | Root `.env` → `MAPPLS_REST_API_KEY` |
| **Android** | Mobile | "Your Apps" > **Mobile** → Android | Mobile SDK Key | `mobile/.env` → `MAPPLS_MOBILE_SDK_KEY` |
| **iOS** | Mobile | "Your Apps" > **Mobile** → iOS | Mobile SDK Key | `mobile/.env` → `MAPPLS_MOBILE_SDK_KEY` |

---

## Folder Structure After Setup

```
safeher_hackathon/
├── .env                    ← Add MAPPLS_REST_API_KEY here
├── pnpm-lock.yaml
├── package.json
├── frontend/
│   └── src/pages/SafeRoute.tsx    ← Web page at /route
├── backend/
│   └── _core/index.ts             ← Mappls proxy endpoints
├── mobile/                 ← Mobile app scaffold
│   ├── .env                ← Add MAPPLS_MOBILE_SDK_KEY here
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── services/mappls.ts
│   │   ├── hooks/useLocation.ts
│   │   └── ...
│   ├── android/
│   └── ios/
└── ...
```

---

## Quick Command Reference

```bash
# Start web dev server
cd c:\Users\janhavi\Downloads\safeher_hackathon
pnpm dev

# Start Android emulator
cd mobile
npm run android

# Start iOS simulator
cd mobile
npm run ios

# Test backend endpoints
curl "http://localhost:3000/api/mappls/autosuggest?query=hospital"
Invoke-RestMethod -Method Post "http://localhost:3000/api/mappls/directions" -ContentType 'application/json' -Body '{"origin":{"lat":28.6139,"lng":77.209},"destination":{"lat":28.5355,"lng":77.391}}'
```

---

## File Reference

📄 **Read these for details:**
- [mobile/MAPPLS_SETUP.md](mobile/MAPPLS_SETUP.md) — Full Mappls Console walkthrough
- [mobile/README.md](mobile/README.md) — Mobile app development guide
- [frontend/README.md](../frontend/README.md) — Web app architecture

---

## What If I Get Stuck?

### Error: "Component not found" or TypeScript errors on mobile
- The mobile app is a scaffold; some imports may need `react-native-config`
- Run: `cd mobile && npm install react-native-config`

### Error: "Cannot find module" in mobile
- Install dependencies: `npm install` in the `mobile/` folder

### Error: Map won't load on web
- Make sure `MAPPLS_REST_API_KEY` is set in `.env` (not empty)
- Make sure you restarted `pnpm dev` after changing `.env`

### Error: Android emulator won't start
- Make sure Android Studio SDK is installed
- `npm run android` will guide you through setup

### Error: iOS won't build
- First time: `cd mobile/ios && pod install`
- Then: `npm run ios`

---

## Recommended Order

1️⃣ **Do Path A** (Web app) first
   - Takes 5-10 minutes
   - Validates all backend wiring
   - Quick wins build confidence

2️⃣ **Then do Path B** (Android or iOS)
   - Core app logic is already written
   - Just need mobile SDK key
   - Install same dependencies as web
   - Test on emulator or device

3️⃣ **Optional: Deploy to Production**
   - Web: Deploy to Vercel, Netlify, or your server
   - Mobile: Publish to Google Play Store (Android) or App Store (iOS)

---

## Summary

**You now have:**
✅ Web app code complete & running (needs REST key)
✅ Mobile app scaffold (needs Mobile SDK keys)
✅ Backend proxy endpoints live (needs keys to function)
✅ Clear docs for both platforms

**Your immediate action:**
👉 Pick Path A or B above and follow the steps
👉 Grab Mappls keys from console
👉 Paste into .env files
👉 Test

**Questions?** Check the guide files or ask. You're ready! 🚀
