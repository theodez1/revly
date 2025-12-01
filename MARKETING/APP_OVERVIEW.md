# Revly – Application Overview

Comprehensive recap of every major surface, behaviour, and selling point inside the Revly codebase. Use it for marketing assets, internal onboarding, or TikTok scripting.

---

## 1. Mission & Positioning
Revly est “le carnet de route 2.0” : l’app enregistre chaque trajet avec précision, rassemble les passionnés d’automobile, et transforme les données en contenus prêt-à-partager. Trois piliers :

1. **Tracking immersif** – HUD plein écran ( `screens/MapScreenFull.js` ) avec métriques live, segments, photos, et synchronisation arrière-plan ( `services/BackgroundLocationService.js` ).
2. **Communauté & souvenirs** – Feed, Historique personnel, Groupes, défis, et bibliothèque de trajets ( `screens/RunsScreen.js`, `screens/HistoryScreen.js`, `screens/GroupsScreen.js` ).
3. **Monétisation premium** – Paywall avec timer dynamique, avantages clairs et plans multiples ( `screens/PaywallScreen.js` ).

---

## 2. Navigation & Architecture
- **Entrée utilisateur** : Onboarding scénarisé ( `screens/OnboardingScreen.js` ) → Auth Stack (`LoginScreen`, `SignUpScreen`).
- **Navigation principale** : `App.js` configure un `Tab.Navigator` (Feed, Groups, Record, History, Profile) + un `Stack` pour les modales RecordTrip, ShareActivity, Paywall, Settings, AllChallenges, AllGroups, DiscoverGroups et GroupDetail.
- **Providers racine** : `AuthProvider`, `TrackingProvider`, `TrackingEngineProvider`, `BottomSheetModalProvider`, `SafeAreaProvider`, `GestureHandlerRootView`.

---

## 3. Tracking & Map Experience
### 3.1 HUD de tracking
- Écran `RecordTrip` ( `screens/MapScreenFull.js` ) :
  - Carte `react-native-maps`, centrage dynamique selon la vitesse, recalcul du zoom.
  - Bloc stats: vitesse instantanée, temps total, distance, arrêts, segments actifs.
  - Contrôles animés via `useTrackingAnimations`.
  - **Étapes & moments** : panneau inline pour ajouter un repère ou une photo sans quitter l’écran, aperçu des 4 derniers moments, accès au `StepsEditorModal`.
  - Sauvegarde finale via `TripSummaryModal`, export vers `SavedTripsModal`.

### 3.2 Pile technique
- **TrackingEngineContext** (`contexts/TrackingEngineContext.js`) centralise toutes les refs: `currentLocation`, `trackingPoints`, `maxSpeed`, `tripSteps`, timers ( `useTripTimer` ), filtres de Kalman ( `useKalmanFilters` ), etc.
- **Persistence** :
  - `useTrackingPersistence` restaure les points/sessions depuis AsyncStorage.
  - `BackgroundLocationService` crée une tâche `expo-task-manager` qui bufferise 2 000 positions max, notifie un handler en temps réel, et draine la queue dès que le front revient en focus.
- **Session lifecycle** (`useTrackingSession`):
  - Démarrage = reset complet (points, stats, timers, segments, AsyncStorage), demande permissions foreground+background.
  - Pause/Reprise = split de segments et redémarrage du watch si besoin.
  - Arrêt = flush AsyncStorage, arrêt du TaskManager, animations UI inversées.

---

## 4. Screens – detailed explanations

| Screen / Modal | Fichier | Rôle utilisateur | Points techniques clés |
| --- | --- | --- | --- |
| Onboarding | `screens/OnboardingScreen.js` | Introduit les bénéfices (tracking, véhicules, stats, partage, groupes) avec CTA “Commencer” et bouton skip. | Stocke `@onboarding_completed`, composants custom (skip, next/back), même visuel exploitable pour TikTok. |
| Login / SignUp | `screens/LoginScreen.js`, `screens/SignUpScreen.js` | Authentifie via Supabase, gère reset password et validations. | S’appuie sur `AuthContext`, transitions stack sans header. |
| Runs (Feed) | `screens/RunsScreen.js` | Découverte de trajets publiés (carte + photos), lecture stats, like/comment/share. | Charge `RideStorageService.getAllRides`, filtres, carrousels `ScrollView`, `BottomSheetModal` pour filtres/commentaires, intégration `ShareActivityScreen`. |
| Run Detail | `screens/RunDetailScreen.js` | Vue longue sur un trajet spécifique (segments, vitesse, météo). | Réutilise mini cartes, stats détaillées, CTA export. |
| Record Trip (Map) | `screens/MapScreenFull.js` | HUD principal : démarrer/pause/terminer, suivre vitesse et distance, ajouter étapes/photos, voir stats live. | Combine `useTrackingEngine`, `useTrackingAnimations`, modulaires `CameraModal`, `StepsEditorModal`, `TripSummaryModal`, `SavedTripsModal`. |
| Steps Editor modal | `screens/MapScreenFull/components/StepsEditorModal.js` | Consultation et édition rapide des étapes créées pendant un trajet. | Liste contextuelle (icônes 📍/📷), accessible depuis panneau “Étapes & moments”. |
| Trip Summary modal | `screens/MapScreenFull/components/TripSummaryModal.js` | Confirmation de sauvegarde avec stats clés, véhicule, steps. | Utilisé à la fin d’un tracking pour lancer sauvegarde/export. |
| Saved Trips modal | `screens/MapScreenFull/components/SavedTripsModal.js` | Bibliothèque locale des trajets enregistrés depuis la Map. | Sert de quick access pour partager/reprendre plus tard. |
| Stats (global) | `screens/StatsScreen.js` | Dashboard statique (trajets, km, temps, vitesse moyenne) utile pour storytelling. | Peut afficher un empty state motivant “enregistrez vos trajets”. |
| History | `screens/HistoryScreen.js` | Journal personnel des trajets de l’utilisateur avec filtres et stats cumulées. | `RideStorageService.getUserRides`, photo de profil cache, `BottomSheetModal` filtres/options. |
| Groups | `screens/GroupsScreen.js` | Hub social : découvrir groupes, suivre défis, créer son crew. | Carousel “Mes groupes”, cartes défis, invitations, bottom sheet création groupe. |
| AllChallenges | `screens/AllChallengesScreen.js` | Listing complet des défis actifs/terminés. | Réutilise mêmes cartes que section Groupes mais en plein écran. |
| AllGroups | `screens/AllGroupsScreen.js` | Catalogue de groupes disponibles (+ stats, localisations). | Scroll vertical, bouton rejoindre. |
| Discover Groups | `screens/DiscoverGroupsScreen.js` | Recherche et filtres par région/intérêt pour trouver un groupe. | Barre de recherche, tags, cartes résumées. |
| Group Detail | `screens/GroupDetailScreen.js` | Profil d’un groupe : description, défis, posts récents, membres. | CTA rejoindre, timeline posts, stats cumulées. |
| Profile | `screens/ProfileScreen.js` | Espace perso : résumé badges, posts, véhicules, stats, favoris. | `PagerView` 4 onglets, gestion véhicules (Supabase/local), trophées, streak hebdo, partage stats. |
| Edit Profile | `screens/EditProfileScreen.js` | Paramètres profil (photo, pseudo, bio, réseaux). | Upload via Expo ImagePicker, synchronisation Supabase. |
| Settings | `screens/SettingsScreen.js` | Préférences globales (notifications, thème, unités), accès légaux, logout. | Simples toggles, navigation vers `EditProfile` et `Paywall`. |
| Share Activity | `screens/ShareActivityScreen.js` | Génère une carte d’activité (image) et propose des actions (Story, Snapchat, copier, sauvegarder). | `ViewShot`, `ShareCard`, intégrations `expo-sharing`, `expo-media-library`, `Clipboard`. |
| Share Composer | `screens/ShareComposerScreen.js` | Sélection de templates avant capture pour réseaux sociaux. | Variantes “stats-only”, “route-stats”, “mini-route”. |
| Paywall | `screens/PaywallScreen.js` | Conversion premium : timer, avantages, comparaison plans, bouton “Restaurer”. | Timer dynamique (36h), badges, CTA `handlePrimary`. |
| Saved Trips list | `screens/MapScreenFull/components/SavedTripsModal.js` + `screens/MapScreenFull/components/SavedTripsModal` | Gestion locale des trajets pour re-use. | Stocke dans AsyncStorage, tri par date. |
| On-device modals additionnels | `components/VehicleSelectorSheet`, `RideFilterSheet`, `CameraModal`, etc. | Utilitaires pour sélectionner véhicule, filtrer Feed/History, prendre photos. | Basés sur `BottomSheetModal` ou `ViewShot` selon besoin. |

---

## 5. Données & Services
- **AsyncStorage** : persistance tracking (`trackingPoints`, `segmentStarts`, `maxSpeed`, `tripStartTime`, `altitudeData`, `isTracking`, `isPaused`), onboarding flag, véhicules favoris, snapshots UI.
- **Supabase** : auth, profils, véhicules, rides (voir `services/supabase/*`).
- **RideStorageService** : API interne pour stocker/charger les runs (utilisé par Feed/History/Profile).
- **Background queue** : clé `@stravacar_bg_location_queue` flushée via `drainPersistedLocationsAsync`.

---

## 6. Points forts à narrer
1. **Interface tracking premium** : animations, double flux (foreground watch + background TaskManager), ajout d’étapes en un tap, summary modale stylée.
2. **Communauté intégrée** : défis, posts groupés, carrousels “mes groupes”, invitations.
3. **Partage social ultra simple** : carte générée, export multi-réseaux, copie base64, templates multiples.
4. **Offre premium claire** : timer, badges, liste d’avantages orientés performance/sans pubs, CTA unique.
5. **Scalabilité technique** : contexte unique `TrackingEngineContext` + hooks spécialisés (`useTrackingPoints`, `useTripMetrics`, `useKalmanFilters`) qui facilitent les évolutions.

---

## 7. Inspirations TikTok
- “De zéro à ride partagée en 30 secondes” : onboarding → RecordTrip → ajout étape → TripSummary → Share.
- “Pourquoi rejoindre un groupe Revly ?” : scroll dans `GroupsScreen`, focus défis + posts + création.
- “Comment l’app suit mes trajets même écran éteint ?” : capture `BackgroundLocationService`, explication queue + drain.
- “Premium tour” : `PaywallScreen` + stats avancées dans `ProfileScreen`.

---

## 8. Next Steps / TODO marketing
- Filmer un walkthrough pour chaque onglet principal.
- Préparer scripts courts en reprenant les 5 slides onboarding comme chapitres TikTok.
- Mettre en avant le panneau “Étapes & moments” et le partage autop (différenciant par rapport aux apps GPS classiques).

---

_Dernière mise à jour : 15 novembre 2025_

