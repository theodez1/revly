# Guide de Personnalisation Mapbox

Ce guide explique comment personnaliser votre carte Mapbox dans l'application StravaCar.

## Table des matières
1. [Changer le style de la carte](#changer-le-style-de-la-carte)
2. [Styles personnalisés Mapbox Studio](#styles-personnalisés-mapbox-studio)
3. [Personnaliser les couches de route](#personnaliser-les-couches-de-route)
4. [Personnaliser les marqueurs et annotations](#personnaliser-les-marqueurs-et-annotations)
5. [Options avancées de la carte](#options-avancées-de-la-carte)
6. [Exemples pratiques](#exemples-pratiques)

---

## Changer le style de la carte

### Styles prédéfinis Mapbox

Mapbox propose plusieurs styles prédéfinis que vous pouvez utiliser directement :

```javascript
import Mapbox from '@rnmapbox/maps';

// Dans votre composant MapView
<Mapbox.MapView
  styleURL={Mapbox.StyleURL.Street}  // Style par défaut (rue)
  // Autres options...
>
```

### Styles disponibles

1. **Street** (par défaut) - Style routier classique
   ```javascript
   styleURL={Mapbox.StyleURL.Street}
   ```

2. **Outdoors** - Style pour activités de plein air
   ```javascript
   styleURL={Mapbox.StyleURL.Outdoors}
   ```

3. **Light** - Style clair et minimaliste
   ```javascript
   styleURL={Mapbox.StyleURL.Light}
   ```

4. **Dark** - Style sombre
   ```javascript
   styleURL={Mapbox.StyleURL.Dark}
   ```

5. **Satellite** - Vue satellite
   ```javascript
   styleURL={Mapbox.StyleURL.Satellite}
   ```

6. **Satellite Streets** - Vue satellite avec noms de rues
   ```javascript
   styleURL={Mapbox.StyleURL.SatelliteStreet}
   ```

### Exemple d'implémentation

Pour changer le style dans `MapScreenFull.js` :

```javascript
// Ligne 1152 - Remplacer par le style souhaité
<Mapbox.MapView
  style={styles.map}
  styleURL={Mapbox.StyleURL.Dark}  // Changez ici
  logoEnabled={false}
  // ...
>
```

---

## Styles personnalisés Mapbox Studio

### Créer un style personnalisé

1. **Aller sur Mapbox Studio** : https://studio.mapbox.com/
2. **Créer un nouveau style** ou dupliquer un style existant
3. **Personnaliser** les couleurs, les polices, les icônes
4. **Publier** le style
5. **Copier l'URL du style** (format : `mapbox://styles/votre-username/style-id`)

### Utiliser un style personnalisé

```javascript
// Option 1 : URL complète
const customStyleURL = 'mapbox://styles/votre-username/style-id';

<Mapbox.MapView
  styleURL={customStyleURL}
  // ...
>

// Option 2 : URL JSON directe (si vous avez l'URL complète)
const customStyleURL = 'https://api.mapbox.com/styles/v1/votre-username/style-id/tiles?access_token=VOTRE_TOKEN';
```

### Exemple avec variable d'environnement

Dans `App.js`, vous pouvez créer une configuration :

```javascript
// App.js
const MAPBOX_STYLES = {
  default: Mapbox.StyleURL.Street,
  dark: Mapbox.StyleURL.Dark,
  satellite: Mapbox.StyleURL.Satellite,
  custom: 'mapbox://styles/votre-username/votre-style-id',
};

// Utiliser dans vos composants
<Mapbox.MapView styleURL={MAPBOX_STYLES.dark} />
```

---

## Personnaliser les couches de route

### Personnalisation actuelle

Dans `MapScreenFull.js` (lignes 1176-1187), vous avez déjà une couche de route personnalisée :

```javascript
<Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
  <Mapbox.LineLayer
    id="routeFill"
    style={{
      lineColor: '#2563EB',      // Couleur de la ligne
      lineWidth: 6,              // Épaisseur
      lineCap: 'round',          // Fin de ligne arrondie
      lineJoin: 'round',         // Jointure arrondie
    }}
  />
</Mapbox.ShapeSource>
```

### Options de personnalisation avancées

#### 1. Ligne avec dégradé de couleur (selon la vitesse)

```javascript
<Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
  {/* Ligne de contour (outline) */}
  <Mapbox.LineLayer
    id="routeOutline"
    style={{
      lineColor: 'rgba(255, 255, 255, 0.8)',
      lineWidth: 8,
      lineCap: 'round',
      lineJoin: 'round',
    }}
  />
  {/* Ligne principale */}
  <Mapbox.LineLayer
    id="routeFill"
    style={{
      lineColor: '#2563EB',
      lineWidth: 6,
      lineCap: 'round',
      lineJoin: 'round',
      lineOpacity: 0.9,
    }}
  />
</Mapbox.ShapeSource>
```

#### 2. Ligne animée (pointillés animés)

```javascript
<Mapbox.LineLayer
  id="routeFill"
  style={{
    lineColor: '#2563EB',
    lineWidth: 6,
    lineCap: 'round',
    lineJoin: 'round',
    lineDasharray: [2, 2],  // Pointillés
    lineOpacity: [
      'interpolate',
      ['linear'],
      ['get', 'distance'],
      0, 0.3,
      1000, 1.0
    ],
  }}
/>
```

#### 3. Ligne avec gradient basé sur l'altitude

Pour cela, vous devrez créer plusieurs segments avec des couleurs différentes selon l'altitude.

---

## Personnaliser les marqueurs et annotations

### PointAnnotation personnalisé

Dans `RunDetailScreen.js`, vous avez déjà des `PointAnnotation`. Voici comment les personnaliser :

```javascript
<Mapbox.PointAnnotation
  id="startPoint"
  coordinate={[startLng, startLat]}
>
  <View style={{
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',  // Vert pour le départ
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  }} />
</Mapbox.PointAnnotation>
```

### Icônes personnalisées

```javascript
<Mapbox.PointAnnotation
  id="customPoint"
  coordinate={[lng, lat]}
>
  <View style={styles.customMarker}>
    <Ionicons name="car" size={24} color="#1E3A8A" />
  </View>
</Mapbox.PointAnnotation>
```

### Marqueur avec label

```javascript
<Mapbox.PointAnnotation
  id="labeledPoint"
  coordinate={[lng, lat]}
>
  <View style={styles.markerContainer}>
    <View style={styles.markerCircle}>
      <Text style={styles.markerText}>A</Text>
    </View>
    <View style={styles.markerLabel}>
      <Text style={styles.labelText}>Point d'intérêt</Text>
    </View>
  </View>
</Mapbox.PointAnnotation>
```

---

## Options avancées de la carte

### Configuration de la caméra

```javascript
<Mapbox.Camera
  ref={cameraRef}
  defaultSettings={{
    centerCoordinate: [longitude, latitude],
    zoomLevel: 15,
    pitch: 45,           // Inclinaison (0-60)
    heading: 0,          // Orientation (0-360)
  }}
  followUserLocation={false}
  followUserMode="normal"  // ou "compass", "course"
/>
```

### Contrôles de la carte

```javascript
<Mapbox.MapView
  styleURL={Mapbox.StyleURL.Street}
  logoEnabled={false}              // Masquer le logo Mapbox
  attributionEnabled={false}       // Masquer l'attribution
  scaleBarEnabled={true}           // Afficher la barre d'échelle
  pitchEnabled={true}              // Autoriser l'inclinaison
  rotateEnabled={true}             // Autoriser la rotation
  scrollEnabled={true}             // Autoriser le défilement
  zoomEnabled={true}               // Autoriser le zoom
  compassEnabled={true}            // Afficher la boussole
  compassViewPosition={1}          // Position de la boussole
  compassViewMargins={{ x: 8, y: 8 }}
/>
```

### Mode nuit automatique

```javascript
import { useColorScheme } from 'react-native';

function MapScreen() {
  const colorScheme = useColorScheme();
  const mapStyle = colorScheme === 'dark' 
    ? Mapbox.StyleURL.Dark 
    : Mapbox.StyleURL.Street;

  return (
    <Mapbox.MapView
      styleURL={mapStyle}
      // ...
    />
  );
}
```

---

## Exemples pratiques

### Exemple 1 : Carte sombre avec route bleue brillante

```javascript
<Mapbox.MapView
  style={styles.map}
  styleURL={Mapbox.StyleURL.Dark}
  logoEnabled={false}
  attributionEnabled={false}
>
  <Mapbox.Camera
    ref={cameraRef}
    defaultSettings={{
      centerCoordinate: [longitude, latitude],
      zoomLevel: 15,
    }}
  />

  {routeGeoJSON && (
    <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
      {/* Contour blanc pour effet brillant */}
      <Mapbox.LineLayer
        id="routeOutline"
        style={{
          lineColor: 'rgba(59, 130, 246, 0.5)',
          lineWidth: 10,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Ligne principale bleue */}
      <Mapbox.LineLayer
        id="routeFill"
        style={{
          lineColor: '#3B82F6',
          lineWidth: 6,
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 0.9,
        }}
      />
    </Mapbox.ShapeSource>
  )}
</Mapbox.MapView>
```

### Exemple 2 : Vue satellite avec route colorée

```javascript
<Mapbox.MapView
  styleURL={Mapbox.StyleURL.SatelliteStreet}
  // ...
>
  {routeGeoJSON && (
    <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
      <Mapbox.LineLayer
        id="routeFill"
        style={{
          lineColor: '#EF4444',  // Rouge vif pour contraste
          lineWidth: 8,
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 0.95,
        }}
      />
    </Mapbox.ShapeSource>
  )}
</Mapbox.MapView>
```

### Exemple 3 : Sélecteur de style de carte

Ajoutez un sélecteur pour changer le style à la volée :

```javascript
const [mapStyle, setMapStyle] = useState(Mapbox.StyleURL.Street);

const styles = [
  { name: 'Rue', value: Mapbox.StyleURL.Street },
  { name: 'Satellite', value: Mapbox.StyleURL.Satellite },
  { name: 'Sombre', value: Mapbox.StyleURL.Dark },
  { name: 'Plein air', value: Mapbox.StyleURL.Outdoors },
];

return (
  <>
    <Mapbox.MapView styleURL={mapStyle} />
    
    {/* Sélecteur de style */}
    <View style={styles.styleSelector}>
      {styles.map((s) => (
        <TouchableOpacity
          key={s.name}
          onPress={() => setMapStyle(s.value)}
          style={[
            styles.styleButton,
            mapStyle === s.value && styles.styleButtonActive
          ]}
        >
          <Text>{s.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </>
);
```

### Exemple 4 : Route avec gradient de vitesse

Pour créer une route qui change de couleur selon la vitesse, vous devrez segmenter votre route :

```javascript
const createSpeedGradientRoute = (points) => {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const speed = points[i].speed || 0;
    const color = speed > 80 ? '#EF4444' : speed > 50 ? '#F59E0B' : '#10B981';
    
    segments.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [points[i].longitude, points[i].latitude],
          [points[i + 1].longitude, points[i + 1].latitude]
        ]
      },
      properties: { color, speed }
    });
  }
  
  return {
    type: 'FeatureCollection',
    features: segments
  };
};

// Utilisation
const gradientRoute = useMemo(
  () => createSpeedGradientRoute(trackingPoints),
  [trackingPoints]
);

<Mapbox.ShapeSource id="routeSource" shape={gradientRoute}>
  <Mapbox.LineLayer
    id="routeFill"
    style={{
      lineColor: ['get', 'color'],  // Utilise la couleur de la propriété
      lineWidth: 6,
      lineCap: 'round',
      lineJoin: 'round',
    }}
  />
</Mapbox.ShapeSource>
```

---

## Ressources utiles

- **Documentation Mapbox React Native** : https://github.com/rnmapbox/maps
- **Mapbox Studio** : https://studio.mapbox.com/
- **Style Reference** : https://docs.mapbox.com/mapbox-gl-js/style-spec/
- **Exemples de styles** : https://docs.mapbox.com/api/maps/styles/

---

## Notes importantes

1. **Token d'accès** : Assurez-vous que votre token Mapbox est correctement configuré dans `App.js`
2. **Performance** : Les styles personnalisés complexes peuvent affecter les performances
3. **Coûts** : Certains styles et fonctionnalités peuvent avoir des coûts associés selon votre plan Mapbox
4. **Cache** : Les styles sont mis en cache, les changements peuvent prendre quelques secondes à apparaître

---

## Prochaines étapes

Pour appliquer ces personnalisations :

1. **Choisir un style** : Décidez quel style vous préférez (Dark, Satellite, etc.)
2. **Personnaliser les routes** : Ajustez les couleurs et épaisseurs des lignes
3. **Tester** : Testez sur différents appareils et conditions
4. **Optimiser** : Ajustez selon les retours utilisateurs

Si vous souhaitez que j'implémente une personnalisation spécifique, dites-moi laquelle !

