# Assets Directory

This directory contains image assets for the TMLSN app.

## Required Assets

The following assets are referenced in app.json but need to be created:

### Required Files:
1. `icon.png` - App icon (1024x1024px)
2. `splash.png` - Splash screen (1284x2778px for iOS)
3. `adaptive-icon.png` - Android adaptive icon (1024x1024px)
4. `favicon.png` - Web favicon (48x48px)
5. `notification-icon.png` - Push notification icon (96x96px)

## Creating Assets

### App Icon (icon.png)
- Size: 1024x1024 pixels
- Format: PNG
- Design: TMLSN logo on #2F3031 background
- Ensure no transparency for best results

### Splash Screen (splash.png)
- Size: 1284x2778 pixels (iPhone 13 Pro Max)
- Format: PNG
- Background: #2F3031
- Center: TMLSN branding
- Safe area: Keep important content within center 1024x1024

### Adaptive Icon (adaptive-icon.png)
- Size: 1024x1024 pixels
- Format: PNG
- Android specific
- Background will be #2F3031 (set in app.json)

### Notification Icon (notification-icon.png)
- Size: 96x96 pixels
- Format: PNG
- Simple monochrome icon
- Will be tinted by system

## Temporary Placeholders

Until proper assets are created, Expo will use default placeholder images. The app will function normally but with default Expo branding.

## Design Guidelines

All assets should follow the TMLSN design system:
- Primary color: #2F3031 (dark background)
- Accent colors: #FF0000 (red) and #0000FF (blue)
- Typography: Clean, geometric sans-serif
- Style: Minimal, high-contrast, professional

## Tools for Creating Assets

- **Figma**: Free design tool
- **Sketch**: macOS design tool
- **Adobe Photoshop/Illustrator**: Professional tools
- **Canva**: Simple online tool
- **GIMP**: Free alternative to Photoshop

## Asset Generation Tools

Expo can generate various sizes from a single icon:
```bash
expo generate-splash
expo generate-icons
```

Note: This requires the source icon.png file to exist first.
