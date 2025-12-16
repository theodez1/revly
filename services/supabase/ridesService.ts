import { supabase } from '../../config/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export interface ExtraStats {
  elevationGain?: number;
  elevationLoss?: number;
  climbRate?: number;
  averageGrade?: number;
  idleRatio?: number;
  stopsPerKm?: number;
  movingRatio?: number;
  maxAltitude?: number | null;
  minAltitude?: number | null;
  gain?: number; // legacy fallback
  loss?: number; // legacy fallback
}

export interface RidePhoto {
  uri: string;
  timestamp: string;
}

export interface Ride {
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration: number;
  distance: number;
  maxSpeed: number;
  averageSpeed: number;
  pace: number;
  elevationGain: number;
  elevationLoss: number;
  totalStops: number;
  totalStopTime: number;
  movingTime: number;
  topSpeed: number;
  avgMovingSpeed: number;
  totalTurns: number;
  sharpTurns: number;
  smoothness: number;
  drivingScore: number;
  polyline: string;
  vehicle: string | null;
  startCity: string | null;
  endCity: string | null;
  cities: any[];
  photos: RidePhoto[];
  userId: string;
  userName: string;
  userAvatar?: string;
  created_at: string;
  updated_at: string;
  extraStats: ExtraStats | null;
  steps?: any[];
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
}

const computeExtraStats = (record: any): ExtraStats | null => {
  if (!record) {
    return null;
  }

  const rawStats = record.extra_stats || record.extraStats;
  if (rawStats && typeof rawStats === 'object' && Object.keys(rawStats).length > 0) {
    return rawStats as ExtraStats;
  }

  const distanceMeters = Number(record.distance) || 0;
  const distanceKm = distanceMeters / 1000;
  const totalStopTime = Number(record.total_stop_time) || 0;
  const duration = Number(record.duration) || 0;
  const movingTimeDatabase = Number(record.moving_time);
  const movingTime = Number.isFinite(movingTimeDatabase)
    ? movingTimeDatabase
    : Math.max(0, duration - totalStopTime);

  const elevationGain = Number(record.elevation_gain) || 0;
  const elevationLoss = Number(record.elevation_loss) || 0;

  const climbRate = movingTime > 0 ? elevationGain / (movingTime / 3600) : 0;
  const avgGrade = distanceMeters > 0 ? (elevationGain / distanceMeters) * 100 : 0;
  const idleRatio = duration > 0 ? (totalStopTime / duration) * 100 : 0;
  const stopsPerKm = distanceKm > 0 ? (Number(record.total_stops) || 0) / distanceKm : 0;
  const movingRatio = duration > 0 ? (movingTime / duration) * 100 : 0;

  return {
    elevationGain,
    elevationLoss,
    climbRate: Math.round(climbRate),
    averageGrade: Math.round(avgGrade * 10) / 10,
    idleRatio: Math.round(idleRatio * 10) / 10,
    stopsPerKm: Math.round(stopsPerKm * 100) / 100,
    movingRatio: Math.round(movingRatio * 10) / 10,
    maxAltitude: record.max_altitude ?? null,
    minAltitude: record.min_altitude ?? null,
  };
};

export interface RideOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
  userIds?: string[] | null;
  currentUserId?: string | null;
}

/**
 * Service de gestion des trajets Supabase
 */
class RidesService {
  /**
   * Récupérer tous les trajets (Feed - tous les utilisateurs)
   * @param {Object} options - {limit, offset, orderBy}
   * @returns {Promise<{rides: Ride[], error: any}>}
   */
  async getAllRides(options: RideOptions = {}): Promise<{ rides: Ride[]; error: any }> {
    try {
      const {
        limit = 50,
        offset = 0,
        orderBy = 'created_at',
        order = 'desc',
      } = options;

      let query = supabase
        .from('rides')
        .select(`
          *,
          user:users!inner(
            id,
            username,
            first_name,
            last_name,
            avatar_url
          ),
          photos:ride_photos(*)
        `)
        .order(orderBy, { ascending: order === 'asc' })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;

      // Formater les données pour correspondre au format attendu
      const rides: Ride[] = data.map((ride: any) => {
        const extraStats = computeExtraStats(ride);
        const elevationGain =
          extraStats?.elevationGain ?? extraStats?.gain ?? 0;
        const elevationLoss =
          extraStats?.elevationLoss ?? extraStats?.loss ?? 0;

        return {
          id: ride.id,
          name: ride.name,
          description: ride.description,
          startTime: ride.start_time,
          endTime: ride.end_time,
          duration: ride.duration,
          distance: ride.distance,
          maxSpeed: ride.max_speed,
          averageSpeed: ride.average_speed,
          pace: ride.pace || 0,
          elevationGain,
          elevationLoss,
          totalStops: ride.total_stops || 0,
          totalStopTime: ride.total_stop_time || 0,
          movingTime: ride.moving_time || 0,
          topSpeed: ride.top_speed || 0,
          avgMovingSpeed: ride.avg_moving_speed || 0,
          totalTurns: ride.total_turns || 0,
          sharpTurns: ride.sharp_turns || 0,
          smoothness: ride.smoothness || 100,
          drivingScore: ride.driving_score || 100,
          polyline: ride.polyline || '',
          vehicle: ride.vehicle,
          startCity: ride.start_city,
          endCity: ride.end_city,
          cities: ride.cities || [],
          photos: ride.photos?.map((p: any) => ({ uri: p.photo_url, timestamp: p.created_at })) || [],
          userId: ride.user_id,
          userName: ride.user.username || `${ride.user.first_name} ${ride.user.last_name}`.trim() || 'Utilisateur',
          userAvatar: ride.user.avatar_url,
          created_at: ride.created_at,
          updated_at: ride.updated_at,
          extraStats: extraStats && Object.keys(extraStats).length > 0 ? extraStats : null,
        };
      });

      return { rides, error: null };
    } catch (error) {
      console.error('Erreur getAllRides:', error);
      return { rides: [], error };
    }
  }

  /**
   * Récupérer les trajets d'un utilisateur spécifique
   * @param {string} userId 
   * @param {Object} options - {limit, offset, orderBy}
   * @returns {Promise<{rides: Ride[], error: any}>}
   */
  async getUserRides(userId: string, options: RideOptions = {}): Promise<{ rides: Ride[]; error: any }> {
    try {
      const {
        limit = 100,
        offset = 0,
        orderBy = 'created_at',
        order = 'desc',
      } = options;

      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          user:users!inner(
            id,
            username,
            first_name,
            last_name,
            avatar_url
          ),
          photos:ride_photos(*)
        `)
        .eq('user_id', userId)
        .order(orderBy, { ascending: order === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Formater les données
      const rides: Ride[] = data.map((ride: any) => {
        const extraStats = computeExtraStats(ride);
        const elevationGain =
          extraStats?.elevationGain ?? extraStats?.gain ?? 0;
        const elevationLoss =
          extraStats?.elevationLoss ?? extraStats?.loss ?? 0;

        return {
          id: ride.id,
          name: ride.name,
          description: ride.description,
          startTime: ride.start_time,
          endTime: ride.end_time,
          duration: ride.duration,
          distance: ride.distance,
          maxSpeed: ride.max_speed,
          averageSpeed: ride.average_speed,
          pace: ride.pace || 0,
          elevationGain,
          elevationLoss,
          totalStops: ride.total_stops || 0,
          totalStopTime: ride.total_stop_time || 0,
          movingTime: ride.moving_time || 0,
          topSpeed: ride.top_speed || 0,
          avgMovingSpeed: ride.avg_moving_speed || 0,
          totalTurns: ride.total_turns || 0,
          sharpTurns: ride.sharp_turns || 0,
          smoothness: ride.smoothness || 100,
          drivingScore: ride.driving_score || 100,
          polyline: ride.polyline || '',
          vehicle: ride.vehicle,
          startCity: ride.start_city,
          endCity: ride.end_city,
          cities: ride.cities || [],
          photos: ride.photos?.map((p: any) => ({ uri: p.photo_url, timestamp: p.created_at })) || [],
          userId: ride.user_id,
          userName: ride.user.username || `${ride.user.first_name} ${ride.user.last_name}`.trim(),
          userAvatar: ride.user.avatar_url,
          created_at: ride.created_at,
          updated_at: ride.updated_at,
          extraStats: extraStats && Object.keys(extraStats).length > 0 ? extraStats : null,
        };
      });

      return { rides, error: null };
    } catch (error) {
      console.error('Erreur getUserRides:', error);
      return { rides: [], error };
    }
  }

  /**
   * Récupérer un trajet par son ID
   * @param {string} rideId 
   * @returns {Promise<{ride: Ride | null, error: any}>}
   */
  async getRideById(rideId: string): Promise<{ ride: Ride | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          user:users!inner(
            id,
            username,
            first_name,
            last_name,
            avatar_url
          ),
          photos:ride_photos(*),
          steps:ride_steps(*)
        `)
        .eq('id', rideId)
        .single();

      if (error) throw error;

      // Formater les données
      const extraStats = computeExtraStats(data);
      const elevationGain =
        extraStats?.elevationGain ?? extraStats?.gain ?? 0;
      const elevationLoss =
        extraStats?.elevationLoss ?? extraStats?.loss ?? 0;

      const ride: Ride = {
        id: data.id,
        name: data.name,
        description: data.description,
        startTime: data.start_time,
        endTime: data.end_time,
        duration: data.duration,
        distance: data.distance,
        maxSpeed: data.max_speed,
        averageSpeed: data.average_speed,
        pace: data.pace || 0,
        elevationGain,
        elevationLoss,
        totalStops: data.total_stops || 0,
        totalStopTime: data.total_stop_time || 0,
        movingTime: data.moving_time || 0,
        topSpeed: data.top_speed || 0,
        avgMovingSpeed: data.avg_moving_speed || 0,
        totalTurns: data.total_turns || 0,
        sharpTurns: data.sharp_turns || 0,
        smoothness: data.smoothness || 100,
        drivingScore: data.driving_score || 100,
        polyline: data.polyline || '',
        vehicle: data.vehicle,
        startCity: data.start_city,
        endCity: data.end_city,
        cities: data.cities || [],
        userId: data.user_id,
        userName: data.user.username || `${data.user.first_name} ${data.user.last_name}`.trim(),
        userAvatar: data.user.avatar_url,
        photos: data.photos || [],
        steps: data.steps || [],
        created_at: data.created_at,
        updated_at: data.updated_at,
        extraStats: extraStats && Object.keys(extraStats).length > 0 ? extraStats : null,
      };

      return { ride, error: null };
    } catch (error) {
      console.error('Erreur getRideById:', error);
      return { ride: null, error };
    }
  }

  /**
   * Créer un nouveau trajet
   * @param {Object} rideData 
   * @returns {Promise<{ride: Ride | null, error: any}>}
   */
  async createRide(rideData: any): Promise<{ ride: Ride | null; error: any }> {
    try {
      // Les timestamps sont déjà en ISO string depuis MapScreenFull
      // S'assurer que toutes les valeurs sont du bon type pour la base de données
      const insertData = {
        user_id: rideData.userId,
        name: rideData.name || 'Trajet sans nom',
        description: rideData.description || null,
        start_time: rideData.startTime,
        end_time: rideData.endTime,
        duration: Math.round(Number(rideData.duration) || 0), // INTEGER (secondes)
        distance: Number(rideData.distance) || 0, // NUMERIC (mètres)
        max_speed: rideData.maxSpeed ? Number(rideData.maxSpeed) : null, // NUMERIC (km/h)
        average_speed: rideData.averageSpeed ? Number(rideData.averageSpeed) : null, // NUMERIC (km/h)
        pace: rideData.pace ? Number(rideData.pace) : null, // NUMERIC (min/km)
        total_stops: Math.round(Number(rideData.totalStops) || 0), // INTEGER
        total_stop_time: Math.round(Number(rideData.totalStopTime) || 0), // INTEGER (secondes)
        moving_time: rideData.movingTime ? Math.round(Number(rideData.movingTime)) : null, // INTEGER (secondes)
        top_speed: rideData.topSpeed ? Number(rideData.topSpeed) : null, // NUMERIC (km/h)
        avg_moving_speed: rideData.avgMovingSpeed ? Number(rideData.avgMovingSpeed) : null, // NUMERIC (km/h)
        total_turns: Math.round(Number(rideData.totalTurns) || 0), // INTEGER
        sharp_turns: Math.round(Number(rideData.sharpTurns) || 0), // INTEGER
        smoothness: Number(rideData.smoothness) || 100, // NUMERIC
        driving_score: Number(rideData.drivingScore) || 100, // NUMERIC
        polyline: rideData.polyline || null, // text
        vehicle: rideData.vehicle || null, // text
        start_city: rideData.startCity || null, // text
        end_city: rideData.endCity || null, // text
        cities: rideData.cities && Array.isArray(rideData.cities) ? rideData.cities : [], // jsonb
        extra_stats: rideData.extraStats || null,
      };



      const { data, error } = await supabase
        .from('rides')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur Supabase insert:', error);
        throw error;
      }


      const { extra_stats, ...rest } = data;
      // Note: We are returning a slightly different structure here than Ride interface might strictly expect
      // for relations (user, photos) because they are not fetched.
      // But for creation result it might be acceptable or we should fetch them.
      // For now casting to any or partial Ride.
      return { ride: { ...rest, extraStats: computeExtraStats(data) } as any, error: null };
    } catch (error) {
      console.error('Erreur createRide:', error);
      return { ride: null, error };
    }
  }

  /**
   * Mettre à jour un trajet
   * @param {string} rideId 
   * @param {Object} updates 
   * @returns {Promise<{ride: any, error: any}>}
   */
  async updateRide(rideId: string, updates: any): Promise<{ ride: any; error: any }> {
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.vehicle !== undefined) updateData.vehicle = updates.vehicle;
      if (updates.privacy_start_enabled !== undefined) updateData.privacy_start_enabled = updates.privacy_start_enabled;
      if (updates.privacy_end_enabled !== undefined) updateData.privacy_end_enabled = updates.privacy_end_enabled;
      if (updates.privacy_start_km !== undefined) updateData.privacy_start_km = updates.privacy_start_km;
      if (updates.privacy_end_km !== undefined) updateData.privacy_end_km = updates.privacy_end_km;

      const { data, error } = await supabase
        .from('rides')
        .update(updateData)
        .eq('id', rideId)
        .select()
        .single();

      if (error) throw error;

      return { ride: data, error: null };
    } catch (error) {
      console.error('Erreur updateRide:', error);
      return { ride: null, error };
    }
  }

  /**
   * Supprimer un trajet
   * @param {string} rideId 
   * @returns {Promise<{error: any}>}
   */
  async deleteRide(rideId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('rides')
        .delete()
        .eq('id', rideId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur deleteRide:', error);
      return { error };
    }
  }

  /**
   * Upload d'une photo de trajet
   * @param {string} userId 
   * @param {string} rideId 
   * @param {string} photoUri 
   * @param {Object} location - {latitude, longitude}
   * @returns {Promise<{url: string | null, error: any}>}
   */
  async uploadRidePhoto(userId: string, rideId: string, photoUri: string, location: { latitude: number; longitude: number } | null = null): Promise<{ url: string | null; error: any }> {
    try {
      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: 'base64',
      });

      // Déterminer l'extension du fichier
      const ext = photoUri.split('.').pop()?.toLowerCase() || 'jpg';
      const contentType = ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const fileName = `${userId}/${rideId}/${Date.now()}.${ext}`;

      // Upload du fichier
      const { data, error } = await supabase.storage
        .from('ride-photos')
        .upload(fileName, decode(base64), {
          contentType,
          upsert: false,
        });

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('ride-photos')
        .getPublicUrl(fileName);

      // Insérer l'entrée dans la table ride_photos
      await supabase
        .from('ride_photos')
        .insert([{
          ride_id: rideId,
          photo_url: publicUrl,
          latitude: location?.latitude,
          longitude: location?.longitude,
        }]);

      return { url: publicUrl, error: null };
    } catch (error) {
      console.error('Erreur uploadRidePhoto:', error);
      return { url: null, error };
    }
  }

  /**
   * Obtenir les statistiques d'un utilisateur
   * @param {string} userId 
   * @returns {Promise<{stats: any, error: any}>}
   */
  async getUserStats(userId: string): Promise<{ stats: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('distance, duration, average_speed')
        .eq('user_id', userId);

      if (error) throw error;

      const stats = {
        totalRides: data.length,
        totalDistance: data.reduce((sum, r) => sum + (r.distance || 0), 0),
        totalDuration: data.reduce((sum, r) => sum + (r.duration || 0), 0),
        averageSpeed: data.length > 0
          ? data.reduce((sum, r) => sum + (r.average_speed || 0), 0) / data.length
          : 0,
      };

      return { stats, error: null };
    } catch (error) {
      console.error('Erreur getUserStats:', error);
      return { stats: null, error };
    }
  }

  /**
   * Obtenir les statistiques globales (tous les utilisateurs)
   * @returns {Promise<{stats: any, error: any}>}
   */
  async getGlobalStats(): Promise<{ stats: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('distance, duration, average_speed');

      if (error) throw error;

      const stats = {
        totalRides: data.length,
        totalDistance: data.reduce((sum, r) => sum + (r.distance || 0), 0),
        totalDuration: data.reduce((sum, r) => sum + (r.duration || 0), 0),
        averageSpeed: data.length > 0
          ? data.reduce((sum, r) => sum + (r.average_speed || 0), 0) / data.length
          : 0,
      };

      return { stats, error: null };
    } catch (error) {
      console.error('Erreur getGlobalStats:', error);
      return { stats: null, error };
    }
  }

  /**
   * Récupérer tous les trajets avec métriques d'engagement pour le feed personnalisé
   * @param {Object} options - {limit, offset, orderBy, userId}
   * @returns {Promise<{rides: Ride[], error: any}>}
   */
  async getAllRidesWithEngagement(options: RideOptions = {}): Promise<{ rides: Ride[]; error: any }> {
    try {
      const {
        limit = 50,
        offset = 0,
        orderBy = 'created_at',
        order = 'desc',
        userIds = null, // Optional: filter by specific user IDs
        currentUserId = null, // Optional: to check if user liked the ride
      } = options;

      // Query with engagement metrics (likes and comments count)
      let query = supabase
        .from('rides')
        .select(`
          *,
          user:users!inner(
            id,
            username,
            first_name,
            last_name,
            avatar_url
          ),
          photos:ride_photos(*),
          likes:ride_likes(count),
          comments:ride_comments(count)
        `)
        .order(orderBy, { ascending: order === 'asc' })
        .range(offset, offset + limit - 1);

      // Apply userIds filter if provided
      if (userIds && Array.isArray(userIds) && userIds.length > 0) {
        query = query.in('user_id', userIds);
      }

      const { data, error } = await query;



      if (error) {
        console.error('❌ [getAllRidesWithEngagement] Erreur SQL:', error);
        throw error;
      }

      // If currentUserId is provided, fetch their likes for these rides
      let likedRideIds = new Set();
      if (currentUserId && data.length > 0) {
        const rideIds = data.map((r: any) => r.id);
        const { data: userLikes } = await supabase
          .from('ride_likes')
          .select('ride_id')
          .eq('user_id', currentUserId)
          .in('ride_id', rideIds);

        if (userLikes) {
          likedRideIds = new Set(userLikes.map((l: any) => l.ride_id));
        }
      }

      // Format the data
      const rides: Ride[] = data.map((ride: any) => {
        const extraStats = computeExtraStats(ride);
        const elevationGain =
          extraStats?.elevationGain ?? extraStats?.gain ?? 0;
        const elevationLoss =
          extraStats?.elevationLoss ?? extraStats?.loss ?? 0;

        return {
          id: ride.id,
          name: ride.name,
          description: ride.description,
          startTime: ride.start_time,
          endTime: ride.end_time,
          duration: ride.duration,
          distance: ride.distance,
          maxSpeed: ride.max_speed,
          averageSpeed: ride.average_speed,
          pace: ride.pace || 0,
          elevationGain,
          elevationLoss,
          totalStops: ride.total_stops || 0,
          totalStopTime: ride.total_stop_time || 0,
          movingTime: ride.moving_time || 0,
          topSpeed: ride.top_speed || 0,
          avgMovingSpeed: ride.avg_moving_speed || 0,
          totalTurns: ride.total_turns || 0,
          sharpTurns: ride.sharp_turns || 0,
          smoothness: ride.smoothness || 100,
          drivingScore: ride.driving_score || 100,
          polyline: ride.polyline || '',
          vehicle: ride.vehicle,
          startCity: ride.start_city,
          endCity: ride.end_city,
          cities: ride.cities || [],
          photos: ride.photos?.map((p: any) => ({ uri: p.photo_url, timestamp: p.created_at })) || [],
          userId: ride.user_id,
          userName: ride.user.username || `${ride.user.first_name} ${ride.user.last_name}`.trim() || 'Utilisateur',
          userAvatar: ride.user.avatar_url,
          created_at: ride.created_at,
          updated_at: ride.updated_at,
          extraStats: extraStats && Object.keys(extraStats).length > 0 ? extraStats : null,
          // Engagement metrics
          likesCount: ride.likes?.[0]?.count || 0,
          commentsCount: ride.comments?.[0]?.count || 0,
          isLiked: likedRideIds.has(ride.id),
        };
      });

      return { rides, error: null };
    } catch (error) {
      console.error('Erreur getAllRidesWithEngagement:', error);
      return { rides: [], error };
    }
  }
}

export default new RidesService();

