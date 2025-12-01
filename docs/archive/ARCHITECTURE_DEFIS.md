# Architecture du Système de Défis

## 🎯 Concept

Le système combine **défis prédéfinis (templates)** et **défis personnalisés** avec un système d'activation pour une durée limitée.

## 📋 Structure

### 1. **Templates de Défis** (`challenge_templates`)
Défis prédéfinis réutilisables créés par les admins :
- **Avantages** : Cohérence, facilité d'utilisation, défis récurrents
- **Exemples** : "1000 km en 30 jours", "10 trajets par semaine"
- **Catégories** : `weekly`, `monthly`, `seasonal`, `custom`

### 2. **Défis Actifs** (`challenges`)
Défis lancés dans un groupe pour une durée spécifique :
- Créés depuis un template OU personnalisés
- Ont une `start_date` et `end_date`
- Statut : `draft`, `active`, `paused`, `completed`, `cancelled`

### 3. **Participants** (`challenge_participants`)
Suivi de la progression de chaque participant

## 🔄 Flux d'Utilisation

### Option A : Défi depuis Template (Recommandé)
```
1. Admin crée des templates prédéfinis
2. Utilisateur choisit un template dans son groupe
3. Le défi est activé pour une durée spécifique
4. Les membres du groupe peuvent rejoindre
5. Le défi se termine automatiquement à la date de fin
```

### Option B : Défi Personnalisé
```
1. Utilisateur crée un défi custom dans son groupe
2. Définit titre, type, valeur cible, durée
3. Le défi est activé immédiatement
4. Les membres peuvent rejoindre
```

## 💡 Avantages de cette Architecture

✅ **Flexibilité** : Templates pour défis récurrents + personnalisation
✅ **Simplicité** : Les utilisateurs lancent facilement des défis depuis templates
✅ **Cohérence** : Les défis prédéfinis sont testés et équilibrés
✅ **Engagement** : Défis avec durée limitée créent de l'urgence
✅ **Réutilisabilité** : Un template peut être utilisé par plusieurs groupes

## 🎮 Exemples de Templates Prédéfinis

### Distance
- "1000 km en 30 jours"
- "500 km en 7 jours"
- "2000 km en 60 jours"

### Vitesse
- "Vitesse maximale du mois"
- "Moyenne 100 km/h sur un trajet"

### Comptage
- "10 trajets en 30 jours"
- "5 trajets par semaine"

### Temps
- "10 heures de conduite"

## 📱 Interface Utilisateur Proposée

### Dans un Groupe :
1. **Onglet "Défis"** avec :
   - Défis actifs du groupe
   - Bouton "Créer un défi"
   - Section "Templates disponibles"

2. **Créer un défi** :
   - Option 1 : Choisir un template → Personnaliser la date de début
   - Option 2 : Créer un défi personnalisé

3. **Détail d'un défi** :
   - Progression des participants
   - Classement
   - Temps restant
   - Bouton "Rejoindre"

## 🔧 Implémentation Technique

### Tables SQL
- `challenge_templates` : Templates prédéfinis
- `challenges` : Défis actifs (avec `template_id` optionnel)
- `challenge_participants` : Progression

### Fonctions
- `create_challenge_from_template()` : Crée un défi depuis un template
- Services JavaScript pour gérer templates et défis

### Services
- `ChallengesService.getTemplates()` : Liste des templates disponibles
- `ChallengesService.createFromTemplate()` : Active un template
- `ChallengesService.createCustom()` : Crée un défi personnalisé


## 🎯 Concept

Le système combine **défis prédéfinis (templates)** et **défis personnalisés** avec un système d'activation pour une durée limitée.

## 📋 Structure

### 1. **Templates de Défis** (`challenge_templates`)
Défis prédéfinis réutilisables créés par les admins :
- **Avantages** : Cohérence, facilité d'utilisation, défis récurrents
- **Exemples** : "1000 km en 30 jours", "10 trajets par semaine"
- **Catégories** : `weekly`, `monthly`, `seasonal`, `custom`

### 2. **Défis Actifs** (`challenges`)
Défis lancés dans un groupe pour une durée spécifique :
- Créés depuis un template OU personnalisés
- Ont une `start_date` et `end_date`
- Statut : `draft`, `active`, `paused`, `completed`, `cancelled`

### 3. **Participants** (`challenge_participants`)
Suivi de la progression de chaque participant

## 🔄 Flux d'Utilisation

### Option A : Défi depuis Template (Recommandé)
```
1. Admin crée des templates prédéfinis
2. Utilisateur choisit un template dans son groupe
3. Le défi est activé pour une durée spécifique
4. Les membres du groupe peuvent rejoindre
5. Le défi se termine automatiquement à la date de fin
```

### Option B : Défi Personnalisé
```
1. Utilisateur crée un défi custom dans son groupe
2. Définit titre, type, valeur cible, durée
3. Le défi est activé immédiatement
4. Les membres peuvent rejoindre
```

## 💡 Avantages de cette Architecture

✅ **Flexibilité** : Templates pour défis récurrents + personnalisation
✅ **Simplicité** : Les utilisateurs lancent facilement des défis depuis templates
✅ **Cohérence** : Les défis prédéfinis sont testés et équilibrés
✅ **Engagement** : Défis avec durée limitée créent de l'urgence
✅ **Réutilisabilité** : Un template peut être utilisé par plusieurs groupes

## 🎮 Exemples de Templates Prédéfinis

### Distance
- "1000 km en 30 jours"
- "500 km en 7 jours"
- "2000 km en 60 jours"

### Vitesse
- "Vitesse maximale du mois"
- "Moyenne 100 km/h sur un trajet"

### Comptage
- "10 trajets en 30 jours"
- "5 trajets par semaine"

### Temps
- "10 heures de conduite"

## 📱 Interface Utilisateur Proposée

### Dans un Groupe :
1. **Onglet "Défis"** avec :
   - Défis actifs du groupe
   - Bouton "Créer un défi"
   - Section "Templates disponibles"

2. **Créer un défi** :
   - Option 1 : Choisir un template → Personnaliser la date de début
   - Option 2 : Créer un défi personnalisé

3. **Détail d'un défi** :
   - Progression des participants
   - Classement
   - Temps restant
   - Bouton "Rejoindre"

## 🔧 Implémentation Technique

### Tables SQL
- `challenge_templates` : Templates prédéfinis
- `challenges` : Défis actifs (avec `template_id` optionnel)
- `challenge_participants` : Progression

### Fonctions
- `create_challenge_from_template()` : Crée un défi depuis un template
- Services JavaScript pour gérer templates et défis

### Services
- `ChallengesService.getTemplates()` : Liste des templates disponibles
- `ChallengesService.createFromTemplate()` : Active un template
- `ChallengesService.createCustom()` : Crée un défi personnalisé


## 🎯 Concept

Le système combine **défis prédéfinis (templates)** et **défis personnalisés** avec un système d'activation pour une durée limitée.

## 📋 Structure

### 1. **Templates de Défis** (`challenge_templates`)
Défis prédéfinis réutilisables créés par les admins :
- **Avantages** : Cohérence, facilité d'utilisation, défis récurrents
- **Exemples** : "1000 km en 30 jours", "10 trajets par semaine"
- **Catégories** : `weekly`, `monthly`, `seasonal`, `custom`

### 2. **Défis Actifs** (`challenges`)
Défis lancés dans un groupe pour une durée spécifique :
- Créés depuis un template OU personnalisés
- Ont une `start_date` et `end_date`
- Statut : `draft`, `active`, `paused`, `completed`, `cancelled`

### 3. **Participants** (`challenge_participants`)
Suivi de la progression de chaque participant

## 🔄 Flux d'Utilisation

### Option A : Défi depuis Template (Recommandé)
```
1. Admin crée des templates prédéfinis
2. Utilisateur choisit un template dans son groupe
3. Le défi est activé pour une durée spécifique
4. Les membres du groupe peuvent rejoindre
5. Le défi se termine automatiquement à la date de fin
```

### Option B : Défi Personnalisé
```
1. Utilisateur crée un défi custom dans son groupe
2. Définit titre, type, valeur cible, durée
3. Le défi est activé immédiatement
4. Les membres peuvent rejoindre
```

## 💡 Avantages de cette Architecture

✅ **Flexibilité** : Templates pour défis récurrents + personnalisation
✅ **Simplicité** : Les utilisateurs lancent facilement des défis depuis templates
✅ **Cohérence** : Les défis prédéfinis sont testés et équilibrés
✅ **Engagement** : Défis avec durée limitée créent de l'urgence
✅ **Réutilisabilité** : Un template peut être utilisé par plusieurs groupes

## 🎮 Exemples de Templates Prédéfinis

### Distance
- "1000 km en 30 jours"
- "500 km en 7 jours"
- "2000 km en 60 jours"

### Vitesse
- "Vitesse maximale du mois"
- "Moyenne 100 km/h sur un trajet"

### Comptage
- "10 trajets en 30 jours"
- "5 trajets par semaine"

### Temps
- "10 heures de conduite"

## 📱 Interface Utilisateur Proposée

### Dans un Groupe :
1. **Onglet "Défis"** avec :
   - Défis actifs du groupe
   - Bouton "Créer un défi"
   - Section "Templates disponibles"

2. **Créer un défi** :
   - Option 1 : Choisir un template → Personnaliser la date de début
   - Option 2 : Créer un défi personnalisé

3. **Détail d'un défi** :
   - Progression des participants
   - Classement
   - Temps restant
   - Bouton "Rejoindre"

## 🔧 Implémentation Technique

### Tables SQL
- `challenge_templates` : Templates prédéfinis
- `challenges` : Défis actifs (avec `template_id` optionnel)
- `challenge_participants` : Progression

### Fonctions
- `create_challenge_from_template()` : Crée un défi depuis un template
- Services JavaScript pour gérer templates et défis

### Services
- `ChallengesService.getTemplates()` : Liste des templates disponibles
- `ChallengesService.createFromTemplate()` : Active un template
- `ChallengesService.createCustom()` : Crée un défi personnalisé

