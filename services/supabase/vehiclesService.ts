import { supabase } from '../../config/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  description: string;
  photoUrl?: string; // Optional because logic seems to map photo_url to photoUrl/photoUri
  photoUri: string | null;
  isDefault: boolean;
  createdAt?: string;
}

export interface VehicleData {
  userId: string;
  name: string;
  type: string;
  description?: string;
  photoUrl?: string;
  isDefault?: boolean;
}

/**
 * Service de gestion des véhicules Supabase
 */
class VehiclesService {
  /**
   * Récupérer tous les véhicules d'un utilisateur
   * @param {string} userId 
   * @returns {Promise<{vehicles: Vehicle[], error: any}>}
   */
  async getUserVehicles(userId: string): Promise<{ vehicles: Vehicle[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Formater les données pour correspondre au format attendu
      const vehicles: Vehicle[] = data.map((v: any) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        description: v.description,
        photoUrl: v.photo_url, // URL Supabase
        photoUri: v.photo_url, // Alias pour compatibilité
        isDefault: v.is_default,
        createdAt: v.created_at,
      }));

      return { vehicles, error: null };
    } catch (error) {
      console.error('Erreur getUserVehicles:', error);
      return { vehicles: [], error };
    }
  }

  /**
   * Obtenir le véhicule par défaut d'un utilisateur
   * @param {string} userId 
   * @returns {Promise<{vehicle: Vehicle | null, error: any}>}
   */
  async getDefaultVehicle(userId: string): Promise<{ vehicle: Vehicle | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = pas de résultat

      if (!data) {
        return { vehicle: null, error: null };
      }

      const vehicle: Vehicle = {
        id: data.id,
        name: data.name,
        type: data.type,
        description: data.description,
        photoUrl: data.photo_url,
        photoUri: data.photo_url,
        isDefault: data.is_default,
      };

      return { vehicle, error: null };
    } catch (error) {
      console.error('Erreur getDefaultVehicle:', error);
      return { vehicle: null, error };
    }
  }

  /**
   * Créer un nouveau véhicule
   * @param {Object} vehicleData 
   * @returns {Promise<{vehicle: Vehicle | null, error: any}>}
   */
  async createVehicle(vehicleData: VehicleData): Promise<{ vehicle: Vehicle | null; error: any }> {
    try {
      const insertData = {
        user_id: vehicleData.userId,
        name: vehicleData.name,
        type: vehicleData.type,
        description: vehicleData.description || '',
        photo_url: vehicleData.photoUrl || null,
        is_default: vehicleData.isDefault || false,
      };

      // Si ce véhicule est défini comme par défaut, retirer le flag des autres
      if (insertData.is_default) {
        await supabase
          .from('vehicles')
          .update({ is_default: false })
          .eq('user_id', vehicleData.userId);
      }

      const { data, error } = await supabase
        .from('vehicles')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      const vehicle: Vehicle = {
        id: data.id,
        name: data.name,
        type: data.type,
        description: data.description,
        photoUrl: data.photo_url,
        photoUri: data.photo_url,
        isDefault: data.is_default,
      };

      return { vehicle, error: null };
    } catch (error) {
      console.error('Erreur createVehicle:', error);
      return { vehicle: null, error };
    }
  }

  /**
   * Mettre à jour un véhicule
   * @param {string} vehicleId 
   * @param {Object} updates 
   * @returns {Promise<{vehicle: Vehicle | null, error: any}>}
   */
  async updateVehicle(vehicleId: string, updates: any): Promise<{ vehicle: Vehicle | null; error: any }> {
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.photoUrl !== undefined) updateData.photo_url = updates.photoUrl;

      const { data, error } = await supabase
        .from('vehicles')
        .update(updateData)
        .eq('id', vehicleId)
        .select()
        .single();

      if (error) throw error;

      const vehicle: Vehicle = {
        id: data.id,
        name: data.name,
        type: data.type,
        description: data.description,
        photoUrl: data.photo_url,
        photoUri: data.photo_url,
        isDefault: data.is_default,
      };

      return { vehicle, error: null };
    } catch (error) {
      console.error('Erreur updateVehicle:', error);
      return { vehicle: null, error };
    }
  }

  /**
   * Supprimer un véhicule
   * @param {string} vehicleId 
   * @returns {Promise<{error: any}>}
   */
  async deleteVehicle(vehicleId: string): Promise<{ error: any }> {
    try {
      // Récupérer le véhicule pour obtenir le user_id
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('photo_url, user_id')
        .eq('id', vehicleId)
        .single();

      // Supprimer TOUTES les photos du véhicule (quelque soit l'extension)
      if (vehicle?.user_id) {
        try {
          const { data: existingFiles } = await supabase.storage
            .from('vehicle-photos')
            .list(`${vehicle.user_id}/${vehicleId}`);

          if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map(file => `${vehicle.user_id}/${vehicleId}/${file.name}`);
            await supabase.storage
              .from('vehicle-photos')
              .remove(filesToDelete);

          }
        } catch (storageError) {
          console.warn('Erreur suppression photos du véhicule:', storageError);
          // On continue même si la suppression des photos échoue
        }
      }

      // Supprimer le véhicule de la base de données
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur deleteVehicle:', error);
      return { error };
    }
  }

  /**
   * Définir un véhicule comme par défaut
   * @param {string} userId 
   * @param {string} vehicleId 
   * @returns {Promise<{error: any}>}
   */
  async setDefaultVehicle(userId: string, vehicleId: string): Promise<{ error: any }> {
    try {
      // Retirer le flag is_default de tous les véhicules
      await supabase
        .from('vehicles')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Définir le nouveau véhicule par défaut
      const { error } = await supabase
        .from('vehicles')
        .update({ is_default: true })
        .eq('id', vehicleId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erreur setDefaultVehicle:', error);
      return { error };
    }
  }

  /**
   * Upload d'une photo de véhicule
   * @param {string} userId 
   * @param {string} vehicleId 
   * @param {string} photoUri 
   * @returns {Promise<{url: string | null, error: any}>}
   */
  async uploadVehiclePhoto(userId: string, vehicleId: string, photoUri: string): Promise<{ url: string | null; error: any }> {
    try {
      // Lire le fichier en base64
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: 'base64',
      });

      // Déterminer l'extension du fichier
      const ext = photoUri.split('.').pop()?.toLowerCase() || 'jpg';
      const contentType = ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const fileName = `${userId}/${vehicleId}/photo.${ext}`;

      // Supprimer TOUTES les anciennes photos du véhicule (quelque soit l'extension)
      try {
        const { data: existingFiles } = await supabase.storage
          .from('vehicle-photos')
          .list(`${userId}/${vehicleId}`);

        if (existingFiles && existingFiles.length > 0) {
          const filesToDelete = existingFiles.map(file => `${userId}/${vehicleId}/${file.name}`);
          await supabase.storage
            .from('vehicle-photos')
            .remove(filesToDelete);

        }
      } catch (cleanupError) {
        console.warn('Erreur nettoyage anciennes photos:', cleanupError);
        // On continue même si le nettoyage échoue
      }

      // Upload du nouveau fichier
      const { data, error } = await supabase.storage
        .from('vehicle-photos')
        .upload(fileName, decode(base64), {
          contentType,
          upsert: true,
        });

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-photos')
        .getPublicUrl(fileName);

      // Mettre à jour le véhicule avec la nouvelle URL
      await supabase
        .from('vehicles')
        .update({ photo_url: publicUrl })
        .eq('id', vehicleId);

      return { url: publicUrl, error: null };
    } catch (error) {
      console.error('Erreur uploadVehiclePhoto:', error);
      return { url: null, error };
    }
  }
}

export default new VehiclesService();

