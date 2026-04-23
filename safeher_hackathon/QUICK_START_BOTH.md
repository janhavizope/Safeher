# Setup Both Web & Mobile - Quick Start

## 🎯 Goal: Run Web at localhost:3000 + Mobile on emulator/device simultaneously

---

## STEP 1: Create Web App in Mappls Console (5 min)

1. Open: https://auth.mappls.com/console
2. Sign in with your account
3. Click **"Your Apps"** in left menu
4. Click **"Web"** card
5. Click **"Create App"**
6. Fill form:
   ```
   App Name: SafeHer Web
   Description: Safety Route Finder Web App
   ```
7. Click **Create**
8. Go to **"Keys"** section
9. **COPY** the "REST API Key" (long string starting with `eyJ...` or similar)
   
   **SAVE THIS** as: `WEB_REST_KEY`

---

## STEP 2: Create Android Mobile App (5 min)

### Get Android SHA-256
If you **don't have Android Studio installed**:
- For now, use this **dummy fingerprint** to test: `00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33`
- Later when you build on Android, you'll regenerate this

### Create in Mappls Console
1. Go: https://auth.mappls.com/console (stay signed in)
2. Click **"Your Apps"** → **"Mobile"**
3. Click **"Create App"**
4. Platform: Select **"Android"**
5. Fill form:
   ```
   App Name: SafeHer Android
   Package Name: com.safeher.app
   SHA-256 Fingerprint: 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33
   ```
6. Click **Create**
7. Go to **"Keys"** section
8. **COPY** the "Mobile SDK Key"

   **SAVE THIS** as: `ANDROID_MOBILE_KEY`

---

## STEP 3: Create iOS Mobile App (5 min)

1. Go: https://auth.mappls.com/console (stay signed in)
2. Click **"Your Apps"** → **"Mobile"**
3. Click **"Create App"**
4. Platform: Select **"iOS"**
5. Fill form:
   ```
   App Name: SafeHer iOS
   Bundle ID: com.safeher.app
   ```
6. Click **Create**
7. Go to **"Keys"** section
8. **COPY** the "Mobile SDK Key"

   **SAVE THIS** as: `IOS_MOBILE_KEY`

---

## STEP 4: Add Keys to Env Files

### Web Key
1. Open: `c:\Users\janhavi\Downloads\safeher_hackathon\.env`
2. Find line: `MAPPLS_REST_API_KEY=`
3. Replace with: `MAPPLS_REST_API_KEY=WEB_REST_KEY_YOU_COPIED`
4. **Save file**

### Mobile Key (for both Android & iOS for now)
1. Open: `c:\Users\janhavi\Downloads\safeher_hackathon\mobile\.env`
   - *(Create if doesn't exist from `.env.example`)*
2. Add/update:
   ```
   MAPPLS_MOBILE_SDK_KEY=ANDROID_MOBILE_KEY_YOU_COPIED
   MAPPLS_CLIENT_ID=
   MAPPLS_CLIENT_SECRET=
   API_BASE_URL=http://localhost:3000
   ```
3. **Save file**

---

## STEP 5: Start Web + Backend

```bash
cd c:\Users\janhavi\Downloads\safeher_hackathon

# Kill any existing pnpm dev (Ctrl+C if running)
# Then start fresh:
pnpm dev
```

**Wait for:**
```
VITE v5.x.x  ready in 1234 ms

➜  Local:   http://localhost:3000/
```

**Test web:**
- Open browser: http://localhost:3000/route
- You should see:
  - Map loading
  - Blue dot (your location)
  - Search box at top
  - SOS button

**Let it run in this terminal** ✓

---

## STEP 6: Start Mobile in New Terminal

### For Android
```bash
# Open NEW terminal (keep pnpm dev running)
cd c:\Users\janhavi\Downloads\safeher_hackathon\mobile

# First time only, install dependencies:
npm install

# Start Android emulator (if you have Android Studio):
npm run android
```

**If Android Studio not installed:**
- Download & install: https://developer.android.com/studio
- Then run: `npm run android`
- It will guide you through emulator setup

### For iOS (Mac only)
```bash
# Open NEW terminal
cd c:\Users\janhavi\Downloads\safeher_hackathon\mobile

npm install
npm run ios
```

**Note:** iOS development requires a Mac. On Windows, skip this or use WSL2 with Android only.

---

## STEP 7: Test Both Together

### Web Testing
In browser (http://localhost:3000/route):
1. Try searching: "hospital"
2. Click a result → red marker appears
3. Route draws on map
4. Bottom panel shows distance + time
5. Click SOS button → location shares

### Mobile Testing
On Android emulator/device:
1. Allow location permission
2. Try searching: "police"
3. Select result → plan route
4. Route card shows distance + time
5. Click red SOS button 🆘

---

## Summary: Your 3 Mappls Apps

| App | Created | Key | Where To Use |
|-----|---------|-----|---|
| **Web** | Mappls Console > Web | REST API Key | Root `.env` |
| **Android** | Mappls Console > Mobile | Mobile SDK Key | `mobile/.env` |
| **iOS** | Mappls Console > Mobile | Mobile SDK Key | `mobile/.env` |

---

## Troubleshooting

**"Mappls REST key missing"** on web
- Did you paste the key into `.env`?
- Did you save the file?
- Did you restart `pnpm dev`? (Ctrl+C then `pnpm dev` again)
- Check: http://localhost:3000/api/maps/config should show the key is loaded

**Mobile won't start**
- Make sure you have Node.js: `node --version`
- Make sure Android Studio installed: `npm run android` will tell you
- Make sure `mobile/.env` exists and has the key

**"Cannot find MAPPLS_MOBILE_SDK_KEY"** on mobile
- Make sure `mobile/.env` exists (not `.env.example`)
- Make sure you saved it
- Run: `npm install` again in mobile folder

**Port 3000 already in use**
- Kill other processes: `netstat -ano | findstr :3000`
- Or use different port: `PORT=3001 pnpm dev`

---

## Files You Need to Edit

```
c:\Users\janhavi\Downloads\safeher_hackathon\
├── .env                    ← EDIT: Add MAPPLS_REST_API_KEY
└── mobile/
    └── .env                ← CREATE/EDIT: Add MAPPLS_MOBILE_SDK_KEY
```

---

## Next: Get Mappls Keys

👉 **Go to https://auth.mappls.com/console** and follow Steps 1-3 above
👉 **Paste keys** into the two `.env` files
👉 **Run both systems** with Step 5 & 6

**Then you'll have:**
- ✅ Web app running on http://localhost:3000/route
- ✅ Mobile app running on emulator/device connecting to same backend
- ✅ Both sharing the same Mappls accounts
- ✅ Both using the same backend API at http://localhost:3000/api/mappls/*

---

**Ready? Go get those keys! 🚀**
