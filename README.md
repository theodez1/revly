# Revly – Application sociale de tracking GPS voiture

Revly est une application mobile React Native (Expo) qui permet de **suivre tes trajets en voiture**, d’analyser tes stats et de les **partager avec une communauté** (feed, groupes, challenges).

---

## 🚀 Démarrage rapide

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npx expo start

# Lancer sur iOS
npx expo run:ios

# Lancer sur Android
npx expo run:android
```

---

## 📁 Structure principale du projet

```bash
.
├── screens/          # Écrans UI (carte, activité, auth, profil, réglages, groupes)
├── components/       # Composants réutilisables (sheets, cartes, mini-maps, etc.)
├── services/         # Logique métier & appels API (tracking, Supabase, map matching)
├── contexts/         # Contextes React (Auth, Tracking, TrackingEngine)
├── hooks/            # Hooks personnalisés
├── constants/        # Couleurs, typo, constantes UI
├── utils/            # Fonctions utilitaires & logging
├── supabase/         # (optionnel) projet Supabase local (non versionné)
└── docs/             # Documentation (Mapbox, guides d’utilisation)
```

---

## 🔑 Fonctionnalités principales

- **Tracking GPS temps réel** avec gestion fine des points et segments
- **Tracking en arrière‑plan** (TaskManager + services natifs)
- **Feed social** des trajets, partage, commentaires, likes
- **Groupes & challenges**: création de groupes, classements, défis
- **Support offline**: mise en file des actions, synchro quand la connexion revient
- **Freemium / Premium**: paywall et fonctionnalités avancées

---

## 🛠️ Stack technique

- **Framework**: React Native + Expo
- **Backend**: Supabase (PostgreSQL, Storage, Auth)
- **Cartographie**: Mapbox (`@rnmapbox/maps` + Map Matching API)
- **État global**: React Context API (Auth, Tracking, TrackingEngine)
- **Navigation**: React Navigation (stack + bottom tabs)
- **UI / Icônes**: Tailwind‑style design + Lucide React Native

---

## 📱 Écrans principaux

- `MapScreenFull` – écran principal de tracking (live GPS, stats, segments)
- `RunsScreen` – feed des trajets
- `HistoryScreen` – historique personnel
- `RunDetailScreen` – détail d’un trajet (stats, map, matching)
- `ProfileScreen` / `UserProfileScreen` – profils utilisateur
- `GroupsScreen`, `GroupDetailScreen`, `AllGroupsScreen` – groupes & challenges
- `LoginScreen`, `SignUpScreen`, `OnboardingScreen` – auth & onboarding
- `SettingsScreen`, `PaywallScreen` – réglages & premium

---

## 🔧 Configuration & variables d’environnement

Tous les secrets sont chargés via des **variables d’environnement** et ne sont **jamais commités**.

Créer un fichier `.env` dans le dossier `StravaCar/` (ignoré par git) :

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Mapbox
EXPO_PUBLIC_MAPBOX_TOKEN=your_public_mapbox_token_here
```

- Supabase est configuré dans `config/supabase.ts`
- Mapbox est configuré dans `App.tsx` et `services/MapMatchingService.ts`

---

## 📚 Documentation interne

- `docs/MAPBOX_FEATURES_GUIDE.md` – guide des fonctionnalités Mapbox dans l’app
- `docs/MAPBOX_CUSTOMIZATION.md` – personnalisation du style et des layers
- `docs/EXEMPLE_UTILISATION_MAPBOX.md`, `docs/UTILISER_DEMO_MAPBOX.md` – exemples et notes

---

## 🧹 Qualité & état du projet

Le projet est en cours de **polissage pour publication App Store / Play Store**.

Améliorations récentes :
- ✅ Refonte du moteur de tracking (TrackingEngineContext)
- ✅ Rendu carte optimisé (segments, live line, Map Matching)
- ✅ Nettoyage des fichiers JS doublons vers TS/TSX
- ✅ Sécurisation des clés (tout passe par `.env`)
- ⏳ Raffinement UX/UI & animations

---

## 🚢 Build & déploiement

### iOS

```bash
eas build --platform ios
```

### Android

```bash
eas build --platform android
```

---

## 🖼️ Aperçu du projet (screenshot)

Section dédiée pour afficher une **image du projet** (mockup, capture d’écran, visuel marketing) :

- Idéal pour les visiteurs GitHub / Product Hunt / portfolio
- À remplacer par l’URL de ton image (hébergée sur GitHub, un CDN, ou autre)

```markdown
<!-- Exemple quand tu auras l’URL de ton image de projet -->
<!-- ![Revly – aperçu du projet](https://ton-cdn-ou-github-user-content/ton-image.jpg) -->
```

---

## 📝 Licence

Projet privé – **tous droits réservés**.