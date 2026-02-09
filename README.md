# TMLSN App - MVP

A mobile fitness and self-improvement application built with React Native Expo. TMLSN serves as an integrated operating system for fitness, starting with three core tools: Nutrition Tracker, Workout Tracker, and Prompt Vault.

## 🎯 Overview

TMLSN is designed as a lead magnet app that converts attention into retained users and eventually paying subscribers. The MVP focuses on providing immediate utility through structured tools while building habit formation within the ecosystem.

### Core Features (MVP)

1. **Nutrition Tracker**
   - Daily macro tracking (Calories, Protein, Carbs, Fat)
   - Water intake logging
   - Meal logging with photo support
   - Progress tracking against daily goals
   - Clean, data-focused interface

2. **Workout Tracker**
   - Pre-loaded TMLSN workout splits
   - Freeform workout creation
   - Set/rep/weight logging
   - Rest timer with push notifications
   - Workout history

3. **Prompt Vault**
   - Curated AI prompts for nutrition and training
   - One-click copy to clipboard
   - Source attribution with links
   - Category filtering
   - Weekly content updates

## 🛠 Tech Stack

- **Framework**: React Native with Expo (SDK 52)
- **Navigation**: Expo Router (file-based routing)
- **Language**: TypeScript
- **Storage**: AsyncStorage (local data persistence)
- **Notifications**: Expo Notifications
- **Image Handling**: Expo ImagePicker & Camera
- **UI**: Custom components with strict duo-tone design system

## 📁 Project Structure

```
tmlsn-app/
├── app/                      # Expo Router pages
│   ├── _layout.tsx          # Root layout
│   └── (tabs)/              # Tab navigation
│       ├── _layout.tsx      # Tab layout
│       ├── index.tsx        # Home/Dashboard
│       ├── nutrition.tsx    # Nutrition Tracker
│       ├── workout.tsx      # Workout Tracker
│       └── prompts.tsx      # Prompt Vault
├── components/              # Reusable components
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Input.tsx
├── constants/               # App constants
│   ├── theme.ts            # Colors, typography, spacing
│   ├── workoutSplits.ts    # Pre-loaded TMLSN splits
│   └── samplePrompts.ts    # Initial prompt vault data
├── types/                   # TypeScript type definitions
│   └── index.ts
├── utils/                   # Utility functions
│   ├── storage.ts          # AsyncStorage helpers
│   ├── helpers.ts          # General utilities
│   └── notifications.ts    # Push notification handlers
├── assets/                  # Images and static assets
├── .env.local.example       # Environment variables template
└── app.json                 # Expo configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode and iOS Simulator
- For Android: Android Studio and Android Emulator
- Physical device with Expo Go app (recommended for testing)

### Installation

1. **Navigate to the project directory**
   ```bash
   cd Projects/dreamssaver/tmlsn-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your API keys:
   - `FOOD_RECOGNITION_API_KEY`: For photo-based meal logging
   - `CONTENT_API_KEY`: For newsletter/YouTube content notifications
   - `ANALYTICS_KEY`: (Optional) For analytics

4. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

5. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on physical device

## 🎨 Design System

### Color Palette

The app follows a strict duo-tone design with minimal accent colors:

- **Primary Dark**: `#2F3031` - Backgrounds, cards, nav bars
- **Primary Light**: `#C6C6C6` - Text, borders, secondary backgrounds
- **Accent Red**: `#FF0000` - Critical alerts, urgent triggers (use sparingly)
- **Accent Blue**: `#0000FF` - Success states, completion indicators (use sparingly)
- **White**: `#FFFFFF` - High-priority headings and highlights

### Typography

- **H1 (32pt)**: Screen titles
- **H2 (22pt)**: Section headers
- **Body (17pt)**: General content
- **Data Value (20pt)**: Tracker values
- **Label (13pt)**: Labels and metadata

### Design Principles

- High contrast for readability
- Generous negative space
- Card-based layout system
- Data-focused design
- Minimal decoration

## 📱 Key Features Explained

### Nutrition Tracker

Users can:
- Set daily macro goals (calories, protein, carbs, fat)
- Log meals manually with macros
- Take/upload photos of meals (API integration for auto-detection)
- Track water intake with quick-add buttons
- View progress bars showing % of daily goals

### Workout Tracker

Users can:
- Select from 5 pre-loaded TMLSN workout splits
- Create custom freeform workouts
- Log weight and reps for each set
- Enable rest timer with push notifications
- View workout history

**Pre-loaded Splits:**
1. TMLSN Upper Body A
2. TMLSN Lower Body A
3. TMLSN Upper Body B
4. TMLSN Lower Body B
5. TMLSN Full Body

### Prompt Vault

Users can:
- Browse curated AI prompts by category
- View prompt details with usage instructions
- Copy prompts to clipboard with one tap
- Access source content (newsletters/videos) via links
- Filter prompts by category (Nutrition, Training)

## 🔔 Notifications

The app supports:
1. **Rest Timer Notifications**: Alert when rest period ends during workout
2. **Content Notifications**: Alert when new newsletter or YouTube video is published

Notifications are requested on first app launch.

## 💾 Data Storage

All user data is stored locally using AsyncStorage:
- Nutrition logs (meals, macros, water)
- Workout sessions (exercises, sets, reps)
- Prompts library
- User settings (goals, preferences)

No backend required for MVP. Data persists across app sessions but is device-specific.

## 🔐 API Integrations (To Be Configured)

### Food Recognition API
- **Purpose**: Auto-detect food from photos and estimate macros
- **Recommended**: Clarifai Food Model, Google Cloud Vision, or Edamam
- **Setup**: Add API key to `.env.local`

### Content API
- **Purpose**: Notify users of new newsletters and YouTube videos
- **Setup**: Add API endpoint to `.env.local`
- **Implementation**: Poll API or use webhooks

## 🚧 Future Enhancements (Post-MVP)

1. **AI Coaching Layer**
   - Personalized recommendations
   - Data trend analysis
   - Constraint-aware planning

2. **Paid Features**
   - Mastering Aesthetics course integration
   - Cross-tool data integration
   - Advanced analytics

3. **Social Features**
   - Community feed
   - User-generated content
   - Leaderboards

4. **Additional Tools**
   - Sleep tracking
   - Habit tracking
   - Progress photos

## 🐛 Known Issues & Limitations

- No backend/cloud sync (local storage only)
- Food photo recognition requires API integration
- No user authentication (single-device use)
- Limited to iOS and Android (no web version)

## 📄 License

Proprietary - TMLSN Project

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

## 📞 Support

For support or questions about the app:
- Documentation: Check this README
- Issues: Create a GitHub issue (if repo is set up)
- Contact: [Add contact email]

---

**Built with 💪 by the TMLSN team**
