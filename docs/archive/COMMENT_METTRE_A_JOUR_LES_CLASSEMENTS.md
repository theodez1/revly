# 📊 Comment Mettre à Jour les Classements des Défis

## 🎯 Vue d'Ensemble

Le système de classement des défis fonctionne de **deux manières** :

### 1. **Mise à Jour Automatique (Recommandé)** ⚡
Les classements se mettent à jour **automatiquement** dès qu'un trajet est créé, modifié ou supprimé grâce à un **trigger SQL**.

### 2. **Mise à Jour Manuelle** 🔄
Vous pouvez forcer la mise à jour manuellement via le service JavaScript.

---

## 🚀 Activation de la Mise à Jour Automatique

### Étape 1 : Activer le Trigger SQL

**Dans Supabase SQL Editor, exécuter :**

```sql
-- Activer le trigger pour INSERT (création de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Activer le trigger pour UPDATE (modification de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();
```

**OU** exécuter directement le fichier :
```
supabase/activate_challenge_rankings_trigger.sql
```

### Étape 2 : Calculer les Classements Initiaux

Pour tous les défis actifs existants :

```sql
DO $$
DECLARE
  challenge_record RECORD;
BEGIN
  FOR challenge_record IN 
    SELECT id FROM challenges 
    WHERE (end_date IS NULL OR end_date >= NOW())
      AND (start_date IS NULL OR start_date <= NOW())
  LOOP
    PERFORM update_challenge_rankings(challenge_record.id, 300);
  END LOOP;
END $$;
```

---

## 🔄 Mise à Jour Manuelle (JavaScript)

### Dans l'Application

Le service `challengeRankingsService` met déjà à jour les classements automatiquement quand vous les récupérez :

```javascript
import challengeRankingsService from '../services/supabase/challengeRankingsService';

// Cette fonction met à jour ET récupère les classements
const { rankings, error } = await challengeRankingsService.getChallengeRankings(challengeId);
```

### Forcer une Mise à Jour

Si vous voulez forcer une mise à jour sans récupérer les données :

```javascript
// Forcer la mise à jour
await challengeRankingsService.refreshChallengeRankings(challengeId);

// Puis récupérer les classements
const { rankings } = await challengeRankingsService.getChallengeRankings(challengeId);
```

---

## 📱 Intégration dans l'UI

### Option 1 : Mise à Jour Automatique à l'Ouverture

Dans `GroupDetailScreen.js` ou l'écran de détail d'un défi :

```javascript
useEffect(() => {
  if (challenge?.id) {
    loadChallengeRankings(challenge.id);
  }
}, [challenge?.id]);

const loadChallengeRankings = async (challengeId) => {
  const { rankings, error } = await challengeRankingsService.getChallengeRankings(challengeId);
  if (!error && rankings) {
    // Mettre à jour l'état avec les classements
    setChallengeRankings(rankings);
    
    // Trouver le leader
    const leader = rankings[0]; // Premier = meilleur classement
    setChallengeLeader(leader?.user?.name || null);
  }
};
```

### Option 2 : Rafraîchissement Périodique

Pour mettre à jour toutes les X secondes :

```javascript
useEffect(() => {
  if (!challenge?.id) return;
  
  const interval = setInterval(async () => {
    const { rankings } = await challengeRankingsService.getChallengeRankings(challenge.id);
    setChallengeRankings(rankings);
  }, 30000); // Toutes les 30 secondes
  
  return () => clearInterval(interval);
}, [challenge?.id]);
```

### Option 3 : Rafraîchissement après un Trajet

Quand un utilisateur termine un trajet, rafraîchir les classements :

```javascript
// Après la sauvegarde d'un trajet
const saveRide = async (rideData) => {
  // Sauvegarder le trajet
  await RidesService.saveRide(rideData);
  
  // Rafraîchir les classements pour tous les défis actifs
  const activeChallenges = await ChallengesService.getActiveChallenges(groupId);
  for (const challenge of activeChallenges) {
    await challengeRankingsService.refreshChallengeRankings(challenge.id);
  }
};
```

---

## 🎯 Comment ça Fonctionne

### 1. **Quand un Trajet est Créé**
- Le trigger SQL se déclenche automatiquement
- Il trouve tous les défis actifs où l'utilisateur est participant
- Il vérifie si le trajet est dans la période du défi
- Il recalcule les classements pour ces défis

### 2. **Calcul des Classements**
- **Type 'distance'** : Classement par distance totale (km)
- **Type 'speed'** : Classement par vitesse maximale (km/h)
- **Type 'count'** : Classement par nombre de trajets

### 3. **Filtres Appliqués**
- Durée minimale : 5 minutes (300 secondes)
- Distance minimale : 100 mètres
- Période du défi : entre `start_date` et `end_date`

---

## ✅ Checklist

- [ ] Exécuter `challenge_rankings.sql` dans Supabase
- [ ] Activer les triggers (fichier `activate_challenge_rankings_trigger.sql`)
- [ ] Calculer les classements initiaux pour les défis actifs
- [ ] Intégrer `challengeRankingsService` dans l'UI
- [ ] Afficher les classements dans l'écran de détail du défi
- [ ] Tester avec un vrai trajet

---

## 🔍 Vérification

Pour vérifier que les triggers sont actifs :

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%';
```

Vous devriez voir 2-3 triggers :
- `update_challenge_rankings_on_ride_insert`
- `update_challenge_rankings_on_ride_update`
- (optionnel) `update_challenge_rankings_on_ride_delete`

---

## ⚠️ Points Importants

1. **Performance** : Le trigger prend ~0.1-0.5 seconde par trajet. C'est acceptable.

2. **Défis Terminés** : Les classements ne sont pas recalculés pour les défis terminés (figés).

3. **Participants Uniquement** : Seuls les participants du défi (table `challenge_participants`) sont classés.

4. **Temps Réel** : Avec les triggers activés, les classements sont mis à jour en temps réel dès qu'un trajet est sauvegardé.


## 🎯 Vue d'Ensemble

Le système de classement des défis fonctionne de **deux manières** :

### 1. **Mise à Jour Automatique (Recommandé)** ⚡
Les classements se mettent à jour **automatiquement** dès qu'un trajet est créé, modifié ou supprimé grâce à un **trigger SQL**.

### 2. **Mise à Jour Manuelle** 🔄
Vous pouvez forcer la mise à jour manuellement via le service JavaScript.

---

## 🚀 Activation de la Mise à Jour Automatique

### Étape 1 : Activer le Trigger SQL

**Dans Supabase SQL Editor, exécuter :**

```sql
-- Activer le trigger pour INSERT (création de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Activer le trigger pour UPDATE (modification de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();
```

**OU** exécuter directement le fichier :
```
supabase/activate_challenge_rankings_trigger.sql
```

### Étape 2 : Calculer les Classements Initiaux

Pour tous les défis actifs existants :

```sql
DO $$
DECLARE
  challenge_record RECORD;
BEGIN
  FOR challenge_record IN 
    SELECT id FROM challenges 
    WHERE (end_date IS NULL OR end_date >= NOW())
      AND (start_date IS NULL OR start_date <= NOW())
  LOOP
    PERFORM update_challenge_rankings(challenge_record.id, 300);
  END LOOP;
END $$;
```

---

## 🔄 Mise à Jour Manuelle (JavaScript)

### Dans l'Application

Le service `challengeRankingsService` met déjà à jour les classements automatiquement quand vous les récupérez :

```javascript
import challengeRankingsService from '../services/supabase/challengeRankingsService';

// Cette fonction met à jour ET récupère les classements
const { rankings, error } = await challengeRankingsService.getChallengeRankings(challengeId);
```

### Forcer une Mise à Jour

Si vous voulez forcer une mise à jour sans récupérer les données :

```javascript
// Forcer la mise à jour
await challengeRankingsService.refreshChallengeRankings(challengeId);

// Puis récupérer les classements
const { rankings } = await challengeRankingsService.getChallengeRankings(challengeId);
```

---

## 📱 Intégration dans l'UI

### Option 1 : Mise à Jour Automatique à l'Ouverture

Dans `GroupDetailScreen.js` ou l'écran de détail d'un défi :

```javascript
useEffect(() => {
  if (challenge?.id) {
    loadChallengeRankings(challenge.id);
  }
}, [challenge?.id]);

const loadChallengeRankings = async (challengeId) => {
  const { rankings, error } = await challengeRankingsService.getChallengeRankings(challengeId);
  if (!error && rankings) {
    // Mettre à jour l'état avec les classements
    setChallengeRankings(rankings);
    
    // Trouver le leader
    const leader = rankings[0]; // Premier = meilleur classement
    setChallengeLeader(leader?.user?.name || null);
  }
};
```

### Option 2 : Rafraîchissement Périodique

Pour mettre à jour toutes les X secondes :

```javascript
useEffect(() => {
  if (!challenge?.id) return;
  
  const interval = setInterval(async () => {
    const { rankings } = await challengeRankingsService.getChallengeRankings(challenge.id);
    setChallengeRankings(rankings);
  }, 30000); // Toutes les 30 secondes
  
  return () => clearInterval(interval);
}, [challenge?.id]);
```

### Option 3 : Rafraîchissement après un Trajet

Quand un utilisateur termine un trajet, rafraîchir les classements :

```javascript
// Après la sauvegarde d'un trajet
const saveRide = async (rideData) => {
  // Sauvegarder le trajet
  await RidesService.saveRide(rideData);
  
  // Rafraîchir les classements pour tous les défis actifs
  const activeChallenges = await ChallengesService.getActiveChallenges(groupId);
  for (const challenge of activeChallenges) {
    await challengeRankingsService.refreshChallengeRankings(challenge.id);
  }
};
```

---

## 🎯 Comment ça Fonctionne

### 1. **Quand un Trajet est Créé**
- Le trigger SQL se déclenche automatiquement
- Il trouve tous les défis actifs où l'utilisateur est participant
- Il vérifie si le trajet est dans la période du défi
- Il recalcule les classements pour ces défis

### 2. **Calcul des Classements**
- **Type 'distance'** : Classement par distance totale (km)
- **Type 'speed'** : Classement par vitesse maximale (km/h)
- **Type 'count'** : Classement par nombre de trajets

### 3. **Filtres Appliqués**
- Durée minimale : 5 minutes (300 secondes)
- Distance minimale : 100 mètres
- Période du défi : entre `start_date` et `end_date`

---

## ✅ Checklist

- [ ] Exécuter `challenge_rankings.sql` dans Supabase
- [ ] Activer les triggers (fichier `activate_challenge_rankings_trigger.sql`)
- [ ] Calculer les classements initiaux pour les défis actifs
- [ ] Intégrer `challengeRankingsService` dans l'UI
- [ ] Afficher les classements dans l'écran de détail du défi
- [ ] Tester avec un vrai trajet

---

## 🔍 Vérification

Pour vérifier que les triggers sont actifs :

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%';
```

Vous devriez voir 2-3 triggers :
- `update_challenge_rankings_on_ride_insert`
- `update_challenge_rankings_on_ride_update`
- (optionnel) `update_challenge_rankings_on_ride_delete`

---

## ⚠️ Points Importants

1. **Performance** : Le trigger prend ~0.1-0.5 seconde par trajet. C'est acceptable.

2. **Défis Terminés** : Les classements ne sont pas recalculés pour les défis terminés (figés).

3. **Participants Uniquement** : Seuls les participants du défi (table `challenge_participants`) sont classés.

4. **Temps Réel** : Avec les triggers activés, les classements sont mis à jour en temps réel dès qu'un trajet est sauvegardé.


## 🎯 Vue d'Ensemble

Le système de classement des défis fonctionne de **deux manières** :

### 1. **Mise à Jour Automatique (Recommandé)** ⚡
Les classements se mettent à jour **automatiquement** dès qu'un trajet est créé, modifié ou supprimé grâce à un **trigger SQL**.

### 2. **Mise à Jour Manuelle** 🔄
Vous pouvez forcer la mise à jour manuellement via le service JavaScript.

---

## 🚀 Activation de la Mise à Jour Automatique

### Étape 1 : Activer le Trigger SQL

**Dans Supabase SQL Editor, exécuter :**

```sql
-- Activer le trigger pour INSERT (création de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Activer le trigger pour UPDATE (modification de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();
```

**OU** exécuter directement le fichier :
```
supabase/activate_challenge_rankings_trigger.sql
```

### Étape 2 : Calculer les Classements Initiaux

Pour tous les défis actifs existants :

```sql
DO $$
DECLARE
  challenge_record RECORD;
BEGIN
  FOR challenge_record IN 
    SELECT id FROM challenges 
    WHERE (end_date IS NULL OR end_date >= NOW())
      AND (start_date IS NULL OR start_date <= NOW())
  LOOP
    PERFORM update_challenge_rankings(challenge_record.id, 300);
  END LOOP;
END $$;
```

---

## 🔄 Mise à Jour Manuelle (JavaScript)

### Dans l'Application

Le service `challengeRankingsService` met déjà à jour les classements automatiquement quand vous les récupérez :

```javascript
import challengeRankingsService from '../services/supabase/challengeRankingsService';

// Cette fonction met à jour ET récupère les classements
const { rankings, error } = await challengeRankingsService.getChallengeRankings(challengeId);
```

### Forcer une Mise à Jour

Si vous voulez forcer une mise à jour sans récupérer les données :

```javascript
// Forcer la mise à jour
await challengeRankingsService.refreshChallengeRankings(challengeId);

// Puis récupérer les classements
const { rankings } = await challengeRankingsService.getChallengeRankings(challengeId);
```

---

## 📱 Intégration dans l'UI

### Option 1 : Mise à Jour Automatique à l'Ouverture

Dans `GroupDetailScreen.js` ou l'écran de détail d'un défi :

```javascript
useEffect(() => {
  if (challenge?.id) {
    loadChallengeRankings(challenge.id);
  }
}, [challenge?.id]);

const loadChallengeRankings = async (challengeId) => {
  const { rankings, error } = await challengeRankingsService.getChallengeRankings(challengeId);
  if (!error && rankings) {
    // Mettre à jour l'état avec les classements
    setChallengeRankings(rankings);
    
    // Trouver le leader
    const leader = rankings[0]; // Premier = meilleur classement
    setChallengeLeader(leader?.user?.name || null);
  }
};
```

### Option 2 : Rafraîchissement Périodique

Pour mettre à jour toutes les X secondes :

```javascript
useEffect(() => {
  if (!challenge?.id) return;
  
  const interval = setInterval(async () => {
    const { rankings } = await challengeRankingsService.getChallengeRankings(challenge.id);
    setChallengeRankings(rankings);
  }, 30000); // Toutes les 30 secondes
  
  return () => clearInterval(interval);
}, [challenge?.id]);
```

### Option 3 : Rafraîchissement après un Trajet

Quand un utilisateur termine un trajet, rafraîchir les classements :

```javascript
// Après la sauvegarde d'un trajet
const saveRide = async (rideData) => {
  // Sauvegarder le trajet
  await RidesService.saveRide(rideData);
  
  // Rafraîchir les classements pour tous les défis actifs
  const activeChallenges = await ChallengesService.getActiveChallenges(groupId);
  for (const challenge of activeChallenges) {
    await challengeRankingsService.refreshChallengeRankings(challenge.id);
  }
};
```

---

## 🎯 Comment ça Fonctionne

### 1. **Quand un Trajet est Créé**
- Le trigger SQL se déclenche automatiquement
- Il trouve tous les défis actifs où l'utilisateur est participant
- Il vérifie si le trajet est dans la période du défi
- Il recalcule les classements pour ces défis

### 2. **Calcul des Classements**
- **Type 'distance'** : Classement par distance totale (km)
- **Type 'speed'** : Classement par vitesse maximale (km/h)
- **Type 'count'** : Classement par nombre de trajets

### 3. **Filtres Appliqués**
- Durée minimale : 5 minutes (300 secondes)
- Distance minimale : 100 mètres
- Période du défi : entre `start_date` et `end_date`

---

## ✅ Checklist

- [ ] Exécuter `challenge_rankings.sql` dans Supabase
- [ ] Activer les triggers (fichier `activate_challenge_rankings_trigger.sql`)
- [ ] Calculer les classements initiaux pour les défis actifs
- [ ] Intégrer `challengeRankingsService` dans l'UI
- [ ] Afficher les classements dans l'écran de détail du défi
- [ ] Tester avec un vrai trajet

---

## 🔍 Vérification

Pour vérifier que les triggers sont actifs :

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%';
```

Vous devriez voir 2-3 triggers :
- `update_challenge_rankings_on_ride_insert`
- `update_challenge_rankings_on_ride_update`
- (optionnel) `update_challenge_rankings_on_ride_delete`

---

## ⚠️ Points Importants

1. **Performance** : Le trigger prend ~0.1-0.5 seconde par trajet. C'est acceptable.

2. **Défis Terminés** : Les classements ne sont pas recalculés pour les défis terminés (figés).

3. **Participants Uniquement** : Seuls les participants du défi (table `challenge_participants`) sont classés.

4. **Temps Réel** : Avec les triggers activés, les classements sont mis à jour en temps réel dès qu'un trajet est sauvegardé.

