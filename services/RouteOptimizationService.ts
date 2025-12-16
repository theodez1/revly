/**
 * RouteOptimizationService
 * 
 * Service pour optimiser l'affichage des trajets sans modifier la base de données.
 * Implémente plusieurs algorithmes :
 * - Simplification Douglas-Peucker (réduction du nombre de points)
 * - Lissage par moyenne mobile (réduction du bruit GPS)
 * - Interpolation Catmull-Rom (courbes lisses)
 * - Filtrage des outliers (suppression des points aberrants)
 */

import simplify from 'simplify-js';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface OptimizationOptions {
  // Simplification Douglas-Peucker (0 = pas de simplification, 0.0001 = simplification agressive)
  simplificationTolerance?: number; // En degrés (0.0001 ≈ 11m)
  
  // Smoothing (fenêtre de moyenne mobile)
  smoothingWindow?: number; // Nombre de points pour la moyenne (3-5 recommandé)
  
  // Catmull-Rom interpolation (ajoute des points pour courbes lisses)
  useCatmullRom?: boolean;
  catmullRomPoints?: number; // Nombre de points d'interpolation entre chaque segment (2-4 recommandé)
  
  // Filtrage des outliers
  removeOutliers?: boolean;
  outlierThreshold?: number; // Distance maximale en degrés pour considérer un point comme outlier (0.001 ≈ 111m)
  
  // Préserver les points de départ et d'arrivée
  preserveEndpoints?: boolean;
}

/**
 * Optimise une liste de coordonnées pour un affichage plus propre
 */
export class RouteOptimizationService {
  /**
   * Calcule la distance entre deux points (formule de Haversine simplifiée)
   */
  private static getDistance(p1: Coordinate, p2: Coordinate): number {
    const lat1 = p1.latitude * Math.PI / 180;
    const lat2 = p2.latitude * Math.PI / 180;
    const deltaLat = (p2.latitude - p1.latitude) * Math.PI / 180;
    const deltaLng = (p2.longitude - p1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Distance approximative en degrés (pour les petits trajets)
    return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
  }

  /**
   * Supprime les points aberrants (outliers)
   */
  private static removeOutliers(
    coords: Coordinate[],
    threshold: number
  ): Coordinate[] {
    if (coords.length < 3) return coords;

    const filtered: Coordinate[] = [coords[0]]; // Toujours garder le premier point

    for (let i = 1; i < coords.length - 1; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const next = coords[i + 1];

      // Distance du point courant à la ligne entre prev et next
      const distToPrev = this.getDistance(curr, prev);
      const distToNext = this.getDistance(curr, next);
      const distDirect = this.getDistance(prev, next);

      // Si le point fait un détour trop important, c'est un outlier
      const detour = distToPrev + distToNext - distDirect;
      
      if (detour < threshold) {
        filtered.push(curr);
      }
    }

    filtered.push(coords[coords.length - 1]); // Toujours garder le dernier point
    return filtered;
  }

  /**
   * Simplifie le trajet avec l'algorithme Douglas-Peucker (via simplify-js)
   */
  private static simplifyRoute(
    coords: Coordinate[],
    tolerance: number
  ): Coordinate[] {
    if (coords.length < 3) return coords;

    // Convertir en format simplify-js
    const points = coords.map((c, index) => ({
      x: c.longitude,
      y: c.latitude,
      originalIndex: index,
    }));

    // Simplifier
    const simplified = simplify(points, tolerance, true);

    // Convertir back en coordonnées
    return simplified.map((p: any) => ({
      latitude: p.y,
      longitude: p.x,
    }));
  }

  /**
   * Applique un lissage par moyenne mobile
   */
  private static smoothRoute(
    coords: Coordinate[],
    windowSize: number
  ): Coordinate[] {
    if (coords.length < windowSize) return coords;

    const smoothed: Coordinate[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < coords.length; i++) {
      let latSum = 0;
      let lngSum = 0;
      let count = 0;

      // Moyenne mobile centrée
      for (let j = Math.max(0, i - halfWindow); j <= Math.min(coords.length - 1, i + halfWindow); j++) {
        latSum += coords[j].latitude;
        lngSum += coords[j].longitude;
        count++;
      }

      smoothed.push({
        latitude: latSum / count,
        longitude: lngSum / count,
      });
    }

    return smoothed;
  }

  /**
   * Interpolation Catmull-Rom pour créer des courbes lisses
   */
  private static catmullRomInterpolate(
    p0: Coordinate,
    p1: Coordinate,
    p2: Coordinate,
    p3: Coordinate,
    t: number
  ): Coordinate {
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      latitude: 0.5 * (
        (2 * p1.latitude) +
        (-p0.latitude + p2.latitude) * t +
        (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
        (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3
      ),
      longitude: 0.5 * (
        (2 * p1.longitude) +
        (-p0.longitude + p2.longitude) * t +
        (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
        (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3
      ),
    };
  }

  /**
   * Ajoute des points d'interpolation Catmull-Rom pour créer des courbes lisses
   */
  private static applyCatmullRom(
    coords: Coordinate[],
    pointsPerSegment: number
  ): Coordinate[] {
    if (coords.length < 4) return coords;

    const interpolated: Coordinate[] = [coords[0]]; // Premier point

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = i > 0 ? coords[i - 1] : coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = i + 2 < coords.length ? coords[i + 2] : coords[i + 1];

      // Ajouter des points d'interpolation entre p1 et p2
      for (let j = 1; j <= pointsPerSegment; j++) {
        const t = j / (pointsPerSegment + 1);
        const interpolatedPoint = this.catmullRomInterpolate(p0, p1, p2, p3, t);
        interpolated.push(interpolatedPoint);
      }

      // Ne pas ajouter p2 ici car il sera ajouté comme p1 au prochain tour
    }

    interpolated.push(coords[coords.length - 1]); // Dernier point
    return interpolated;
  }

  /**
   * Optimise un trajet avec les algorithmes configurés
   */
  static optimizeRoute(
    coords: Coordinate[],
    options: OptimizationOptions = {}
  ): Coordinate[] {
    if (!coords || coords.length < 2) return coords;

    // Valeurs par défaut
    const {
      simplificationTolerance = 0.0001, // ~11m de tolérance
      smoothingWindow = 3,
      useCatmullRom = true,
      catmullRomPoints = 2,
      removeOutliers = true,
      outlierThreshold = 0.001, // ~111m
      preserveEndpoints = true,
    } = options;

    let optimized = [...coords];

    // 1. Supprimer les outliers en premier
    if (removeOutliers && optimized.length > 3) {
      optimized = this.removeOutliers(optimized, outlierThreshold);
    }

    // 2. Simplifier avec Douglas-Peucker
    if (simplificationTolerance > 0 && optimized.length > 2) {
      optimized = this.simplifyRoute(optimized, simplificationTolerance);
    }

    // 3. Lisser avec moyenne mobile
    if (smoothingWindow > 1 && optimized.length >= smoothingWindow) {
      optimized = this.smoothRoute(optimized, smoothingWindow);
    }

    // 4. Appliquer Catmull-Rom pour courbes lisses
    if (useCatmullRom && optimized.length >= 4) {
      optimized = this.applyCatmullRom(optimized, catmullRomPoints);
    }

    // 5. S'assurer que les points de départ/arrivée sont préservés
    if (preserveEndpoints && coords.length > 0) {
      optimized[0] = coords[0];
      optimized[optimized.length - 1] = coords[coords.length - 1];
    }

    return optimized;
  }

  /**
   * Preset: Optimisation légère (pour trajets courts ou déjà propres)
   */
  static optimizeLight(coords: Coordinate[]): Coordinate[] {
    return this.optimizeRoute(coords, {
      simplificationTolerance: 0.00001, // Très faible simplification (presque aucune)
      smoothingWindow: 3,
      useCatmullRom: true,
      catmullRomPoints: 1,
      removeOutliers: true,
      outlierThreshold: 0.003, // Plus tolérant avec les outliers
    });
  }

  /**
   * Preset: Optimisation modérée (par défaut, bon compromis)
   */
  static optimizeModerate(coords: Coordinate[]): Coordinate[] {
    return this.optimizeRoute(coords, {
      simplificationTolerance: 0.00002, // Réduit la simplification pour préserver les détails
      smoothingWindow: 3,
      useCatmullRom: true,
      catmullRomPoints: 1, // Moins de points d'interpolation pour préserver les détails
      removeOutliers: true,
      outlierThreshold: 0.002, // Plus tolérant
    });
  }

  /**
   * Lissage adaptatif : lisse uniquement les zones bruyantes, préserve les zones précises
   */
  private static adaptiveSmooth(
    coords: Coordinate[],
    noiseThreshold: number = 0.0001
  ): Coordinate[] {
    if (coords.length < 3) return coords;

    const smoothed: Coordinate[] = [...coords]; // Commencer avec tous les points

    // Analyser la variabilité locale pour détecter le bruit
    for (let i = 1; i < coords.length - 1; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const next = coords[i + 1];

      // Calculer la déviation locale (mesure du bruit)
      const angle1 = Math.atan2(curr.latitude - prev.latitude, curr.longitude - prev.longitude);
      const angle2 = Math.atan2(next.latitude - curr.latitude, next.longitude - curr.longitude);
      const angleDiff = Math.abs(angle2 - angle1);
      const normalizedAngleDiff = angleDiff > Math.PI ? 2 * Math.PI - angleDiff : angleDiff;

      // Distance entre les points
      const dist1 = this.getDistance(prev, curr);
      const dist2 = this.getDistance(curr, next);

      // Si la zone est bruyante (angles changeants brusquement ou distances inégales)
      const isNoisy = normalizedAngleDiff > Math.PI / 6 || Math.abs(dist1 - dist2) > noiseThreshold;

      // Lisser seulement si c'est bruyant, sinon garder le point original
      if (isNoisy) {
        // Lissage très léger (poids faible sur la moyenne)
        smoothed[i] = {
          latitude: curr.latitude * 0.7 + (prev.latitude + next.latitude) / 2 * 0.3,
          longitude: curr.longitude * 0.7 + (prev.longitude + next.longitude) / 2 * 0.3,
        };
      }
      // Sinon, le point reste intact dans smoothed
    }

    return smoothed;
  }

  /**
   * Interpolation Catmull-Rom qui préserve TOUS les points originaux
   * Ajoute des points intermédiaires sans modifier les originaux
   * Ne lisse que visuellement en créant des courbes entre les points existants
   */
  private static catmullRomPreserveOriginal(
    coords: Coordinate[],
    pointsPerSegment: number = 1
  ): Coordinate[] {
    if (coords.length < 2) return coords;
    
    // Si très peu de points, juste interpolation linéaire simple
    if (coords.length === 2 && pointsPerSegment > 0) {
      const result: Coordinate[] = [coords[0]]; // Point original
      for (let i = 1; i <= pointsPerSegment; i++) {
        const t = i / (pointsPerSegment + 1);
        result.push({
          latitude: coords[0].latitude + (coords[1].latitude - coords[0].latitude) * t,
          longitude: coords[0].longitude + (coords[1].longitude - coords[0].longitude) * t,
        });
      }
      result.push(coords[1]); // Point original
      return result;
    }

    // Pour 3+ points, utiliser Catmull-Rom
    const interpolated: Coordinate[] = [];

    for (let i = 0; i < coords.length; i++) {
      // TOUJOURS ajouter le point original exactement tel quel
      interpolated.push({ ...coords[i] });

      // Si ce n'est pas le dernier point, ajouter des points intermédiaires pour la courbe
      if (i < coords.length - 1) {
        // Pour les extrémités, utiliser des points virtuels symétriques
        const p0 = i > 0 ? coords[i - 1] : {
          latitude: coords[i].latitude - (coords[i + 1].latitude - coords[i].latitude),
          longitude: coords[i].longitude - (coords[i + 1].longitude - coords[i].longitude),
        };
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = i + 2 < coords.length ? coords[i + 2] : {
          latitude: coords[i + 1].latitude + (coords[i + 1].latitude - coords[i].latitude),
          longitude: coords[i + 1].longitude + (coords[i + 1].longitude - coords[i].longitude),
        };

        // Ajouter des points d'interpolation entre p1 et p2 seulement
        // Cela crée une courbe qui passe par p1 et p2 sans les modifier
        for (let j = 1; j <= pointsPerSegment; j++) {
          const t = j / (pointsPerSegment + 1);
          const interpolatedPoint = this.catmullRomInterpolate(p0, p1, p2, p3, t);
          interpolated.push(interpolatedPoint);
        }
      }
    }

    return interpolated;
  }

  /**
   * Optimisation intelligente : préserve TOUS les points originaux, ajoute juste des courbes
   * Option 1: Mode ultra-conservateur (pas de modification, juste courbes)
   */
  static optimizeSmart(coords: Coordinate[], options: { preserveAll?: boolean } = {}): Coordinate[] {
    if (!coords || coords.length < 2) return coords;

    const { preserveAll = true } = options;

    if (preserveAll) {
      // Mode ultra-conservateur : AUCUNE modification des points originaux
      // Juste ajouter des points intermédiaires pour courbes lisses
      return this.catmullRomPreserveOriginal(coords, 1);
    } else {
      // Mode adaptatif : lisse uniquement les zones bruyantes
      let optimized = this.adaptiveSmooth(coords, 0.0001);
      
      // Ajouter des points Catmull-Rom pour courbes lisses
      if (optimized.length >= 2) {
        optimized = this.catmullRomPreserveOriginal(optimized, 1);
      }
      
      return optimized;
    }
  }

  /**
   * Filtre intelligent pour conduite : supprime les points aberrants
   * - Points trop éloignés (probable erreur GPS)
   * - Points derrière alors qu'on avance (contre-sens)
   * - Points trop proches (réduction densité)
   */
  private static filterDrivingOutliers(
    coords: Coordinate[],
    maxDistanceMeters: number = 500, // Distance max entre points (500m = outlier probable)
    minDistanceMeters: number = 5, // Distance min entre points (5m = trop proches)
    maxBackwardMeters: number = 50 // Distance max en arrière (50m = probable erreur)
  ): Coordinate[] {
    if (coords.length < 3) return coords;

    const filtered: Coordinate[] = [coords[0]]; // Toujours garder le premier point

    // Convertir les distances en degrés (approximation)
    // 1 degré latitude ≈ 111 km, 1 degré longitude ≈ 111 km * cos(latitude)
    const avgLat = coords.reduce((sum, p) => sum + p.latitude, 0) / coords.length;
    const degPerMeterLat = 1 / 111000; // ~9e-6 degrés par mètre
    const degPerMeterLng = 1 / (111000 * Math.cos(avgLat * Math.PI / 180));

    const maxDistDegLat = maxDistanceMeters * degPerMeterLat;
    const maxDistDegLng = maxDistanceMeters * degPerMeterLng;
    const minDistDegLat = minDistanceMeters * degPerMeterLat;
    const minDistDegLng = minDistanceMeters * degPerMeterLng;
    const maxBackwardDegLat = maxBackwardMeters * degPerMeterLat;
    const maxBackwardDegLng = maxBackwardMeters * degPerMeterLng;

    for (let i = 1; i < coords.length; i++) {
      const prev = filtered[filtered.length - 1]; // Dernier point gardé
      const curr = coords[i];
      
      // Calculer la distance et la direction
      const deltaLat = curr.latitude - prev.latitude;
      const deltaLng = curr.longitude - prev.longitude;
      const distLat = Math.abs(deltaLat);
      const distLng = Math.abs(deltaLng);
      
      // Distance approximative en degrés
      const distDeg = Math.sqrt(distLat * distLat + distLng * distLng);

      // 1. Vérifier si le point est trop éloigné (outlier GPS)
      if (distLat > maxDistDegLat || distLng > maxDistDegLng) {
        // Point trop éloigné, probablement erreur GPS - IGNORER
        continue;
      }

      // 2. Vérifier si le point est derrière alors qu'on avance
      if (filtered.length >= 2) {
        const prevPrev = filtered[filtered.length - 2];
        const prevDeltaLat = prev.latitude - prevPrev.latitude;
        const prevDeltaLng = prev.longitude - prevPrev.longitude;
        
        // Direction de mouvement précédente
        const prevDirLat = prevDeltaLat > 0 ? 1 : (prevDeltaLat < 0 ? -1 : 0);
        const prevDirLng = prevDeltaLng > 0 ? 1 : (prevDeltaLng < 0 ? -1 : 0);
        
        // Direction du point actuel par rapport au précédent
        const currDirLat = deltaLat > 0 ? 1 : (deltaLat < 0 ? -1 : 0);
        const currDirLng = deltaLng > 0 ? 1 : (deltaLng < 0 ? -1 : 0);
        
        // Si on va dans la direction opposée ET que c'est significatif (pas juste du bruit)
        const goingBackwardLat = (prevDirLat !== 0 && currDirLat === -prevDirLat && distLat > maxBackwardDegLat);
        const goingBackwardLng = (prevDirLng !== 0 && currDirLng === -prevDirLng && distLng > maxBackwardDegLng);
        
        if (goingBackwardLat || goingBackwardLng) {
          // Point derrière, probable erreur - IGNORER
          continue;
        }
      }

      // 3. Vérifier si le point est trop proche (densité excessive)
      if (distLat < minDistDegLat && distLng < minDistDegLng) {
        // Point trop proche, on peut le sauter pour réduire la densité
        // MAIS on garde le dernier point pour ne pas perdre trop d'info
        // On ne garde que tous les N points proches
        if (filtered.length % 5 !== 0) { // Garder 1 point sur 5 si très dense
          continue;
        }
      }

      // Point valide, le garder
      filtered.push(curr);
    }

    // Toujours garder le dernier point
    if (filtered[filtered.length - 1] !== coords[coords.length - 1]) {
      filtered.push(coords[coords.length - 1]);
    }

    return filtered;
  }

  /**
   * Optimisation intelligente pour conduite : filtre les outliers GPS
   */
  static optimizeForDriving(coords: Coordinate[]): Coordinate[] {
    if (!coords || coords.length < 2) return coords;

    // 1. Filtrer les outliers (points trop éloignés, derrière, trop proches)
    let filtered = this.filterDrivingOutliers(coords, 500, 5, 50);

    // 2. Ajouter des courbes légères pour un rendu propre
    if (filtered.length >= 2) {
      filtered = this.catmullRomPreserveOriginal(filtered, 1);
    }

    return filtered;
  }

  /**
   * Optimisation ultra-conservatrice : préserve 100% des points, ajoute juste des courbes
   */
  static optimizeUltraConservative(coords: Coordinate[]): Coordinate[] {
    if (!coords || coords.length < 2) return coords;
    
    // Juste ajouter des points pour courbes lisses, AUCUNE autre modification
    return this.catmullRomPreserveOriginal(coords, 1);
  }

  /**
   * Preset: Optimisation minimale (préserve 100% des points, ajoute juste des courbes)
   */
  static optimizeMinimal(coords: Coordinate[]): Coordinate[] {
    // Mode ultra-conservateur : préserve TOUS les points originaux
    return this.optimizeUltraConservative(coords);
  }

  /**
   * Preset: Optimisation agressive (pour trajets très bruyants ou très longs)
   */
  static optimizeAggressive(coords: Coordinate[]): Coordinate[] {
    return this.optimizeRoute(coords, {
      simplificationTolerance: 0.0003, // Plus agressif
      smoothingWindow: 5,
      useCatmullRom: true,
      catmullRomPoints: 3,
      removeOutliers: true,
      outlierThreshold: 0.0008,
    });
  }
}

