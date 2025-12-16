# Guide Complet des Fonctionnalités Mapbox

Ce guide explore toutes les possibilités offertes par Mapbox dans React Native pour votre application de tracking automobile.

## Table des matières

1. [Styles de carte](#styles-de-carte)
2. [Couches (Layers)](#couches-layers)
3. [Sources de données](#sources-de-données)
4. [Annotations et marqueurs](#annotations-et-marqueurs)
5. [Caméra et navigation](#caméra-et-navigation)
6. [Localisation utilisateur](#localisation-utilisateur)
7. [Expressions et filtres](#expressions-et-filtres)
8. [Fonctionnalités avancées](#fonctionnalités-avancées)
9. [Exemples pratiques](#exemples-pratiques)

---

## Styles de carte

### Styles prédéfinis

```javascript
import Mapbox from '@rnmapbox/maps';

// Styles disponibles
Mapbox.StyleURL.Street        // Style routier classique
Mapbox.StyleURL.Outdoors      // Pour activités de plein air
Mapbox.StyleURL.Light         // Style clair et minimaliste
Mapbox.StyleURL.Dark          // Style sombre
Mapbox.StyleURL.Satellite      // Vue satellite pure
Mapbox.StyleURL.SatelliteStreet // Satellite avec noms de rues
```

### Style personnalisé depuis Mapbox Studio

```javascript
// URL de votre style personnalisé
const customStyle = 'mapbox://styles/votre-username/style-id';

<Mapbox.MapView styleURL={customStyle} />
```

### Changer le style dynamiquement

```javascript
const [mapStyle, setMapStyle] = useState(Mapbox.StyleURL.Light);

<Mapbox.MapView 
  styleURL={mapStyle}
  onDidFinishLoadingMap={() => console.log('Carte chargée')}
/>
```

---

## Couches (Layers)

### Types de couches disponibles

#### 1. **LineLayer** - Lignes et routes

```javascript
<Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
  <Mapbox.LineLayer
    id="routeLayer"
    style={{
      lineColor: '#3B82F6',
      lineWidth: 6,
      lineCap: 'round',      // 'butt' | 'round' | 'square'
      lineJoin: 'round',     // 'bevel' | 'round' | 'miter'
      lineOpacity: 0.9,
      lineDasharray: [2, 2], // Pointillés
      lineGradient: ['get', 'speed'], // Dégradé selon propriété
    }}
  />
</Mapbox.ShapeSource>
```

#### 2. **FillLayer** - Zones remplies

```javascript
<Mapbox.ShapeSource id="zoneSource" shape={zoneGeoJSON}>
  <Mapbox.FillLayer
    id="zoneLayer"
    style={{
      fillColor: '#3B82F6',
      fillOpacity: 0.3,
      fillOutlineColor: '#1E40AF',
    }}
  />
</Mapbox.ShapeSource>
```

#### 3. **CircleLayer** - Points circulaires

```javascript
<Mapbox.ShapeSource id="pointsSource" shape={pointsGeoJSON}>
  <Mapbox.CircleLayer
    id="pointsLayer"
    style={{
      circleRadius: 8,
      circleColor: '#EF4444',
      circleStrokeWidth: 2,
      circleStrokeColor: '#FFFFFF',
      circleOpacity: 0.8,
    }}
  />
</Mapbox.ShapeSource>
```

#### 4. **SymbolLayer** - Icônes et texte

```javascript
<Mapbox.ShapeSource id="symbolsSource" shape={symbolsGeoJSON}>
  <Mapbox.SymbolLayer
    id="symbolsLayer"
    style={{
      iconImage: 'marker-icon',
      iconSize: 1.5,
      iconAllowOverlap: true,
      textField: ['get', 'name'],
      textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
      textSize: 12,
      textColor: '#1F2937',
    }}
  />
</Mapbox.ShapeSource>
```

#### 5. **RasterLayer** - Images raster

```javascript
<Mapbox.RasterSource id="rasterSource" url="https://example.com/tiles/{z}/{x}/{y}.png">
  <Mapbox.RasterLayer
    id="rasterLayer"
    style={{
      rasterOpacity: 0.7,
    }}
  />
</Mapbox.RasterSource>
```

---

## Sources de données

### ShapeSource - GeoJSON

```javascript
const geoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[lng1, lat1], [lng2, lat2]]
      },
      properties: {
        speed: 50,
        color: '#3B82F6'
      }
    }
  ]
};

<Mapbox.ShapeSource 
  id="mySource" 
  shape={geoJSON}
  cluster={true}              // Activer le clustering
  clusterRadius={50}          // Rayon de cluster
  clusterMaxZoomLevel={14}    // Zoom max pour clusters
>
  {/* Layers */}
</Mapbox.ShapeSource>
```

### ImageSource - Images personnalisées

```javascript
<Mapbox.ImageSource
  id="imageSource"
  url="https://example.com/image.png"
  coordinates={[
    [lng1, lat1], // Top-left
    [lng2, lat1], // Top-right
    [lng2, lat2], // Bottom-right
    [lng1, lat2]  // Bottom-left
  ]}
>
  <Mapbox.RasterLayer id="imageLayer" />
</Mapbox.ImageSource>
```

### VectorSource - Tuiles vectorielles

```javascript
<Mapbox.VectorSource
  id="vectorSource"
  url="mapbox://mapbox.mapbox-streets-v8"
>
  <Mapbox.LineLayer
    id="roadsLayer"
    sourceLayerID="road"
    style={{
      lineColor: '#FF0000',
      lineWidth: 2,
    }}
  />
</Mapbox.VectorSource>
```

---

## Annotations et marqueurs

### PointAnnotation - Marqueurs personnalisés

```javascript
<Mapbox.PointAnnotation
  id="marker1"
  coordinate={[longitude, latitude]}
  anchor={{ x: 0.5, y: 0.5 }}
  onSelected={() => console.log('Sélectionné')}
>
  <View style={styles.customMarker}>
    <Ionicons name="car" size={24} color="#3B82F6" />
  </View>
</Mapbox.PointAnnotation>
```

### Callout - Bulles d'information

```javascript
<Mapbox.PointAnnotation
  id="marker1"
  coordinate={[longitude, latitude]}
>
  <View style={styles.marker}>
    <Ionicons name="location" size={24} color="#EF4444" />
  </View>
  <Mapbox.Callout title="Titre" subtitle="Sous-titre">
    <View>
      <Text>Contenu personnalisé</Text>
    </View>
  </Mapbox.Callout>
</Mapbox.PointAnnotation>
```

### Annotation avec animation

```javascript
const [scale, setScale] = useState(1);

useEffect(() => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 1000 }),
      Animated.timing(scale, { toValue: 1, duration: 1000 }),
    ])
  ).start();
}, []);

<Mapbox.PointAnnotation coordinate={[lng, lat]}>
  <Animated.View style={{ transform: [{ scale }] }}>
    <View style={styles.pulsingMarker} />
  </Animated.View>
</Mapbox.PointAnnotation>
```

---

## Caméra et navigation

### Camera - Contrôle de la vue

```javascript
const cameraRef = useRef(null);

<Mapbox.Camera
  ref={cameraRef}
  defaultSettings={{
    centerCoordinate: [longitude, latitude],
    zoomLevel: 15,
    pitch: 45,           // Inclinaison (0-60)
    heading: 0,          // Orientation (0-360)
    animationDuration: 1000,
  }}
  followUserLocation={true}
  followUserMode="course"  // 'normal' | 'course' | 'compass'
  followZoomLevel={16}
  followPitch={45}
  followHeading={0}
/>

// Animer la caméra
cameraRef.current?.setCamera({
  centerCoordinate: [newLng, newLat],
  zoomLevel: 18,
  pitch: 60,
  heading: 90,
  animationDuration: 2000,
});
```

### Suivi automatique du véhicule

```javascript
<Mapbox.Camera
  ref={cameraRef}
  followUserLocation={isTracking}
  followUserMode="course"
  followZoomLevel={16}
  followPitch={45}
  animationDuration={500}
/>

// Mettre à jour la position
useEffect(() => {
  if (currentLocation && isTracking) {
    cameraRef.current?.setCamera({
      centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
      heading: currentBearing,
      animationDuration: 500,
    });
  }
}, [currentLocation, isTracking]);
```

### Bounds - Ajuster à une zone

```javascript
<Mapbox.Camera
  bounds={{
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  }}
  padding={{ top: 50, bottom: 50, left: 50, right: 50 }}
  animationDuration={1000}
/>
```

---

## Localisation utilisateur

### UserLocation - Position GPS

```javascript
<Mapbox.UserLocation
  visible={true}
  showsUserHeadingIndicator={true}
  androidRenderMode="gps"        // 'normal' | 'compass' | 'gps'
  renderMode="native"             // 'normal' | 'native'
  requestsAlwaysUse={false}
  minDisplacement={1}             // Distance min pour mise à jour
  animated={true}
/>
```

### Personnaliser l'apparence

```javascript
// Note: UserLocation ne peut pas être stylisé directement
// Utilisez un PointAnnotation personnalisé à la place

<Mapbox.PointAnnotation
  id="userLocation"
  coordinate={[userLng, userLat]}
>
  <View style={styles.userLocationMarker}>
    <View style={styles.pulseCircle} />
    <View style={styles.innerCircle} />
    <Ionicons name="navigate" size={24} color="#3B82F6" />
  </View>
</Mapbox.PointAnnotation>
```

---

## Expressions et filtres

### Expressions de style dynamiques

```javascript
<Mapbox.LineLayer
  id="routeLayer"
  style={{
    // Couleur selon la vitesse
    lineColor: [
      'interpolate',
      ['linear'],
      ['get', 'speed'],
      0, '#10B981',    // Vert pour 0 km/h
      30, '#FBBF24',   // Jaune pour 30 km/h
      60, '#F59E0B',    // Orange pour 60 km/h
      100, '#EF4444'    // Rouge pour 100+ km/h
    ],
    // Épaisseur selon le zoom
    lineWidth: [
      'interpolate',
      ['linear'],
      ['zoom'],
      10, 3,
      15, 6,
      20, 10
    ],
    // Opacité conditionnelle
    lineOpacity: [
      'case',
      ['get', 'isActive'],
      1,
      0.5
    ],
  }}
/>
```

### Filtres - Afficher selon conditions

```javascript
<Mapbox.LineLayer
  id="fastRouteLayer"
  filter={['>', ['get', 'speed'], 80]}  // Seulement > 80 km/h
  style={{
    lineColor: '#EF4444',
    lineWidth: 8,
  }}
/>
```

### Expressions avancées

```javascript
// Couleur selon plusieurs conditions
lineColor: [
  'case',
  ['>', ['get', 'speed'], 100], '#EF4444',  // Rouge si > 100
  ['>', ['get', 'speed'], 60], '#F59E0B',    // Orange si > 60
  '#10B981'                                   // Vert sinon
]

// Taille selon distance
circleRadius: [
  'interpolate',
  ['exponential', 1.5],
  ['get', 'distance'],
  0, 5,
  1000, 10,
  5000, 20
]
```

---

## Fonctionnalités avancées

### Clustering - Regrouper les points

```javascript
<Mapbox.ShapeSource
  id="pointsSource"
  shape={pointsGeoJSON}
  cluster={true}
  clusterRadius={50}
  clusterMaxZoomLevel={14}
>
  {/* Couche pour les clusters */}
  <Mapbox.CircleLayer
    id="clusters"
    filter={['has', 'point_count']}
    style={{
      circleColor: [
        'step',
        ['get', 'point_count'],
        '#3B82F6',
        10, '#F59E0B',
        50, '#EF4444'
      ],
      circleRadius: [
        'step',
        ['get', 'point_count'],
        20,
        10, 30,
        50, 40
      ],
    }}
  />
  
  {/* Couche pour les points individuels */}
  <Mapbox.CircleLayer
    id="points"
    filter={['!', ['has', 'point_count']]}
    style={{
      circleColor: '#3B82F6',
      circleRadius: 8,
    }}
  />
</Mapbox.ShapeSource>
```

### Heatmap - Carte de chaleur

```javascript
<Mapbox.ShapeSource
  id="heatmapSource"
  shape={pointsGeoJSON}
>
  <Mapbox.HeatmapLayer
    id="heatmap"
    style={{
      heatmapColor: [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(178,24,43)'
      ],
      heatmapRadius: 20,
      heatmapWeight: [
        'interpolate',
        ['linear'],
        ['get', 'value'],
        0, 0,
        6, 1
      ],
      heatmapIntensity: [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 1,
        9, 3
      ],
    }}
  />
</Mapbox.ShapeSource>
```

### Offline Maps - Cartes hors ligne

```javascript
import Mapbox from '@rnmapbox/maps';

// Télécharger une région pour usage hors ligne
const downloadRegion = async () => {
  const bounds = {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  };
  
  const pack = await Mapbox.offlineManager.createPack({
    name: 'Ma région',
    styleURL: Mapbox.StyleURL.Street,
    bounds: bounds,
    minZoom: 10,
    maxZoom: 16,
  });
  
  console.log('Pack créé:', pack);
};

// Utiliser une carte hors ligne
<Mapbox.MapView
  styleURL={Mapbox.StyleURL.Street}
  offlineMode={true}
/>
```

### Snapshot - Capturer la carte

```javascript
const captureMap = async () => {
  const uri = await mapRef.current?.takeSnap({
    width: 1080,
    height: 1920,
    writeToDisk: true,
  });
  
  console.log('Capture sauvegardée:', uri);
};
```

### Événements de la carte

```javascript
<Mapbox.MapView
  onDidFinishLoadingMap={() => console.log('Carte chargée')}
  onDidFailLoadingMap={(error) => console.error('Erreur:', error)}
  onRegionDidChange={(feature) => console.log('Région changée:', feature)}
  onRegionWillChange={(feature) => console.log('Région va changer:', feature)}
  onUserLocationUpdate={(location) => console.log('Position:', location)}
  onPress={(feature) => console.log('Clic:', feature)}
  onLongPress={(feature) => console.log('Long clic:', feature)}
/>
```

---

## Exemples pratiques

### Exemple 1 : Route avec gradient de vitesse

```javascript
const createSpeedGradientRoute = (points) => {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const speed = points[i].speed || 0;
    segments.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [points[i].longitude, points[i].latitude],
          [points[i + 1].longitude, points[i + 1].latitude]
        ]
      },
      properties: { speed }
    });
  }
  return { type: 'FeatureCollection', features: segments };
};

<Mapbox.ShapeSource shape={createSpeedGradientRoute(trackingPoints)}>
  <Mapbox.LineLayer
    style={{
      lineColor: [
        'interpolate',
        ['linear'],
        ['get', 'speed'],
        0, '#10B981',
        50, '#FBBF24',
        80, '#F59E0B',
        120, '#EF4444'
      ],
      lineWidth: 6,
    }}
  />
</Mapbox.ShapeSource>
```

### Exemple 2 : Zones de vitesse avec FillLayer

```javascript
const speedZones = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[/* zone coordinates */]]
      },
      properties: { zone: 'slow', maxSpeed: 50 }
    }
  ]
};

<Mapbox.ShapeSource shape={speedZones}>
  <Mapbox.FillLayer
    style={{
      fillColor: [
        'case',
        ['==', ['get', 'zone'], 'slow'], '#10B981',
        ['==', ['get', 'zone'], 'medium'], '#FBBF24',
        '#EF4444'
      ],
      fillOpacity: 0.2,
    }}
  />
</Mapbox.ShapeSource>
```

### Exemple 3 : Marqueurs animés pour points d'intérêt

```javascript
const [animatedMarkers, setAnimatedMarkers] = useState([]);

useEffect(() => {
  const interval = setInterval(() => {
    setAnimatedMarkers(prev => prev.map(m => ({
      ...m,
      scale: m.scale === 1 ? 1.2 : 1
    })));
  }, 1000);
  return () => clearInterval(interval);
}, []);

{pointsOfInterest.map((poi, index) => (
  <Mapbox.PointAnnotation
    key={poi.id}
    coordinate={[poi.lng, poi.lat]}
  >
    <Animated.View style={{
      transform: [{ scale: animatedMarkers[index]?.scale || 1 }]
    }}>
      <View style={styles.poiMarker}>
        <Ionicons name={poi.icon} size={20} color="#3B82F6" />
      </View>
    </Animated.View>
  </Mapbox.PointAnnotation>
))}
```

### Exemple 4 : Carte avec plusieurs styles superposés

```javascript
<Mapbox.MapView styleURL={Mapbox.StyleURL.Satellite}>
  {/* Routes principales */}
  <Mapbox.ShapeSource shape={mainRoutes}>
    <Mapbox.LineLayer style={{ lineColor: '#3B82F6', lineWidth: 8 }} />
  </Mapbox.ShapeSource>
  
  {/* Routes secondaires */}
  <Mapbox.ShapeSource shape={secondaryRoutes}>
    <Mapbox.LineLayer style={{ lineColor: '#60A5FA', lineWidth: 4 }} />
  </Mapbox.ShapeSource>
  
  {/* Points d'intérêt */}
  <Mapbox.ShapeSource shape={pois}>
    <Mapbox.CircleLayer style={{
      circleColor: '#EF4444',
      circleRadius: 6
    }} />
  </Mapbox.ShapeSource>
</Mapbox.MapView>
```

---

## Ressources

- **Documentation officielle** : https://github.com/rnmapbox/maps
- **Mapbox Style Spec** : https://docs.mapbox.com/mapbox-gl-js/style-spec/
- **Mapbox Studio** : https://studio.mapbox.com/
- **Exemples** : https://docs.mapbox.com/mapbox-gl-js/example/

---

## Prochaines étapes

1. **Tester les différents styles** pour trouver celui qui convient
2. **Expérimenter avec les expressions** pour des styles dynamiques
3. **Créer des styles personnalisés** dans Mapbox Studio
4. **Implémenter le clustering** si vous avez beaucoup de points
5. **Ajouter des heatmaps** pour visualiser les zones fréquentées

