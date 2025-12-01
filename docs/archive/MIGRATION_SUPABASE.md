# Migration Supabase - Instructions finales

## ✅ Travaux terminés

La migration vers Supabase a été implémentée avec succès ! Voici ce qui a été fait:

### 1. Configuration initiale
- ✅ Installation de `@supabase/supabase-js` et `@react-native-community/netinfo`
- ✅ Création du client Supabase dans `config/supabase.js`
- ✅ Configuration dans `app.json` (placeholders à remplacer)

### 2. Base de données
- ✅ Schéma SQL complet dans `supabase/schema.sql`
- ✅ Tables: users, vehicles, rides, ride_photos, ride_steps
- ✅ Row Level Security (RLS) configurée
- ✅ Triggers et functions automatiques

### 3. Services Supabase
- ✅ `services/supabase/authService.js` - Authentification complète
- ✅ `services/supabase/ridesService.js` - Gestion des trajets
- ✅ `services/supabase/vehiclesService.js` - Gestion des véhicules
- ✅ `services/offlineService.js` - Synchronisation offline

### 4. Authentification
- ✅ Context d'authentification global dans `contexts/AuthContext.js`
- ✅ Écrans de connexion et inscription
- ✅ Navigation conditionnelle (Auth Stack vs App Stack)
- ✅ Persistence de session

### 5. Migration des services existants
- ✅ `services/RideStorage.js` - Wrapper Supabase avec fallback local
- ✅ `services/Vehicles.js` - Intégration Supabase avec cache local
- ✅ Mode offline avec queue de synchronisation

### 6. Interface actuelle
- ✅ Navigation mise à jour dans `App.js`
- ✅ AuthProvider wrap toute l'application
- ✅ Écran de chargement pendant la vérification de session

## 🔧 Étapes à compléter

### Étape 1: Créer votre projet Supabase

1. Allez sur [https://supabase.com](https://supabase.com)
2. Créez un compte et un nouveau projet
3. Notez votre **URL** et votre **Anon Key** (dans Settings > API)

### Étape 2: Configurer les clés dans l'app

Ouvrez `app.json` et remplacez les placeholders:

```json
"extra": {
  "eas": {
    "projectId": "c0157764-7384-42cf-9f8d-bc566e9d1f3a"
  },
  "supabaseUrl": "https://VOTRE-PROJET.supabase.co",
  "supabaseAnonKey": "VOTRE-ANON-KEY-ICI"
}
```

### Étape 3: Exécuter le schéma SQL

1. Dans le Dashboard Supabase, allez dans **SQL Editor**
2. Copiez le contenu de `supabase/schema.sql`
3. Exécutez le script
4. Vérifiez que toutes les tables sont créées (dans **Table Editor**)

### Étape 4: Créer les buckets Storage

Suivez les instructions dans `supabase/STORAGE_SETUP.md`:

1. Allez dans **Storage** du Dashboard
2. Créez les 3 buckets: `avatars`, `ride-photos`, `vehicle-photos`
3. Configurez-les comme publics
4. Ajoutez les policies RLS (copiez-collez depuis le fichier)

### Étape 5: Adapter les écrans existants

Les écrans suivants doivent être mis à jour pour utiliser le contexte d'authentification:

#### SettingsScreen.js
```javascript
import { useAuth } from '../contexts/AuthContext';

function SettingsScreen() {
  const { user, profile, signOut } = useAuth();
  
  // Utiliser user.id au lieu d'un userId statique
  // Utiliser profile pour afficher les informations utilisateur
  // Appeler signOut() pour la déconnexion
}
```

#### MapScreenFull.js
```javascript
import { useAuth } from '../contexts/AuthContext';

function MapScreenFull() {
  const { user, profile } = useAuth();
  
  // Lors de la sauvegarde d'un trajet:
  const rideData = {
    userId: user.id,
    userName: profile.username || `${profile.first_name} ${profile.last_name}`,
    userAvatar: profile.avatar_url,
    // ... autres données
  };
  
  await RideStorageService.saveRide(rideData);
}
```

#### RunsScreen.js & HistoryScreen.js
Ces écrans sont déjà fonctionnels car ils utilisent `RideStorageService.getAllRides()` et `getUserRides()` qui ont été migrés.

Il faudra simplement passer le `user.id` pour HistoryScreen:
```javascript
import { useAuth } from '../contexts/AuthContext';

function HistoryScreen() {
  const { user } = useAuth();
  
  const loadRides = async () => {
    const rides = await RideStorageService.getUserRides(user.id);
    setRides(rides);
  };
}
```

### Étape 6: Tester la migration

1. **Test d'inscription:**
   - Lancez l'app
   - Créez un nouveau compte
   - Vérifiez que l'utilisateur est créé dans Supabase (Table Editor > users)

2. **Test de connexion:**
   - Déconnectez-vous
   - Reconnectez-vous avec vos identifiants
   - Vérifiez que la session persiste après un redémarrage

3. **Test de synchronisation offline:**
   - Activez le mode avion
   - Créez un trajet ou un véhicule
   - Désactivez le mode avion
   - Vérifiez que les données sont synchronisées vers Supabase

4. **Test des véhicules:**
   - Créez un véhicule
   - Vérifiez qu'il apparaît dans la table `vehicles`
   - Uploadez une photo
   - Vérifiez qu'elle apparaît dans le bucket `vehicle-photos`

5. **Test des trajets:**
   - Enregistrez un trajet
   - Vérifiez qu'il apparaît dans la table `rides`
   - Ajoutez des photos
   - Vérifiez qu'elles apparaissent dans le bucket `ride-photos`

## 🚀 Composants optionnels

### SyncIndicator
Un composant d'indicateur de synchronisation peut être ajouté pour montrer à l'utilisateur l'état de la connexion et de la sync:

```javascript
import { useEffect, useState } from 'react';
import offlineService from '../services/offlineService';
import { Ionicons } from '@expo/vector-icons';

function SyncIndicator() {
  const [state, setState] = useState({ isOnline: true, isSyncing: false, queueSize: 0 });
  
  useEffect(() => {
    const unsubscribe = offlineService.addListener(setState);
    
    // Charger l'état initial
    offlineService.getState().then(setState);
    
    return unsubscribe;
  }, []);
  
  if (state.isOnline && state.queueSize === 0) return null;
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#FEF3C7' }}>
      {state.isSyncing ? (
        <ActivityIndicator size="small" color="#F59E0B" />
      ) : (
        <Ionicons name="cloud-offline" size={16} color="#F59E0B" />
      )}
      <Text style={{ marginLeft: 8, color: '#92400E' }}>
        {state.isSyncing
          ? 'Synchronisation en cours...'
          : `${state.queueSize} action(s) en attente`}
      </Text>
    </View>
  );
}
```

Ajoutez ce composant en haut de vos écrans principaux.

## 📝 Notes importantes

### Mode offline
- Les données sont toujours sauvegardées localement en cache
- La queue de synchronisation retry automatiquement après 3 tentatives
- Les actions sont synchronisées automatiquement quand la connexion revient

### Sécurité
- Les Row Level Security (RLS) policies garantissent que les utilisateurs ne peuvent voir/modifier que leurs propres données
- Les buckets Storage ont des policies similaires
- Les sessions sont persistées de manière sécurisée dans AsyncStorage

### Performance
- Les données sont cachées localement pour un accès rapide
- Les requêtes Supabase incluent seulement les champs nécessaires
- Les images sont compressées avant upload

## 🐛 Dépannage

### Erreur "supabaseUrl or supabaseAnonKey is required"
→ Vérifiez que vous avez bien mis à jour `app.json` avec vos vraies clés Supabase

### Erreur "relation does not exist"
→ Vérifiez que vous avez bien exécuté le schéma SQL complet dans Supabase

### Erreur "Row level security policy prevents this operation"
→ Vérifiez que les policies RLS sont bien configurées dans Supabase

### Les données ne se synchronisent pas
→ Vérifiez la console pour voir les erreurs
→ Vérifiez que la queue est bien peuplée: `offlineService.getQueue()`
→ Forcez la sync: `offlineService.syncQueue()`

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)

---

**Bon travail! 🎉** La migration vers Supabase est presque complète. Il ne reste plus qu'à configurer votre projet Supabase et adapter quelques écrans pour utiliser le contexte d'authentification.






