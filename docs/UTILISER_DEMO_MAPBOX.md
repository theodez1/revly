# Comment utiliser le composant de démonstration Mapbox

Le composant `MapboxFeaturesDemo` vous permet de tester et explorer toutes les fonctionnalités Mapbox de manière interactive.

## Installation rapide

### Étape 1 : Ajouter temporairement dans votre écran

Dans `MapScreenFull.js` ou n'importe quel écran, ajoutez :

```javascript
import MapboxFeaturesDemo from '../../components/MapboxFeaturesDemo';

// Dans votre composant
const [showDemo, setShowDemo] = useState(false);

// Dans le JSX
{showDemo && (
  <MapboxFeaturesDemo
    onClose={() => setShowDemo(false)}
    initialLocation={currentLocation || { latitude: 48.8566, longitude: 2.3522 }}
  />
)}

// Bouton pour ouvrir la démo
<TouchableOpacity onPress={() => setShowDemo(true)}>
  <Text>Ouvrir démo Mapbox</Text>
</TouchableOpacity>
```

### Étape 2 : Tester les fonctionnalités

Le panneau de contrôle en bas vous permet de :

1. **Changer le style de carte** - Testez tous les styles disponibles
2. **Activer/désactiver les couches** :
   - Route
   - Marqueurs
   - Clustering (regroupement de points)
   - Heatmap (carte de chaleur)
   - Zones (polygones)
3. **Contrôler la caméra** :
   - Zoom in/out
   - Incliner la carte
   - Reset
   - Suivre l'utilisateur
4. **Capturer la carte** - Prendre un screenshot

## Fonctionnalités à explorer

### 1. Styles de carte

Testez tous les styles pour voir lequel correspond le mieux à votre app :
- **Rue** - Style routier classique
- **Satellite** - Vue satellite
- **Sombre** - Style sombre
- **Plein air** - Pour activités extérieures
- **Clair** - Style minimaliste

### 2. Clustering

Activez le clustering pour voir comment regrouper automatiquement les points proches. Utile si vous avez beaucoup de points d'intérêt.

### 3. Heatmap

La heatmap montre la densité de points. Parfait pour visualiser :
- Les zones les plus fréquentées
- Les routes les plus utilisées
- Les points chauds d'activité

### 4. Zones (FillLayer)

Les zones permettent de délimiter des régions. Utile pour :
- Zones de vitesse
- Périmètres
- Zones d'intérêt

### 5. Contrôles de caméra

Testez les différents modes de caméra :
- **Zoom** - Voir les détails ou la vue d'ensemble
- **Inclinaison** - Vue 3D pour plus de profondeur
- **Suivi utilisateur** - La carte suit automatiquement la position

## Ce que vous pouvez apprendre

En testant ce composant, vous découvrirez :

1. **Quels styles vous plaisent** - Choisissez celui qui correspond à votre design
2. **Quelles fonctionnalités sont utiles** - Clustering, heatmap, etc.
3. **Comment les couches interagissent** - Superposition, transparence, etc.
4. **Les performances** - Certaines fonctionnalités peuvent être plus lourdes

## Intégrer dans votre app

Une fois que vous avez testé et choisi les fonctionnalités qui vous intéressent :

1. **Consultez le guide complet** : `docs/MAPBOX_FEATURES_GUIDE.md`
2. **Copiez le code** des fonctionnalités qui vous plaisent
3. **Adaptez** à vos besoins spécifiques
4. **Intégrez** dans vos écrans existants

## Exemple : Ajouter le clustering

Si vous aimez le clustering, voici comment l'ajouter dans votre carte principale :

```javascript
// Dans MapScreenFull.js
{pointsOfInterest && (
  <Mapbox.ShapeSource
    id="poiSource"
    shape={pointsOfInterest}
    cluster={true}
    clusterRadius={50}
  >
    <Mapbox.CircleLayer
      id="clusters"
      filter={['has', 'point_count']}
      style={{
        circleColor: '#3B82F6',
        circleRadius: 20,
      }}
    />
  </Mapbox.ShapeSource>
)}
```

## Conseils

- **Testez sur un vrai appareil** - Les performances peuvent différer de l'émulateur
- **Essayez différents zoom levels** - Certaines fonctionnalités sont plus visibles à certains niveaux
- **Combinez les fonctionnalités** - Par exemple, route + heatmap + zones
- **Notez ce qui vous plaît** - Gardez une trace des fonctionnalités à intégrer

## Prochaines étapes

1. ✅ Tester le composant de démo
2. 📖 Lire le guide complet des fonctionnalités
3. 🎨 Choisir les fonctionnalités à intégrer
4. 💻 Implémenter dans votre app
5. 🚀 Tester et optimiser

Bon test ! 🗺️

