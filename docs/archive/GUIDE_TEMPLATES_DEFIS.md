# 🚀 Guide : Templates de Défis

## 📋 Vue d'ensemble

Le système de templates de défis permet aux admins/owners de groupes de lancer rapidement des défis prédéfinis sans avoir à créer manuellement chaque défi.

**Les templates sont stockés directement dans le code** (`data/challengeTemplates.js`), ce qui est plus simple et plus rapide que de les stocker en base de données.

## ✅ Utilisation dans l'app

**Le système est déjà intégré !**

1. **Dans `GroupDetailScreen`** :
   - Les admins/owners voient un bouton "Lancer" dans la section "Défis du groupe"
   - Cliquer sur "Lancer" ouvre un BottomSheet avec tous les templates disponibles

2. **Sélectionner un template** :
   - Les templates sont groupés par catégorie (Hebdomadaire, Mensuel, Saisonnier)
   - Chaque template affiche :
     - Nom et description
     - Type (distance, speed, count)
     - Objectif (ex: 1000 km)
     - Durée (ex: 30 jours)

3. **Lancer le défi** :
   - Cliquer sur un template lance le défi immédiatement
   - Le défi est créé avec :
     - Date de début : maintenant
     - Date de fin : maintenant + durée du template
     - Statut : `active`

## 🎯 Fonctionnalités

### Templates prédéfinis

Les templates sont organisés par catégorie :

- **Hebdomadaire** : Défis d'une semaine
- **Mensuel** : Défis d'un mois
- **Saisonnier** : Défis de longue durée
- **Personnalisé** : Templates créés par les admins

### Types de défis

1. **Distance** : Objectif en kilomètres
   - Ex: "1000 km en 30 jours"
   - Classement par distance totale

2. **Speed** : Objectif en vitesse
   - Ex: "Vitesse maximale"
   - Classement par vitesse maximale

3. **Count** : Objectif en nombre de trajets
   - Ex: "10 trajets en 30 jours"
   - Classement par nombre de trajets

### Permissions

- **Voir les templates** : Tous les utilisateurs authentifiés
- **Lancer un défi** : Uniquement les admins/owners du groupe
- **Créer des templates** : Uniquement les admins (via SQL pour l'instant)

## 📝 Ajouter de nouveaux templates

**Dans le fichier `data/challengeTemplates.js` :**

```javascript
{
  id: 'mon-nouveau-defi',
  name: 'Mon nouveau défi',
  description: 'Description du défi',
  type: 'distance', // 'distance', 'speed', ou 'count'
  targetValue: 500, // Valeur cible (km, km/h, ou nombre de trajets)
  durationDays: 14, // Durée en jours
  category: 'custom', // 'weekly', 'monthly', 'seasonal', ou 'custom'
  icon: 'map-outline', // Icône Ionicons
}
```

**Avantages de cette approche :**
- ✅ Pas besoin de base de données
- ✅ Plus rapide (pas de requête réseau)
- ✅ Versionné avec le code
- ✅ Facile à modifier

## 🔄 Flux de création d'un défi

1. **Admin clique sur "Lancer"** dans `GroupDetailScreen`
2. **BottomSheet s'ouvre** avec la liste des templates (chargés depuis `challengeTemplates.js`)
3. **Admin sélectionne un template**
4. **Calcul des dates** :
   - Date de début : maintenant
   - Date de fin : maintenant + `durationDays`
5. **Appel à `ChallengesService.createChallenge()`** avec les données du template
6. **Le défi est créé** dans la table `challenges`
7. **Le défi apparaît immédiatement** dans la liste des défis du groupe

## ⚠️ Points d'attention

1. **Les templates sont réutilisables** : Un même template peut être lancé plusieurs fois dans différents groupes
2. **Les défis créés sont indépendants** : Chaque lancement crée un nouveau défi
3. **Les dates sont calculées automatiquement** : La date de fin = date de début + durée du template
4. **Les classements se mettent à jour automatiquement** : Grâce au trigger sur la table `rides`

## 🎨 Interface utilisateur

### Composant `LaunchChallengeSheet`

- **Emplacement** : `components/LaunchChallengeSheet.js`
- **Fonctionnalités** :
  - Liste des templates groupés par catégorie
  - Affichage des métadonnées (objectif, durée)
  - Icônes colorées selon le type de défi
  - Loading states
  - Messages d'erreur

### Intégration dans `GroupDetailScreen`

- **Bouton "Lancer"** visible uniquement pour les admins/owners
- **Section vide** avec message si aucun défi actif
- **Rechargement automatique** après création d'un défi

## 📚 Fichiers utilisés

### `data/challengeTemplates.js`
Contient tous les templates prédéfinis et les fonctions utilitaires :
- `CHALLENGE_TEMPLATES` : Array de tous les templates
- `getTemplatesByCategory()` : Groupe les templates par catégorie
- `getTemplateById()` : Récupère un template par ID

### `ChallengesService.createChallenge()`
Crée un défi dans la base de données avec les données du template.

## 🚀 Prochaines étapes (optionnel)

1. **Interface pour créer des templates** : Permettre aux admins de créer des templates depuis l'app
2. **Templates privés par groupe** : Templates visibles uniquement pour certains groupes
3. **Historique des défis** : Voir les défis terminés
4. **Statistiques des templates** : Voir combien de fois un template a été utilisé


## 📋 Vue d'ensemble

Le système de templates de défis permet aux admins/owners de groupes de lancer rapidement des défis prédéfinis sans avoir à créer manuellement chaque défi.

**Les templates sont stockés directement dans le code** (`data/challengeTemplates.js`), ce qui est plus simple et plus rapide que de les stocker en base de données.

## ✅ Utilisation dans l'app

**Le système est déjà intégré !**

1. **Dans `GroupDetailScreen`** :
   - Les admins/owners voient un bouton "Lancer" dans la section "Défis du groupe"
   - Cliquer sur "Lancer" ouvre un BottomSheet avec tous les templates disponibles

2. **Sélectionner un template** :
   - Les templates sont groupés par catégorie (Hebdomadaire, Mensuel, Saisonnier)
   - Chaque template affiche :
     - Nom et description
     - Type (distance, speed, count)
     - Objectif (ex: 1000 km)
     - Durée (ex: 30 jours)

3. **Lancer le défi** :
   - Cliquer sur un template lance le défi immédiatement
   - Le défi est créé avec :
     - Date de début : maintenant
     - Date de fin : maintenant + durée du template
     - Statut : `active`

## 🎯 Fonctionnalités

### Templates prédéfinis

Les templates sont organisés par catégorie :

- **Hebdomadaire** : Défis d'une semaine
- **Mensuel** : Défis d'un mois
- **Saisonnier** : Défis de longue durée
- **Personnalisé** : Templates créés par les admins

### Types de défis

1. **Distance** : Objectif en kilomètres
   - Ex: "1000 km en 30 jours"
   - Classement par distance totale

2. **Speed** : Objectif en vitesse
   - Ex: "Vitesse maximale"
   - Classement par vitesse maximale

3. **Count** : Objectif en nombre de trajets
   - Ex: "10 trajets en 30 jours"
   - Classement par nombre de trajets

### Permissions

- **Voir les templates** : Tous les utilisateurs authentifiés
- **Lancer un défi** : Uniquement les admins/owners du groupe
- **Créer des templates** : Uniquement les admins (via SQL pour l'instant)

## 📝 Ajouter de nouveaux templates

**Dans le fichier `data/challengeTemplates.js` :**

```javascript
{
  id: 'mon-nouveau-defi',
  name: 'Mon nouveau défi',
  description: 'Description du défi',
  type: 'distance', // 'distance', 'speed', ou 'count'
  targetValue: 500, // Valeur cible (km, km/h, ou nombre de trajets)
  durationDays: 14, // Durée en jours
  category: 'custom', // 'weekly', 'monthly', 'seasonal', ou 'custom'
  icon: 'map-outline', // Icône Ionicons
}
```

**Avantages de cette approche :**
- ✅ Pas besoin de base de données
- ✅ Plus rapide (pas de requête réseau)
- ✅ Versionné avec le code
- ✅ Facile à modifier

## 🔄 Flux de création d'un défi

1. **Admin clique sur "Lancer"** dans `GroupDetailScreen`
2. **BottomSheet s'ouvre** avec la liste des templates (chargés depuis `challengeTemplates.js`)
3. **Admin sélectionne un template**
4. **Calcul des dates** :
   - Date de début : maintenant
   - Date de fin : maintenant + `durationDays`
5. **Appel à `ChallengesService.createChallenge()`** avec les données du template
6. **Le défi est créé** dans la table `challenges`
7. **Le défi apparaît immédiatement** dans la liste des défis du groupe

## ⚠️ Points d'attention

1. **Les templates sont réutilisables** : Un même template peut être lancé plusieurs fois dans différents groupes
2. **Les défis créés sont indépendants** : Chaque lancement crée un nouveau défi
3. **Les dates sont calculées automatiquement** : La date de fin = date de début + durée du template
4. **Les classements se mettent à jour automatiquement** : Grâce au trigger sur la table `rides`

## 🎨 Interface utilisateur

### Composant `LaunchChallengeSheet`

- **Emplacement** : `components/LaunchChallengeSheet.js`
- **Fonctionnalités** :
  - Liste des templates groupés par catégorie
  - Affichage des métadonnées (objectif, durée)
  - Icônes colorées selon le type de défi
  - Loading states
  - Messages d'erreur

### Intégration dans `GroupDetailScreen`

- **Bouton "Lancer"** visible uniquement pour les admins/owners
- **Section vide** avec message si aucun défi actif
- **Rechargement automatique** après création d'un défi

## 📚 Fichiers utilisés

### `data/challengeTemplates.js`
Contient tous les templates prédéfinis et les fonctions utilitaires :
- `CHALLENGE_TEMPLATES` : Array de tous les templates
- `getTemplatesByCategory()` : Groupe les templates par catégorie
- `getTemplateById()` : Récupère un template par ID

### `ChallengesService.createChallenge()`
Crée un défi dans la base de données avec les données du template.

## 🚀 Prochaines étapes (optionnel)

1. **Interface pour créer des templates** : Permettre aux admins de créer des templates depuis l'app
2. **Templates privés par groupe** : Templates visibles uniquement pour certains groupes
3. **Historique des défis** : Voir les défis terminés
4. **Statistiques des templates** : Voir combien de fois un template a été utilisé


## 📋 Vue d'ensemble

Le système de templates de défis permet aux admins/owners de groupes de lancer rapidement des défis prédéfinis sans avoir à créer manuellement chaque défi.

**Les templates sont stockés directement dans le code** (`data/challengeTemplates.js`), ce qui est plus simple et plus rapide que de les stocker en base de données.

## ✅ Utilisation dans l'app

**Le système est déjà intégré !**

1. **Dans `GroupDetailScreen`** :
   - Les admins/owners voient un bouton "Lancer" dans la section "Défis du groupe"
   - Cliquer sur "Lancer" ouvre un BottomSheet avec tous les templates disponibles

2. **Sélectionner un template** :
   - Les templates sont groupés par catégorie (Hebdomadaire, Mensuel, Saisonnier)
   - Chaque template affiche :
     - Nom et description
     - Type (distance, speed, count)
     - Objectif (ex: 1000 km)
     - Durée (ex: 30 jours)

3. **Lancer le défi** :
   - Cliquer sur un template lance le défi immédiatement
   - Le défi est créé avec :
     - Date de début : maintenant
     - Date de fin : maintenant + durée du template
     - Statut : `active`

## 🎯 Fonctionnalités

### Templates prédéfinis

Les templates sont organisés par catégorie :

- **Hebdomadaire** : Défis d'une semaine
- **Mensuel** : Défis d'un mois
- **Saisonnier** : Défis de longue durée
- **Personnalisé** : Templates créés par les admins

### Types de défis

1. **Distance** : Objectif en kilomètres
   - Ex: "1000 km en 30 jours"
   - Classement par distance totale

2. **Speed** : Objectif en vitesse
   - Ex: "Vitesse maximale"
   - Classement par vitesse maximale

3. **Count** : Objectif en nombre de trajets
   - Ex: "10 trajets en 30 jours"
   - Classement par nombre de trajets

### Permissions

- **Voir les templates** : Tous les utilisateurs authentifiés
- **Lancer un défi** : Uniquement les admins/owners du groupe
- **Créer des templates** : Uniquement les admins (via SQL pour l'instant)

## 📝 Ajouter de nouveaux templates

**Dans le fichier `data/challengeTemplates.js` :**

```javascript
{
  id: 'mon-nouveau-defi',
  name: 'Mon nouveau défi',
  description: 'Description du défi',
  type: 'distance', // 'distance', 'speed', ou 'count'
  targetValue: 500, // Valeur cible (km, km/h, ou nombre de trajets)
  durationDays: 14, // Durée en jours
  category: 'custom', // 'weekly', 'monthly', 'seasonal', ou 'custom'
  icon: 'map-outline', // Icône Ionicons
}
```

**Avantages de cette approche :**
- ✅ Pas besoin de base de données
- ✅ Plus rapide (pas de requête réseau)
- ✅ Versionné avec le code
- ✅ Facile à modifier

## 🔄 Flux de création d'un défi

1. **Admin clique sur "Lancer"** dans `GroupDetailScreen`
2. **BottomSheet s'ouvre** avec la liste des templates (chargés depuis `challengeTemplates.js`)
3. **Admin sélectionne un template**
4. **Calcul des dates** :
   - Date de début : maintenant
   - Date de fin : maintenant + `durationDays`
5. **Appel à `ChallengesService.createChallenge()`** avec les données du template
6. **Le défi est créé** dans la table `challenges`
7. **Le défi apparaît immédiatement** dans la liste des défis du groupe

## ⚠️ Points d'attention

1. **Les templates sont réutilisables** : Un même template peut être lancé plusieurs fois dans différents groupes
2. **Les défis créés sont indépendants** : Chaque lancement crée un nouveau défi
3. **Les dates sont calculées automatiquement** : La date de fin = date de début + durée du template
4. **Les classements se mettent à jour automatiquement** : Grâce au trigger sur la table `rides`

## 🎨 Interface utilisateur

### Composant `LaunchChallengeSheet`

- **Emplacement** : `components/LaunchChallengeSheet.js`
- **Fonctionnalités** :
  - Liste des templates groupés par catégorie
  - Affichage des métadonnées (objectif, durée)
  - Icônes colorées selon le type de défi
  - Loading states
  - Messages d'erreur

### Intégration dans `GroupDetailScreen`

- **Bouton "Lancer"** visible uniquement pour les admins/owners
- **Section vide** avec message si aucun défi actif
- **Rechargement automatique** après création d'un défi

## 📚 Fichiers utilisés

### `data/challengeTemplates.js`
Contient tous les templates prédéfinis et les fonctions utilitaires :
- `CHALLENGE_TEMPLATES` : Array de tous les templates
- `getTemplatesByCategory()` : Groupe les templates par catégorie
- `getTemplateById()` : Récupère un template par ID

### `ChallengesService.createChallenge()`
Crée un défi dans la base de données avec les données du template.

## 🚀 Prochaines étapes (optionnel)

1. **Interface pour créer des templates** : Permettre aux admins de créer des templates depuis l'app
2. **Templates privés par groupe** : Templates visibles uniquement pour certains groupes
3. **Historique des défis** : Voir les défis terminés
4. **Statistiques des templates** : Voir combien de fois un template a été utilisé

