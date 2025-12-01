# 📋 Ordre d'Exécution pour les Classements

## ⚠️ IMPORTANT : Exécuter dans cet ordre

### ÉTAPE 1 : Créer la table et les fonctions (OBLIGATOIRE)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/challenge_rankings.sql
```

**Ce que ça crée :**
- ✅ Table `challenge_rankings`
- ✅ Fonction `calculate_challenge_rankings`
- ✅ Fonction `update_challenge_rankings`
- ✅ Fonction `trigger_update_rankings_on_ride_for_challenges`
- ✅ Vue `challenge_rankings_view`
- ✅ RLS policies

**⏱️ Durée : ~30 secondes**

---

### ÉTAPE 2 : Activer les triggers (OBLIGATOIRE)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/activate_challenge_rankings_trigger.sql
```

**OU**
```
supabase/SETUP_COMPLET_CLASSEMENTS.sql
```

**Ce que ça fait :**
- ✅ Active le trigger INSERT (mise à jour automatique à la création d'un trajet)
- ✅ Active le trigger UPDATE (mise à jour si un trajet est modifié)
- ✅ Active le trigger DELETE (mise à jour si un trajet est supprimé)
- ✅ Calcule les classements initiaux pour tous les défis actifs

**⏱️ Durée : ~10 secondes**

---

### ÉTAPE 3 : Vérifier que tout est OK (OPTIONNEL)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/verify_challenge_rankings_setup.sql
```

**Ce que ça vérifie :**
- ✅ Toutes les tables existent
- ✅ Toutes les fonctions existent
- ✅ Tous les triggers sont activés
- ✅ RLS est configuré
- ✅ Affiche des statistiques

**⏱️ Durée : ~5 secondes**

---

## 🚨 Si vous avez une erreur

### Erreur : `relation "challenge_rankings" does not exist`

**Solution :** Vous n'avez pas exécuté l'ÉTAPE 1.
→ Exécutez d'abord `challenge_rankings.sql`

### Erreur : `function "trigger_update_rankings_on_ride_for_challenges" does not exist`

**Solution :** Vous n'avez pas exécuté l'ÉTAPE 1.
→ Exécutez d'abord `challenge_rankings.sql`

### Erreur : `trigger "update_challenge_rankings_on_ride_insert" already exists`

**Solution :** C'est normal, le script utilise `DROP TRIGGER IF EXISTS` donc ça devrait fonctionner quand même. Si ça bloque, exécutez manuellement :

```sql
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_delete ON rides;
```

Puis réexécutez `activate_challenge_rankings_trigger.sql`

---

## ✅ Checklist Finale

Après avoir exécuté les scripts, vous devriez avoir :

- [ ] Table `challenge_rankings` créée
- [ ] 3 fonctions SQL créées
- [ ] 3 triggers activés sur la table `rides`
- [ ] Vue `challenge_rankings_view` créée
- [ ] RLS activé avec policy
- [ ] Classements calculés pour les défis actifs

---

## 🧪 Test Rapide

Pour tester que tout fonctionne :

```sql
-- Vérifier qu'un trigger est actif
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name LIKE '%challenge_rankings%';

-- Devrait retourner 3 lignes :
-- - update_challenge_rankings_on_ride_insert
-- - update_challenge_rankings_on_ride_update  
-- - update_challenge_rankings_on_ride_delete
```

---

## 📝 Résumé

1. **Exécuter** `challenge_rankings.sql` → Crée tout le système
2. **Exécuter** `activate_challenge_rankings_trigger.sql` → Active les triggers
3. **Vérifier** `verify_challenge_rankings_setup.sql` → Confirme que tout est OK

**C'est tout !** Les classements se mettront à jour automatiquement à chaque trajet. 🎉


## ⚠️ IMPORTANT : Exécuter dans cet ordre

### ÉTAPE 1 : Créer la table et les fonctions (OBLIGATOIRE)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/challenge_rankings.sql
```

**Ce que ça crée :**
- ✅ Table `challenge_rankings`
- ✅ Fonction `calculate_challenge_rankings`
- ✅ Fonction `update_challenge_rankings`
- ✅ Fonction `trigger_update_rankings_on_ride_for_challenges`
- ✅ Vue `challenge_rankings_view`
- ✅ RLS policies

**⏱️ Durée : ~30 secondes**

---

### ÉTAPE 2 : Activer les triggers (OBLIGATOIRE)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/activate_challenge_rankings_trigger.sql
```

**OU**
```
supabase/SETUP_COMPLET_CLASSEMENTS.sql
```

**Ce que ça fait :**
- ✅ Active le trigger INSERT (mise à jour automatique à la création d'un trajet)
- ✅ Active le trigger UPDATE (mise à jour si un trajet est modifié)
- ✅ Active le trigger DELETE (mise à jour si un trajet est supprimé)
- ✅ Calcule les classements initiaux pour tous les défis actifs

**⏱️ Durée : ~10 secondes**

---

### ÉTAPE 3 : Vérifier que tout est OK (OPTIONNEL)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/verify_challenge_rankings_setup.sql
```

**Ce que ça vérifie :**
- ✅ Toutes les tables existent
- ✅ Toutes les fonctions existent
- ✅ Tous les triggers sont activés
- ✅ RLS est configuré
- ✅ Affiche des statistiques

**⏱️ Durée : ~5 secondes**

---

## 🚨 Si vous avez une erreur

### Erreur : `relation "challenge_rankings" does not exist`

**Solution :** Vous n'avez pas exécuté l'ÉTAPE 1.
→ Exécutez d'abord `challenge_rankings.sql`

### Erreur : `function "trigger_update_rankings_on_ride_for_challenges" does not exist`

**Solution :** Vous n'avez pas exécuté l'ÉTAPE 1.
→ Exécutez d'abord `challenge_rankings.sql`

### Erreur : `trigger "update_challenge_rankings_on_ride_insert" already exists`

**Solution :** C'est normal, le script utilise `DROP TRIGGER IF EXISTS` donc ça devrait fonctionner quand même. Si ça bloque, exécutez manuellement :

```sql
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_delete ON rides;
```

Puis réexécutez `activate_challenge_rankings_trigger.sql`

---

## ✅ Checklist Finale

Après avoir exécuté les scripts, vous devriez avoir :

- [ ] Table `challenge_rankings` créée
- [ ] 3 fonctions SQL créées
- [ ] 3 triggers activés sur la table `rides`
- [ ] Vue `challenge_rankings_view` créée
- [ ] RLS activé avec policy
- [ ] Classements calculés pour les défis actifs

---

## 🧪 Test Rapide

Pour tester que tout fonctionne :

```sql
-- Vérifier qu'un trigger est actif
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name LIKE '%challenge_rankings%';

-- Devrait retourner 3 lignes :
-- - update_challenge_rankings_on_ride_insert
-- - update_challenge_rankings_on_ride_update  
-- - update_challenge_rankings_on_ride_delete
```

---

## 📝 Résumé

1. **Exécuter** `challenge_rankings.sql` → Crée tout le système
2. **Exécuter** `activate_challenge_rankings_trigger.sql` → Active les triggers
3. **Vérifier** `verify_challenge_rankings_setup.sql` → Confirme que tout est OK

**C'est tout !** Les classements se mettront à jour automatiquement à chaque trajet. 🎉


## ⚠️ IMPORTANT : Exécuter dans cet ordre

### ÉTAPE 1 : Créer la table et les fonctions (OBLIGATOIRE)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/challenge_rankings.sql
```

**Ce que ça crée :**
- ✅ Table `challenge_rankings`
- ✅ Fonction `calculate_challenge_rankings`
- ✅ Fonction `update_challenge_rankings`
- ✅ Fonction `trigger_update_rankings_on_ride_for_challenges`
- ✅ Vue `challenge_rankings_view`
- ✅ RLS policies

**⏱️ Durée : ~30 secondes**

---

### ÉTAPE 2 : Activer les triggers (OBLIGATOIRE)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/activate_challenge_rankings_trigger.sql
```

**OU**
```
supabase/SETUP_COMPLET_CLASSEMENTS.sql
```

**Ce que ça fait :**
- ✅ Active le trigger INSERT (mise à jour automatique à la création d'un trajet)
- ✅ Active le trigger UPDATE (mise à jour si un trajet est modifié)
- ✅ Active le trigger DELETE (mise à jour si un trajet est supprimé)
- ✅ Calcule les classements initiaux pour tous les défis actifs

**⏱️ Durée : ~10 secondes**

---

### ÉTAPE 3 : Vérifier que tout est OK (OPTIONNEL)

**Dans Supabase SQL Editor, exécuter :**
```
supabase/verify_challenge_rankings_setup.sql
```

**Ce que ça vérifie :**
- ✅ Toutes les tables existent
- ✅ Toutes les fonctions existent
- ✅ Tous les triggers sont activés
- ✅ RLS est configuré
- ✅ Affiche des statistiques

**⏱️ Durée : ~5 secondes**

---

## 🚨 Si vous avez une erreur

### Erreur : `relation "challenge_rankings" does not exist`

**Solution :** Vous n'avez pas exécuté l'ÉTAPE 1.
→ Exécutez d'abord `challenge_rankings.sql`

### Erreur : `function "trigger_update_rankings_on_ride_for_challenges" does not exist`

**Solution :** Vous n'avez pas exécuté l'ÉTAPE 1.
→ Exécutez d'abord `challenge_rankings.sql`

### Erreur : `trigger "update_challenge_rankings_on_ride_insert" already exists`

**Solution :** C'est normal, le script utilise `DROP TRIGGER IF EXISTS` donc ça devrait fonctionner quand même. Si ça bloque, exécutez manuellement :

```sql
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_delete ON rides;
```

Puis réexécutez `activate_challenge_rankings_trigger.sql`

---

## ✅ Checklist Finale

Après avoir exécuté les scripts, vous devriez avoir :

- [ ] Table `challenge_rankings` créée
- [ ] 3 fonctions SQL créées
- [ ] 3 triggers activés sur la table `rides`
- [ ] Vue `challenge_rankings_view` créée
- [ ] RLS activé avec policy
- [ ] Classements calculés pour les défis actifs

---

## 🧪 Test Rapide

Pour tester que tout fonctionne :

```sql
-- Vérifier qu'un trigger est actif
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name LIKE '%challenge_rankings%';

-- Devrait retourner 3 lignes :
-- - update_challenge_rankings_on_ride_insert
-- - update_challenge_rankings_on_ride_update  
-- - update_challenge_rankings_on_ride_delete
```

---

## 📝 Résumé

1. **Exécuter** `challenge_rankings.sql` → Crée tout le système
2. **Exécuter** `activate_challenge_rankings_trigger.sql` → Active les triggers
3. **Vérifier** `verify_challenge_rankings_setup.sql` → Confirme que tout est OK

**C'est tout !** Les classements se mettront à jour automatiquement à chaque trajet. 🎉

