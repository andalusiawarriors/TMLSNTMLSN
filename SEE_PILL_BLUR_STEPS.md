# Step-by-step: See the pill at 0.97 opacity with blur

Follow these steps in order. This ensures you're running the correct project and that Metro serves the latest code.

---

## 1. Confirm you're in the right project folder

In Terminal:

```bash
cd "/Users/lucas/Downloads/tmlsn-app 2"
pwd
```

You must see: `/Users/lucas/Downloads/tmlsn-app 2`  
If you see something else (e.g. `tmlsn-app` without " 2"), you're in the wrong folder. Use the path above.

---

## 2. Confirm the tab bar file has the pill code

In Terminal (from the project folder):

```bash
grep -n "PILL_OPACITY\|BlurView\|tabBarBackground" "app/(tabs)/_layout.tsx"
```

You should see lines containing:
- `PILL_OPACITY`
- `BlurView`
- `tabBarBackground`

If you don't see these, the file on disk is not the updated one. Tell me what you see.

---

## 3. Stop all Metro / Expo / Node for this project

- In every terminal where Expo or Metro is running, press **Ctrl+C** to stop it.
- If you're not sure, close all terminals and open one new terminal window.

---

## 4. Clear Metro cache and temp files

From the project folder in Terminal:

```bash
cd "/Users/lucas/Downloads/tmlsn-app 2"
rm -rf node_modules/.cache
npx expo start --clear
```

Wait until you see "Metro waiting on..." and the QR code (or "Bundling..." when you first load the app). Do **not** press `r` yet.

---

## 5. Open the app on the simulator / device

- **iOS Simulator:** In the terminal where Expo is running, press `i` to open iOS simulator, or open the Simulator app and open your app from the home screen.
- **Physical device:** Scan the QR code with the Expo Go app.

Make sure you're opening **this** project's app (the one that just started with `npx expo start --clear`), not an old build or another app.

---

## 6. Reload the app once it's open

- **Simulator:** Press **Cmd+R** in the simulator, or in the Expo terminal press `r`.
- **Device:** Shake the device and tap "Reload", or press `r` in the Expo terminal.

Wait for the bundle to finish (you may see "Bundling..." in the terminal). The pill at the bottom should be rounded (pill shape), slightly transparent (0.97), and on iOS you should see blur behind it.

---

## 7. If you still don't see the pill at 0.97 or with blur

**A. Check the Expo terminal**

When you open or reload the app, look for any red error messages (e.g. about `expo-blur` or `BlurView`). If you see an error, copy it and we can fix it.

**B. Rebuild the native app (iOS) if you're using a dev build**

If you're running `expo run:ios` (not Expo Go), native modules like `expo-blur` need a fresh build after install:

```bash
cd "/Users/lucas/Downloads/tmlsn-app 2"
npx expo run:ios
```

Then repeat from step 4 (clear cache and start).

**C. Confirm you're not in Expo Go with an old bundle**

If you're using Expo Go, make sure the URL or connection in Expo Go is for this project (same LAN, same Metro URL). Sometimes Expo Go reuses an old project. Close the app completely, then open it again from the Expo dev server (e.g. press `i` again or scan the QR code again).

---

## 8. Optional: Solid 0.97 pill (no blur)

If blur never appears (e.g. on Android or an older device) but you want to at least see the pill at 0.97 opacity, we can change the tab bar to use a solid `rgba(61, 62, 63, 0.97)` background instead of BlurView. Say so and we can do that.
