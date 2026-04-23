# Quick Commands - Both Web & Mobile

## Terminal 1: Start Backend + Web

```bash
cd c:\Users\janhavi\Downloads\safeher_hackathon
pnpm dev
```

**Expected output:**
```
VITE v5.x.x ready in 1234 ms

➜  Local:   http://localhost:3000/
➜  http://localhost:3000/route for SafeRoute
```

**Test endpoints:**
```bash
# Check if keys are loaded:
curl http://localhost:3000/api/maps/config

# Test search:
curl "http://localhost:3000/api/mappls/autosuggest?query=hospital&lat=28.6139&lng=77.209"

# Test directions:
$body='{"origin":{"lat":28.6139,"lng":77.209},"destination":{"lat":28.5355,"lng":77.391},"profile":"driving"}'
curl -X POST http://localhost:3000/api/mappls/directions `
  -H "Content-Type: application/json" `
  -d $body
```

---

## Terminal 2: Start Mobile (Android)

```bash
cd c:\Users\janhavi\Downloads\safeher_hackathon\mobile

# First time:
npm install

# Start:
npm run android
```

**Android Studio must be installed.**
**Get it:** https://developer.android.com/studio

---

## Terminal 2: Start Mobile (iOS)

```bash
cd c:\Users\janhavi\Downloads\safeher_hackathon\mobile

# First time:
npm install

# (Mac only) Install pods:
cd ios
pod install
cd ..

# Start:
npm run ios
```

**Requires Mac + Xcode**

---

## Monitoring Both

**Terminal 1** (web):
```
pnpm dev → http://localhost:3000
```

**Terminal 2** (mobile):
```
npm run android → Android Emulator opens
```

Both will print logs. You can see requests flowing in Terminal 1 logs.

---

## Common Issues & Fixes

### 1. "MAPPLS REST key missing" on web

**Check:**
```bash
# Is .env file updated?
cat .env | findstr MAPPLS_REST_API_KEY

# Should output:
# MAPPLS_REST_API_KEY=eyJ... (not empty)
```

**Fix:**
```bash
# 1. Update .env
notepad .env

# 2. Restart pnpm dev
# (Ctrl+C in Terminal 1, then)
pnpm dev

# 3. Refresh browser
```

---

### 2. "Cannot find module MAPPLS_MOBILE_SDK_KEY"

**Check:**
```bash
# Does mobile/.env exist?
ls mobile\.env

# Is it populated?
cat mobile\.env | findstr MAPPLS_MOBILE_SDK_KEY
```

**Fix:**
```bash
# 1. Create file if missing
copy mobile\.env.example mobile\.env

# 2. Edit it
notepad mobile\.env

# 3. Add your key and save

# 4. Reinstall deps
cd mobile
npm install
cd ..
```

---

### 3. Port 3000 already in use

**Check:**
```bash
netstat -ano | findstr :3000
```

**Fix Option A:** Kill the process
```bash
# Get PID from netstat output, then:
taskkill /PID [PID] /F
pnpm dev
```

**Fix Option B:** Use different port
```bash
$env:PORT=3001
pnpm dev
# Now use http://localhost:3001
```

---

### 4. Android Studio not found

**Install:**
1. Download: https://developer.android.com/studio
2. Install (default settings)
3. Open Android Studio
4. Click "More Options" → "SDK Manager" → Install recommended
5. Go back to terminal, run: `npm run android`

---

### 5. npm command not found in mobile

**Fix:**
```bash
# Install Node.js if not present
node --version

# Then try again
npm install
npm run android
```

---

### 6. "iOS build failed"

**Try:**
```bash
cd mobile/ios
pod install
cd ..
npm run ios
```

---

## Check Status Fast

**Is web running?**
```bash
curl http://localhost:3000/route
# Should return HTML (not error)
```

**Are keys loaded?**
```bash
curl http://localhost:3000/api/maps/config
# Should show keys in JSON response
```

**Is Android emulator running?**
```bash
adb devices
# Should list emulator
```

---

## Restart Everything

**If things get weird:**

```bash
# Terminal 1: Stop web
# Ctrl+C

# Terminal 2: Stop mobile
# Ctrl+C

# Clear node modules cache
cd mobile
npm cache clean --force
npm install
cd ..

# Restart web
pnpm dev

# Restart mobile (new terminal)
npm run android
```

---

## Final URLs

| Service | URL |
|---------|-----|
| **Web (SafeRoute page)** | http://localhost:3000/route |
| **Web API (maps config)** | http://localhost:3000/api/maps/config |
| **Web API (search)** | http://localhost:3000/api/mappls/autosuggest |
| **Web API (nearby)** | http://localhost:3000/api/mappls/nearby |
| **Web API (directions)** | http://localhost:3000/api/mappls/directions |
| **Mobile (emulator)** | Android Emulator app (connects to http://localhost:3000) |

---

## Summary

1. **Get Mappls keys** → Console
2. **Update `.env` files** → Keys go here
3. **Terminal 1:** `pnpm dev` (web runs on 3000)
4. **Terminal 2:** `npm run android` or `npm run ios` (mobile starts)
5. **Test both** → Search, plan route, click SOS

**Both running together!** 🚀
