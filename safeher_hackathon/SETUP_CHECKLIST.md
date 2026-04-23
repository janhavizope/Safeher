# SafeHer Setup Checklist - Both Web & Mobile

## Phase 1: Create Mappls Credentials (Console)

### Web App
- [ ] Go to https://auth.mappls.com/console
- [ ] Sign in
- [ ] "Your Apps" → "Web" → "Create App"
- [ ] App Name: `SafeHer Web`
- [ ] Click Create
- [ ] Go to "Keys" section
- [ ] **COPY REST API Key** → Save as: `WEB_KEY`
  ```
  WEB_KEY = ___________________________________
  ```

### Android Mobile App
- [ ] Go to https://auth.mappls.com/console (same tab)
- [ ] "Your Apps" → "Mobile" → "Create App"
- [ ] Platform: **Android**
- [ ] App Name: `SafeHer Android`
- [ ] Package Name: `com.safeher.app`
- [ ] SHA-256: `00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33` (dummy for now)
- [ ] Click Create
- [ ] Go to "Keys" section
- [ ] **COPY Mobile SDK Key** → Save as: `ANDROID_KEY`
  ```
  ANDROID_KEY = ___________________________________
  ```

### iOS Mobile App
- [ ] Go to https://auth.mappls.com/console (same tab)
- [ ] "Your Apps" → "Mobile" → "Create App"
- [ ] Platform: **iOS**
- [ ] App Name: `SafeHer iOS`
- [ ] Bundle ID: `com.safeher.app`
- [ ] Click Create
- [ ] Go to "Keys" section
- [ ] **COPY Mobile SDK Key** → Save as: `IOS_KEY`
  ```
  IOS_KEY = ___________________________________
  ```

---

## Phase 2: Configure Local Files

### Root `.env` (Web)
- [ ] Open: `c:\Users\janhavi\Downloads\safeher_hackathon\.env`
- [ ] Find line: `MAPPLS_REST_API_KEY=`
- [ ] Replace value with your `WEB_KEY`
- [ ] **Save file**

### Mobile `.env`
- [ ] Open: `c:\Users\janhavi\Downloads\safeher_hackathon\mobile\.env`
- [ ] Find line: `MAPPLS_MOBILE_SDK_KEY=`
- [ ] Replace value with your `ANDROID_KEY` or `IOS_KEY`
- [ ] **Save file**

---

## Phase 3: Start Backend & Web

- [ ] Open Terminal 1
- [ ] `cd c:\Users\janhavi\Downloads\safeher_hackathon`
- [ ] `pnpm dev`
- [ ] Wait for: `➜  Local:   http://localhost:3000/`
- [ ] **DO NOT close this terminal**
- [ ] Test: Open browser → http://localhost:3000/route
  - [ ] Map loads
  - [ ] Blue dot shows your location
  - [ ] Search box works
  - [ ] No "key missing" error

---

## Phase 4: Start Mobile

### Android (if you have Android Studio)
- [ ] Open Terminal 2 (keep pnpm dev running in Terminal 1)
- [ ] `cd c:\Users\janhavi\Downloads\safeher_hackathon\mobile`
- [ ] `npm install`
- [ ] `npm run android`
- [ ] Android emulator launches
- [ ] App loads on emulator
- [ ] Allow location permission
- [ ] Try searching for destination

### iOS (Mac only)
- [ ] Open Terminal 2 (keep pnpm dev running in Terminal 1)
- [ ] `cd c:\Users\janhavi\Downloads\safeher_hackathon\mobile`
- [ ] `npm install`
- [ ] `npm run ios`
- [ ] iOS simulator launches
- [ ] App loads on simulator

---

## Phase 5: Test Both Together

### Web Testing
- [ ] Search: "hospital" → See suggestions ✓
- [ ] Click suggestion → Red marker adds to map ✓
- [ ] Route draws from your location to destination ✓
- [ ] Distance + ETA show at bottom ✓
- [ ] Click SOS button → Location shares ✓

### Mobile Testing
- [ ] Search: "police" → See suggestions ✓
- [ ] Click suggestion → Route card shows distance ✓
- [ ] Red SOS button responds ✓
- [ ] Location tracking works (move around emulator) ✓

---

## Success Criteria

✅ **You'll know it's working when:**
- Web page loads at http://localhost:3000/route (no errors)
- Mobile app starts on emulator/device
- Both can search destinations
- Both can see routes on map
- Backend not showing "key missing" error

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Mappls REST key missing" on web | 1. Check `.env` has your WEB_KEY 2. Restart `pnpm dev` 3. Refresh browser |
| Mobile won't start | Run `npm install` in mobile folder first |
| "Cannot find MAPPLS_MOBILE_SDK_KEY" | Make sure `mobile/.env` exists and saved with your key |
| Port 3000 in use | Kill process or use `PORT=3001 pnpm dev` |
| Android Studio not found | Download from https://developer.android.com/studio |
| iOS won't build | `cd mobile/ios && pod install` then try again |

---

## Timeline

⏱️ **5 min** - Create 3 apps in Mappls Console
⏱️ **2 min** - Update `.env` files with keys
⏱️ **5 min** - Start web (`pnpm dev`)
⏱️ **5 min** - Start mobile (`npm run android` or `npm run ios`)
⏱️ **5 min** - Test both

**Total: ~22 minutes to full working setup**

---

## Notes

- Both web and mobile are built, just need keys
- Keys go in `.env` files (not code)
- Web runs on `http://localhost:3000`
- Mobile connects to same backend via `http://localhost:3000/api/mappls/*`
- Can run both simultaneously in different terminals

Ready? Start with the Mappls Console steps above! 🚀
