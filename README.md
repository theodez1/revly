# StravaCar - GPS Ride Tracking App

A professional React Native app for tracking and sharing driving experiences.

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
StravaCar/
├── screens/          # UI screens (40 files)
├── components/       # Reusable components
├── services/         # Business logic & API calls
├── contexts/         # React contexts (Auth, Tracking)
├── hooks/            # Custom React hooks
├── constants/        # Colors, Typography
├── utils/            # Helper functions
├── supabase/         # Database SQL files
└── docs/             # Documentation
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

## 🔧 Configuration

### Environment Variables
Create a `.env` file:
```
MAPBOX_ACCESS_TOKEN=your_token_here
```

### Supabase
Configure in `config/supabase.js`:
```javascript
const supabaseUrl = 'your-project-url'
const supabaseAnonKey = 'your-anon-key'
```

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