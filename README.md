# Revly - Social GPS Ride Tracking App

Revly is a polished React Native (Expo) app for tracking, analyzing and sharing your car trips with a social layer (feed, groups, challenges).

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS
npx expo run:ios

# Run on Android  
npx expo run:android
```

## 📁 Project Structure

```
.
├── screens/          # UI screens (map, activity, auth, profile, settings, groups)
├── components/       # Reusable UI components (sheets, cards, previews, etc.)
├── services/         # Business logic & API calls (tracking, Supabase, map matching)
├── contexts/         # React contexts (Auth, Tracking, TrackingEngine)
├── hooks/            # Custom React hooks
├── constants/        # Colors, Typography
├── utils/            # Helper functions & logging
├── supabase/         # (Optional) local Supabase project files (NOT committed)
└── docs/             # Documentation (Mapbox, features, usage)
```

## 🔑 Key Features

- **GPS Tracking**: Real-time location tracking with Kalman filtering
- **Background Tracking**: Reliable tracking even when app is in background
- **Social**: Share rides, comment, like, follow friends
- **Groups & Challenges**: Create groups and participate in challenges
- **Offline Support**: Queue data when offline, sync when online
- **Premium**: In-app purchases with paywall

## 🛠️ Tech Stack

- **Framework**: React Native (Expo)
- **Backend**: Supabase (PostgreSQL + Storage + Auth)
- **Maps**: React Native Maps (Mapbox)
- **State**: React Context API
- **Icons**: Lucide React Native
- **Navigation**: React Navigation

## 📱 Screens

### Core
- `MapScreenFull` - Main tracking screen
- `RunsScreen` - Feed of rides
- `HistoryScreen` - Personal ride history
- `ProfileScreen` - User profile

### Social
- `GroupsScreen` - Groups management
- `ShareActivityScreen` - Share rides to social

### Auth
- `LoginScreen` - User login
- `SignUpScreen` - User registration
- `OnboardingScreen` - First-time user onboarding

## 🔧 Configuration & Environment

All secrets are loaded from environment variables and **never** committed.

Create a `.env` file in the `StravaCar/` folder (ignored by git):

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Mapbox
EXPO_PUBLIC_MAPBOX_TOKEN=your_public_mapbox_token_here
```

Supabase client is configured in `config/supabase.ts` and Mapbox in `App.tsx` / `services/MapMatchingService.ts` using these env vars.

## 📚 Documentation

- [Implementation Plan](docs/implementation_plan.md) - Cleanup & professionalization
- [Supabase README](supabase/README.md) - Database structure
- [Archive](docs/archive/) - Historical documentation

## 🧹 Code Quality

This project is actively being cleaned and professionalized for App Store/Play Store submission.

**Recent improvements:**
- ✅ Removed temporary Python scripts
- ✅ Consolidated documentation
- ✅ Organized Supabase files
- ✅ Fixed font system errors
- ✅ Added Lucide icons
- ⏳ Reorganizing screens by feature (in progress)

## 🚢 Deployment

### iOS
```bash
eas build --platform ios
```

### Android  
```bash
eas build --platform android
```

## 📝 License

Private - All rights reserved

## 👨‍💻 Developer

Théo Dez