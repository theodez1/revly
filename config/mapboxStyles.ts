import Mapbox from '@rnmapbox/maps';
import { LineLayerStyle } from '@rnmapbox/maps';

/**
 * Configuration des styles Mapbox disponibles dans l'application
 * 
 * Pour utiliser un style personnalisé depuis Mapbox Studio :
 * 1. Allez sur https://studio.mapbox.com/
 * 2. Créez ou dupliquez un style
 * 3. Personnalisez-le selon vos besoins
 * 4. Publiez-le et copiez l'URL (format: mapbox://styles/username/style-id)
 * 5. Ajoutez-le dans le tableau MAPBOX_STYLES ci-dessous
 */

// Styles prédéfinis Mapbox
export const MAPBOX_STYLES = {
  // Style routier classique (par défaut)
  street: Mapbox.StyleURL.Street,

  // Style pour activités de plein air
  outdoors: Mapbox.StyleURL.Outdoors,

  // Style clair et minimaliste
  light: Mapbox.StyleURL.Light,

  // Style sombre
  dark: Mapbox.StyleURL.Dark,

  // Vue satellite
  satellite: Mapbox.StyleURL.Satellite,

  // Vue satellite avec noms de rues
  satelliteStreet: Mapbox.StyleURL.SatelliteStreet,

  // ⚠️ Ajoutez vos styles personnalisés ici
  // custom: 'mapbox://styles/votre-username/votre-style-id',
  customNoTraffic: 'mapbox://styles/theodez/cmioktukg000j01r0dlvh8u19',
};

// Style par défaut (Streets pour le look classique Mapbox)
export const DEFAULT_MAP_STYLE = MAPBOX_STYLES.street;

// Configuration des couleurs de route (palette moderne et harmonieuse)
export const ROUTE_COLORS = {
  default: '#60A5FA',      // Bleu clair moderne (principal)
  active: '#3B82F6',       // Bleu actif (intérieur)
  paused: '#94A3B8',      // Gris pour pause
  fast: '#F87171',         // Rouge doux pour vitesse élevée
  medium: '#FBBF24',      // Jaune/Orange doux pour vitesse moyenne
  slow: '#34D399',         // Vert doux pour vitesse faible
  outline: 'rgba(59, 130, 246, 0.6)',  // Contour bleu avec transparence
  inner: '#3B82F6',        // Ligne intérieure pour profondeur
};

// Configuration des épaisseurs de ligne
export const ROUTE_WIDTHS = {
  thin: 3,
  normal: 4,
  thick: 6,
  veryThick: 8,
};

interface RouteStyleConfig {
  lineColor: string;
  lineWidth: number;
  lineCap: 'round' | 'butt' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
  lineOpacity?: number;
}

interface CompositeRouteStyle {
  outline?: RouteStyleConfig;
  main?: RouteStyleConfig;
  inner?: RouteStyleConfig;
  lineColor?: string;
  lineWidth?: number;
  lineCap?: 'round' | 'butt' | 'square';
  lineJoin?: 'round' | 'bevel' | 'miter';
  lineOpacity?: number;
}

// Configuration des styles de route
export const ROUTE_STYLES: Record<string, CompositeRouteStyle> = {
  // Style simple (actuel)
  simple: {
    lineColor: ROUTE_COLORS.default,
    lineWidth: ROUTE_WIDTHS.normal,
    lineCap: 'round',
    lineJoin: 'round',
  },

  // Style avec contour (effet brillant moderne)
  outlined: {
    outline: {
      lineColor: ROUTE_COLORS.outline,
      lineWidth: ROUTE_WIDTHS.thick,
      lineCap: 'round',
      lineJoin: 'round',
      lineOpacity: 0.8,
    },
    main: {
      lineColor: ROUTE_COLORS.default,
      lineWidth: ROUTE_WIDTHS.normal,
      lineCap: 'round',
      lineJoin: 'round',
      lineOpacity: 0.95,
    },
  },

  // Style pour mode sombre (avec effet néon moderne)
  dark: {
    outline: {
      lineColor: 'rgba(59, 130, 246, 0.6)',
      lineWidth: 10,
      lineCap: 'round',
      lineJoin: 'round',
      lineOpacity: 0.8,
    },
    main: {
      lineColor: ROUTE_COLORS.default,
      lineWidth: 7,
      lineCap: 'round',
      lineJoin: 'round',
      lineOpacity: 0.95,
    },
    inner: {
      lineColor: ROUTE_COLORS.inner,
      lineWidth: 4,
      lineCap: 'round',
      lineJoin: 'round',
      lineOpacity: 1,
    },
  },

  // Style pour vue satellite
  satellite: {
    lineColor: ROUTE_COLORS.fast,
    lineWidth: ROUTE_WIDTHS.thick,
    lineCap: 'round',
    lineJoin: 'round',
    lineOpacity: 0.95,
  },
};

/**
 * Obtenir le style de route selon l'état du tracking
 */
export const getRouteStyle = (isTracking: boolean, isPaused: boolean, mapStyle: string): CompositeRouteStyle => {
  if (isPaused) {
    return {
      ...ROUTE_STYLES.simple,
      lineColor: ROUTE_COLORS.paused,
    };
  }

  // Adapter selon le style de carte
  if (mapStyle === MAPBOX_STYLES.dark) {
    return ROUTE_STYLES.dark;
  }

  if (mapStyle === MAPBOX_STYLES.satellite || mapStyle === MAPBOX_STYLES.satelliteStreet) {
    return ROUTE_STYLES.satellite;
  }

  return ROUTE_STYLES.simple;
};

/**
 * Obtenir le style de carte selon le thème système
 */
export const getMapStyleForTheme = (colorScheme: 'light' | 'dark' | null | undefined) => {
  return colorScheme === 'dark'
    ? MAPBOX_STYLES.dark
    : MAPBOX_STYLES.street;
};

interface MapStyleOption {
    id: string;
    name: string;
    value: string;
    icon: string;
}

/**
 * Liste des styles disponibles pour un sélecteur
 */
export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  {
    id: 'street',
    name: 'Rue',
    value: MAPBOX_STYLES.street,
    icon: 'map-outline',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    value: MAPBOX_STYLES.satellite,
    icon: 'satellite-outline',
  },
  {
    id: 'dark',
    name: 'Sombre',
    value: MAPBOX_STYLES.dark,
    icon: 'moon-outline',
  },
  {
    id: 'outdoors',
    name: 'Plein air',
    value: MAPBOX_STYLES.outdoors,
    icon: 'trail-sign-outline',
  },
  {
    id: 'light',
    name: 'Clair',
    value: MAPBOX_STYLES.light,
    icon: 'sunny-outline',
  },
];

