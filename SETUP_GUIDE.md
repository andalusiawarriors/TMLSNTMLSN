# TMLSN App - Quick Setup Guide

This guide will help you get the TMLSN app running on your device in under 10 minutes.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Node.js 18+ installed ([Download](https://nodejs.org/))
- [ ] A smartphone with Expo Go app installed ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- [ ] Terminal/Command Prompt access

## Quick Start (5 Minutes)

### 1. Navigate to Project Directory

```bash
cd Projects/dreamssaver/tmlsn-app
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages. It may take 2-3 minutes.

### 3. Start the Development Server

```bash
npm start
```

You should see a QR code in your terminal.

### 4. Run on Your Phone

**iOS:**
1. Open the Expo Go app on your iPhone
2. Tap "Scan QR Code"
3. Point your camera at the QR code in the terminal
4. The app will load on your device

**Android:**
1. Open the Expo Go app on your Android phone
2. Tap "Scan QR Code"
3. Point your camera at the QR code in the terminal
4. The app will load on your device

### 5. Test the App

Once loaded, you should see:
- Home dashboard with empty state
- Bottom navigation with 4 tabs: Home, Nutrition, Workout, Prompts
- Dark theme with duo-tone design

Try:
1. Tap "Nutrition" → Add a meal
2. Tap "Workout" → Choose a TMLSN split
3. Tap "Prompts" → Browse and copy a prompt

## Using iOS Simulator (Mac Only)

If you have Xcode installed:

```bash
npm start
```

Then press `i` in the terminal to open iOS Simulator.

## Using Android Emulator

If you have Android Studio installed:

```bash
npm start
```

Then press `a` in the terminal to open Android Emulator.

## Common Issues & Solutions

### Issue: "Metro Bundler failed to start"
**Solution:** 
```bash
rm -rf node_modules
npm install
npm start -- --clear
```

### Issue: "Cannot find module 'expo-router'"
**Solution:** 
```bash
npm install expo-router
```

### Issue: QR code won't scan
**Solution:** 
- Ensure phone and computer are on the same WiFi network
- Try entering the URL manually in Expo Go app
- Use `npm start --tunnel` for LAN connection issues

### Issue: White screen on app load
**Solution:** 
- Wait 10-15 seconds (first load is slower)
- Shake device and tap "Reload"
- Check terminal for error messages

### Issue: "Expo CLI not found"
**Solution:** 
```bash
npm install -g expo-cli
```

## Development Tips

### Hot Reloading
Changes to code will automatically reload the app. Shake your device to:
- Reload the app
- Toggle performance monitor
- Open developer menu

### Viewing Logs
Check the terminal where you ran `npm start` to see:
- Console logs
- Error messages
- Network requests

### Clearing Cache
If you encounter strange behavior:
```bash
npm start -- --clear
```

## API Configuration (Optional)

For full functionality, configure APIs in `.env.local`:

### Food Recognition (for photo-based meal logging)
1. Sign up for Clarifai or Google Cloud Vision
2. Get API key
3. Add to `.env.local`:
```
FOOD_RECOGNITION_API_KEY=your_key_here
FOOD_RECOGNITION_API_URL=api_endpoint_here
```

### Push Notifications
Push notifications will work automatically on physical devices. No configuration needed for MVP.

## File Structure Quick Reference

```
app/
  (tabs)/
    index.tsx       → Home screen
    nutrition.tsx   → Calorie tracker
    workout.tsx     → Workout logger
    prompts.tsx     → Prompt vault

components/         → Reusable UI components
constants/          → Colors, splits, prompts
utils/             → Storage, helpers, notifications
```

## Next Steps

1. **Customize Goals**: Edit `utils/storage.ts` to change default daily goals
2. **Add Prompts**: Edit `constants/samplePrompts.ts` to add more prompts
3. **Modify Splits**: Edit `constants/workoutSplits.ts` to customize workouts
4. **Change Colors**: Edit `constants/theme.ts` to adjust design

## Need Help?

- Check the main README.md for detailed documentation
- Review error messages in the terminal
- Ensure all dependencies are installed correctly

## Production Build

When ready to build for production:

### iOS
```bash
expo build:ios
```

### Android
```bash
expo build:android
```

Or use EAS Build (recommended):
```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

---

**Ready to go! Start building the future of fitness tech 💪**
