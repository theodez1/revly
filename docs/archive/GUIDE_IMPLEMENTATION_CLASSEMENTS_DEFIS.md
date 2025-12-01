# 🚀 Guide d'Implémentation : Classements par Défi

## ✅ Checklist Complète

### Étape 1 : Vérifier la Table `rides` (2 min)

**Dans Supabase SQL Editor :**

```sql
-- Vérifier que la table existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'rides';

-- Vérifier les colonnes nécessaires
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rides'
AND column_name IN ('user_id', 'distance', 'max_speed', 'duration', 'start_time');
```

**Résultat attendu :** Toutes ces colonnes doivent exister
- ✅ `user_id` (UUID)
- ✅ `distance` (NUMERIC ou INTEGER)
- ✅ `max_speed` (NUMERIC)
- ✅ `duration` (INTEGER)
- ✅ `start_time` (TIMESTAMP)

### Étape 2 : Exécuter le SQL de Classements par Défi (5 min)

**Dans Supabase SQL Editor, exécuter :**

1. Ouvrir le fichier `supabase/challenge_rankings.sql`
2. Copier tout le contenu
3. Coller dans l'éditeur SQL de Supabase
4. Exécuter

**Ce que ça crée :**
- ✅ Table `challenge_rankings`
- ✅ Fonctions de calcul (`calculate_challenge_rankings`, `update_challenge_rankings`)
- ✅ Vue pour les requêtes (`challenge_rankings_view`)
- ✅ RLS policies

### Étape 3 : Activer le Trigger (1 min)

**Dans Supabase SQL Editor, exécuter :**

```sql
-- Activer le trigger pour mettre à jour automatiquement les classements
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Optionnel : Trigger aussi sur UPDATE (si un trajet est modifié)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();
```

### Étape 4 : Calculer les Classements Initiaux (2 min)

**Pour tous les défis actifs, exécuter :**

```sql
-- Calculer les classements pour tous les défis actifs
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

### Étape 5 : Utiliser le Service dans l'App

**Le service est déjà créé : `services/supabase/challengeRankingsService.js`**

**Exemple d'utilisation dans un composant :**

```javascript
import challengeRankingsService from '../services/supabase/challengeRankingsService';

// Dans le composant
const [rankings, setRankings] = useState([]);

useEffect(() => {
  loadRankings();
}, [challengeId]);

const loadRankings = async () => {
  const { rankings: data, error } = await challengeRankingsService.getChallengeRankings(
    challengeId
  );
  if (!error) {
    setRankings(data);
  }
};
```

### Étape 6 : Afficher les Classements dans l'UI

**À faire dans l'écran de détail d'un défi :**

1. Ajouter une section "Classements"
2. Afficher le classement selon le type de défi :
   - **Type 'distance'** : Afficher `totalDistance` et `rank`
   - **Type 'speed'** : Afficher `maxSpeed` et `rank`
   - **Type 'count'** : Afficher `totalRides` et `rank`
3. Afficher le podium (top 3) en évidence
4. Afficher la position de l'utilisateur actuel

## 📋 Résumé des Fichiers

### Fichiers SQL (Supabase) :
- ✅ `supabase/challenge_rankings.sql` → Exécuter dans Supabase
- ✅ Activer les triggers (code ci-dessus)

### Fichiers JavaScript (Déjà créés) :
- ✅ `services/supabase/challengeRankingsService.js` → Déjà prêt
- ⚠️ Écran de détail du défi → À modifier (ajouter l'affichage des classements)

## 🎯 Ordre d'Exécution Recommandé

1. **Vérifier** la table `rides` (Étape 1)
2. **Exécuter** `challenge_rankings.sql` (Étape 2)
3. **Activer** les triggers (Étape 3)
4. **Calculer** les classements initiaux (Étape 4)
5. **Créer** l'interface UI (Étape 5-6)
6. **Tester** avec un vrai trajet

## ⚠️ Points d'Attention

1. **Le trigger doit être activé** sinon les classements ne se mettront pas à jour automatiquement
2. **Les classements sont calculés uniquement pour les participants du défi** (table `challenge_participants`)
3. **Les trajets sont filtrés par la période du défi** (`start_date` à `end_date`)
4. **Le type de classement dépend du type de défi** :
   - `distance` → classement par distance totale
   - `speed` → classement par vitesse maximale
   - `count` → classement par nombre de trajets

## ❓ Questions Fréquentes

**Q : Est-ce que ça va ralentir la sauvegarde des trajets ?**
R : Non, le trigger s'exécute en arrière-plan, ça prend ~0.1-0.5 seconde

**Q : Que se passe-t-il si un trajet est supprimé ?**
R : Il faudrait aussi mettre à jour les classements. On peut ajouter un trigger sur DELETE si besoin.

**Q : Les classements sont-ils mis à jour en temps réel ?**
R : Oui, dès qu'un trajet est sauvegardé, les classements sont recalculés automatiquement pour tous les défis actifs où l'utilisateur est participant.

**Q : Comment ça fonctionne pour les défis terminés ?**
R : Les classements sont calculés uniquement pour les défis actifs (non terminés). Pour les défis terminés, les classements restent figés.


## ✅ Checklist Complète

### Étape 1 : Vérifier la Table `rides` (2 min)

**Dans Supabase SQL Editor :**

```sql
-- Vérifier que la table existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'rides';

-- Vérifier les colonnes nécessaires
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rides'
AND column_name IN ('user_id', 'distance', 'max_speed', 'duration', 'start_time');
```

**Résultat attendu :** Toutes ces colonnes doivent exister
- ✅ `user_id` (UUID)
- ✅ `distance` (NUMERIC ou INTEGER)
- ✅ `max_speed` (NUMERIC)
- ✅ `duration` (INTEGER)
- ✅ `start_time` (TIMESTAMP)

### Étape 2 : Exécuter le SQL de Classements par Défi (5 min)

**Dans Supabase SQL Editor, exécuter :**

1. Ouvrir le fichier `supabase/challenge_rankings.sql`
2. Copier tout le contenu
3. Coller dans l'éditeur SQL de Supabase
4. Exécuter

**Ce que ça crée :**
- ✅ Table `challenge_rankings`
- ✅ Fonctions de calcul (`calculate_challenge_rankings`, `update_challenge_rankings`)
- ✅ Vue pour les requêtes (`challenge_rankings_view`)
- ✅ RLS policies

### Étape 3 : Activer le Trigger (1 min)

**Dans Supabase SQL Editor, exécuter :**

```sql
-- Activer le trigger pour mettre à jour automatiquement les classements
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Optionnel : Trigger aussi sur UPDATE (si un trajet est modifié)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();
```

### Étape 4 : Calculer les Classements Initiaux (2 min)

**Pour tous les défis actifs, exécuter :**

```sql
-- Calculer les classements pour tous les défis actifs
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

### Étape 5 : Utiliser le Service dans l'App

**Le service est déjà créé : `services/supabase/challengeRankingsService.js`**

**Exemple d'utilisation dans un composant :**

```javascript
import challengeRankingsService from '../services/supabase/challengeRankingsService';

// Dans le composant
const [rankings, setRankings] = useState([]);

useEffect(() => {
  loadRankings();
}, [challengeId]);

const loadRankings = async () => {
  const { rankings: data, error } = await challengeRankingsService.getChallengeRankings(
    challengeId
  );
  if (!error) {
    setRankings(data);
  }
};
```

### Étape 6 : Afficher les Classements dans l'UI

**À faire dans l'écran de détail d'un défi :**

1. Ajouter une section "Classements"
2. Afficher le classement selon le type de défi :
   - **Type 'distance'** : Afficher `totalDistance` et `rank`
   - **Type 'speed'** : Afficher `maxSpeed` et `rank`
   - **Type 'count'** : Afficher `totalRides` et `rank`
3. Afficher le podium (top 3) en évidence
4. Afficher la position de l'utilisateur actuel

## 📋 Résumé des Fichiers

### Fichiers SQL (Supabase) :
- ✅ `supabase/challenge_rankings.sql` → Exécuter dans Supabase
- ✅ Activer les triggers (code ci-dessus)

### Fichiers JavaScript (Déjà créés) :
- ✅ `services/supabase/challengeRankingsService.js` → Déjà prêt
- ⚠️ Écran de détail du défi → À modifier (ajouter l'affichage des classements)

## 🎯 Ordre d'Exécution Recommandé

1. **Vérifier** la table `rides` (Étape 1)
2. **Exécuter** `challenge_rankings.sql` (Étape 2)
3. **Activer** les triggers (Étape 3)
4. **Calculer** les classements initiaux (Étape 4)
5. **Créer** l'interface UI (Étape 5-6)
6. **Tester** avec un vrai trajet

## ⚠️ Points d'Attention

1. **Le trigger doit être activé** sinon les classements ne se mettront pas à jour automatiquement
2. **Les classements sont calculés uniquement pour les participants du défi** (table `challenge_participants`)
3. **Les trajets sont filtrés par la période du défi** (`start_date` à `end_date`)
4. **Le type de classement dépend du type de défi** :
   - `distance` → classement par distance totale
   - `speed` → classement par vitesse maximale
   - `count` → classement par nombre de trajets

## ❓ Questions Fréquentes

**Q : Est-ce que ça va ralentir la sauvegarde des trajets ?**
R : Non, le trigger s'exécute en arrière-plan, ça prend ~0.1-0.5 seconde

**Q : Que se passe-t-il si un trajet est supprimé ?**
R : Il faudrait aussi mettre à jour les classements. On peut ajouter un trigger sur DELETE si besoin.

**Q : Les classements sont-ils mis à jour en temps réel ?**
R : Oui, dès qu'un trajet est sauvegardé, les classements sont recalculés automatiquement pour tous les défis actifs où l'utilisateur est participant.

**Q : Comment ça fonctionne pour les défis terminés ?**
R : Les classements sont calculés uniquement pour les défis actifs (non terminés). Pour les défis terminés, les classements restent figés.


## ✅ Checklist Complète

### Étape 1 : Vérifier la Table `rides` (2 min)

**Dans Supabase SQL Editor :**

```sql
-- Vérifier que la table existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'rides';

-- Vérifier les colonnes nécessaires
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rides'
AND column_name IN ('user_id', 'distance', 'max_speed', 'duration', 'start_time');
```

**Résultat attendu :** Toutes ces colonnes doivent exister
- ✅ `user_id` (UUID)
- ✅ `distance` (NUMERIC ou INTEGER)
- ✅ `max_speed` (NUMERIC)
- ✅ `duration` (INTEGER)
- ✅ `start_time` (TIMESTAMP)

### Étape 2 : Exécuter le SQL de Classements par Défi (5 min)

**Dans Supabase SQL Editor, exécuter :**

1. Ouvrir le fichier `supabase/challenge_rankings.sql`
2. Copier tout le contenu
3. Coller dans l'éditeur SQL de Supabase
4. Exécuter

**Ce que ça crée :**
- ✅ Table `challenge_rankings`
- ✅ Fonctions de calcul (`calculate_challenge_rankings`, `update_challenge_rankings`)
- ✅ Vue pour les requêtes (`challenge_rankings_view`)
- ✅ RLS policies

### Étape 3 : Activer le Trigger (1 min)

**Dans Supabase SQL Editor, exécuter :**

```sql
-- Activer le trigger pour mettre à jour automatiquement les classements
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Optionnel : Trigger aussi sur UPDATE (si un trajet est modifié)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();
```

### Étape 4 : Calculer les Classements Initiaux (2 min)

**Pour tous les défis actifs, exécuter :**

```sql
-- Calculer les classements pour tous les défis actifs
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

### Étape 5 : Utiliser le Service dans l'App

**Le service est déjà créé : `services/supabase/challengeRankingsService.js`**

**Exemple d'utilisation dans un composant :**

```javascript
import challengeRankingsService from '../services/supabase/challengeRankingsService';

// Dans le composant
const [rankings, setRankings] = useState([]);

useEffect(() => {
  loadRankings();
}, [challengeId]);

const loadRankings = async () => {
  const { rankings: data, error } = await challengeRankingsService.getChallengeRankings(
    challengeId
  );
  if (!error) {
    setRankings(data);
  }
};
```

### Étape 6 : Afficher les Classements dans l'UI

**À faire dans l'écran de détail d'un défi :**

1. Ajouter une section "Classements"
2. Afficher le classement selon le type de défi :
   - **Type 'distance'** : Afficher `totalDistance` et `rank`
   - **Type 'speed'** : Afficher `maxSpeed` et `rank`
   - **Type 'count'** : Afficher `totalRides` et `rank`
3. Afficher le podium (top 3) en évidence
4. Afficher la position de l'utilisateur actuel

## 📋 Résumé des Fichiers

### Fichiers SQL (Supabase) :
- ✅ `supabase/challenge_rankings.sql` → Exécuter dans Supabase
- ✅ Activer les triggers (code ci-dessus)

### Fichiers JavaScript (Déjà créés) :
- ✅ `services/supabase/challengeRankingsService.js` → Déjà prêt
- ⚠️ Écran de détail du défi → À modifier (ajouter l'affichage des classements)

## 🎯 Ordre d'Exécution Recommandé

1. **Vérifier** la table `rides` (Étape 1)
2. **Exécuter** `challenge_rankings.sql` (Étape 2)
3. **Activer** les triggers (Étape 3)
4. **Calculer** les classements initiaux (Étape 4)
5. **Créer** l'interface UI (Étape 5-6)
6. **Tester** avec un vrai trajet

## ⚠️ Points d'Attention

1. **Le trigger doit être activé** sinon les classements ne se mettront pas à jour automatiquement
2. **Les classements sont calculés uniquement pour les participants du défi** (table `challenge_participants`)
3. **Les trajets sont filtrés par la période du défi** (`start_date` à `end_date`)
4. **Le type de classement dépend du type de défi** :
   - `distance` → classement par distance totale
   - `speed` → classement par vitesse maximale
   - `count` → classement par nombre de trajets

## ❓ Questions Fréquentes

**Q : Est-ce que ça va ralentir la sauvegarde des trajets ?**
R : Non, le trigger s'exécute en arrière-plan, ça prend ~0.1-0.5 seconde

**Q : Que se passe-t-il si un trajet est supprimé ?**
R : Il faudrait aussi mettre à jour les classements. On peut ajouter un trigger sur DELETE si besoin.

**Q : Les classements sont-ils mis à jour en temps réel ?**
R : Oui, dès qu'un trajet est sauvegardé, les classements sont recalculés automatiquement pour tous les défis actifs où l'utilisateur est participant.

**Q : Comment ça fonctionne pour les défis terminés ?**
R : Les classements sont calculés uniquement pour les défis actifs (non terminés). Pour les défis terminés, les classements restent figés.

