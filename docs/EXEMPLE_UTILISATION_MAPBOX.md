# Exemple d'utilisation de la personnalisation Mapbox

Ce guide montre comment utiliser les fichiers de configuration et composants créés pour personnaliser Mapbox.

## Fichiers créés

1. **`config/mapboxStyles.js`** - Configuration centralisée des styles
2. **`components/MapStyleSelector.js`** - Composant sélecteur de style
3. **`docs/MAPBOX_CUSTOMIZATION.md`** - Guide complet de personnalisation

---

## Exemple 1 : Utiliser un style différent dans MapScreenFull.js

### Modification simple

Dans `screens/map/MapScreenFull.js`, remplacez la ligne 1152 :

```javascript
// AVANT
styleURL={Mapbox.StyleURL.Street}

// APRÈS - Utiliser le style sombre
import { MAPBOX_STYLES } from '../../config/mapboxStyles';

styleURL={MAPBOX_STYLES.dark}
```

### Avec état pour changer dynamiquement

```javascript
import { useState } from 'react';
import { MAPBOX_STYLES, DEFAULT_MAP_STYLE } from '../../config/mapboxStyles';

function StravaCarApp({ navigation }) {
  // Ajouter cet état
  const [mapStyle, setMapStyle] = useState(DEFAULT_MAP_STYLE);

  // Dans le JSX, ligne ~1152
  <Mapbox.MapView
    style={styles.map}
    styleURL={mapStyle}  // Utiliser l'état
    // ... autres props
  >
```

---

## Exemple 2 : Ajouter le sélecteur de style

### Étape 1 : Importer le composant

En haut de `MapScreenFull.js` :

```javascript
import MapStyleSelector from '../../components/MapStyleSelector';
import { MAPBOX_STYLES, DEFAULT_MAP_STYLE } from '../../config/mapboxStyles';
```

### Étape 2 : Ajouter l'état

```javascript
const [mapStyle, setMapStyle] = useState(DEFAULT_MAP_STYLE);
```

### Étape 3 : Utiliser le style dans MapView

```javascript
<Mapbox.MapView
  style={styles.map}
  styleURL={mapStyle}  // Au lieu de Mapbox.StyleURL.Street
  // ...
>
```

### Étape 4 : Ajouter le sélecteur dans le JSX

Après le `Mapbox.MapView`, ajoutez :

```javascript
{/* Sélecteur de style de carte */}
<MapStyleSelector
  currentStyle={mapStyle}
  onStyleChange={setMapStyle}
  position="top-right"
/>
```

---

## Exemple 3 : Personnaliser les couleurs de route selon le style

### Utiliser la fonction getRouteStyle

```javascript
import { getRouteStyle, MAPBOX_STYLES } from '../../config/mapboxStyles';

// Dans votre composant
const routeStyle = getRouteStyle(isTracking, isPaused, mapStyle);

// Dans le JSX
{routeGeoJSON && (
  <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
    {/* Si vous utilisez le style outlined */}
    {routeStyle.outline && (
      <Mapbox.LineLayer
        id="routeOutline"
        style={routeStyle.outline}
      />
    )}
    <Mapbox.LineLayer
      id="routeFill"
      style={routeStyle.main || routeStyle}
    />
  </Mapbox.ShapeSource>
)}
```

---

## Exemple 4 : Style adaptatif selon le thème système

### Détecter le thème et adapter le style

```javascript
import { useColorScheme } from 'react-native';
import { getMapStyleForTheme, MAPBOX_STYLES } from '../../config/mapboxStyles';

function StravaCarApp({ navigation }) {
  const colorScheme = useColorScheme();
  const [mapStyle, setMapStyle] = useState(
    getMapStyleForTheme(colorScheme)
  );

  // Mettre à jour quand le thème change
  useEffect(() => {
    setMapStyle(getMapStyleForTheme(colorScheme));
  }, [colorScheme]);

  // ...
}
```

---

## Exemple 5 : Route avec contour (effet brillant)

### Utiliser ROUTE_STYLES.outlined

```javascript
import { ROUTE_STYLES } from '../../config/mapboxStyles';

{routeGeoJSON && (
  <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
    {/* Contour */}
    <Mapbox.LineLayer
      id="routeOutline"
      style={ROUTE_STYLES.outlined.outline}
    />
    {/* Ligne principale */}
    <Mapbox.LineLayer
      id="routeFill"
      style={ROUTE_STYLES.outlined.main}
    />
  </Mapbox.ShapeSource>
)}
```

---

## Exemple 6 : Intégration complète dans MapScreenFull.js

Voici un exemple de modification complète (à ajouter dans votre fichier) :

```javascript
// 1. Imports en haut du fichier
import MapStyleSelector from '../../components/MapStyleSelector';
import { 
  MAPBOX_STYLES, 
  DEFAULT_MAP_STYLE,
  getRouteStyle,
  ROUTE_STYLES 
} from '../../config/mapboxStyles';
import { useColorScheme } from 'react-native';

// 2. Dans le composant StravaCarApp
function StravaCarApp({ navigation }) {
  const colorScheme = useColorScheme();
  const [mapStyle, setMapStyle] = useState(DEFAULT_MAP_STYLE);
  
  // ... reste du code existant ...

  // 3. Calculer le style de route
  const routeStyleConfig = useMemo(() => {
    return getRouteStyle(isTracking, isPaused, mapStyle);
  }, [isTracking, isPaused, mapStyle]);

  // 4. Dans le JSX, modifier MapView (ligne ~1150)
  <Mapbox.MapView
    style={styles.map}
    styleURL={mapStyle}  // Utiliser l'état au lieu de Mapbox.StyleURL.Street
    logoEnabled={false}
    attributionEnabled={false}
    scaleBarEnabled={false}
    pitchEnabled={false}
    rotateEnabled={false}
    scrollEnabled={!isTracking}
    zoomEnabled={!isTracking}
  >
    {/* ... Camera, UserLocation ... */}

    {routeGeoJSON && (
      <Mapbox.ShapeSource id="routeSource" shape={routeGeoJSON}>
        {/* Contour si disponible */}
        {routeStyleConfig.outline && (
          <Mapbox.LineLayer
            id="routeOutline"
            style={routeStyleConfig.outline}
          />
        )}
        {/* Ligne principale */}
        <Mapbox.LineLayer
          id="routeFill"
          style={routeStyleConfig.main || routeStyleConfig}
        />
      </Mapbox.ShapeSource>
    )}
  </Mapbox.MapView>

  {/* 5. Ajouter le sélecteur de style (après MapView) */}
  <MapStyleSelector
    currentStyle={mapStyle}
    onStyleChange={setMapStyle}
    position="top-right"
  />

  {/* ... reste du JSX ... */}
}
```

---

## Personnalisation avancée

### Ajouter votre propre style Mapbox Studio

1. Allez sur https://studio.mapbox.com/
2. Créez un nouveau style
3. Personnalisez-le
4. Publiez-le
5. Copiez l'URL (format: `mapbox://styles/username/style-id`)
6. Ajoutez-le dans `config/mapboxStyles.js` :

```javascript
export const MAPBOX_STYLES = {
  // ... styles existants ...
  monStyle: 'mapbox://styles/mon-username/mon-style-id',
};
```

7. Utilisez-le :

```javascript
const [mapStyle, setMapStyle] = useState(MAPBOX_STYLES.monStyle);
```

---

## Résumé des modifications possibles

| Modification | Fichier | Ligne approximative |
|-------------|---------|-------------------|
| Changer le style par défaut | `MapScreenFull.js` | ~1152 |
| Ajouter le sélecteur | `MapScreenFull.js` | Après MapView |
| Personnaliser les routes | `MapScreenFull.js` | ~1178 |
| Ajouter un style personnalisé | `config/mapboxStyles.js` | Dans MAPBOX_STYLES |

---

## Prochaines étapes

1. **Testez** les différents styles pour voir lequel vous préférez
2. **Personnalisez** les couleurs de route selon vos préférences
3. **Ajoutez** le sélecteur si vous voulez que les utilisateurs puissent changer
4. **Créez** votre propre style dans Mapbox Studio si besoin

Pour toute question, consultez le guide complet : `docs/MAPBOX_CUSTOMIZATION.md`

