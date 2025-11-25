import { supabase } from '../lib/supabase';

export class SocialService {
  static async toggleFavorite(userId: string, eventId: string): Promise<boolean> {
    try {
      const { data: existing } = await supabase
        .from('favorites')
        .select('*')
        .eq('profile_id', userId)
        .eq('event_id', eventId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('profile_id', userId)
          .eq('event_id', eventId);

        if (error) {
          console.error('Error removing favorite:', error);
          return false;
        }
        return false;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ profile_id: userId, event_id: eventId });

        if (error) {
          console.error('Error adding favorite:', error);
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error('Unexpected error toggling favorite:', error);
      return false;
    }
  }

  static async toggleInterest(userId: string, eventId: string): Promise<boolean> {
    try {
      const { data: existing } = await supabase
        .from('event_interests')
        .select('*')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('event_interests')
          .delete()
          .eq('user_id', userId)
          .eq('event_id', eventId);

        if (error) {
          console.error('Error removing interest:', error);
          return false;
        }
        return false;
      } else {
        const { error } = await supabase
          .from('event_interests')
          .insert({ user_id: userId, event_id: eventId });

        if (error) {
          console.error('Error adding interest:', error);
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error('Unexpected error toggling interest:', error);
      return false;
    }
  }

  static async toggleLike(userId: string, eventId: string): Promise<boolean> {
    try {
      const { data: existing } = await supabase
        .from('event_likes')
        .select('*')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('event_likes')
          .delete()
          .eq('user_id', userId)
          .eq('event_id', eventId);

        if (error) {
          console.error('Error removing like:', error);
          return false;
        }
        return false;
      } else {
        const { error } = await supabase
          .from('event_likes')
          .insert({ user_id: userId, event_id: eventId });

        if (error) {
          console.error('Error adding like:', error);
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error('Unexpected error toggling like:', error);
      return false;
    }
  }

  static async checkIn(userId: string, eventId: string, lat: number, lon: number): Promise<boolean> {
    try {
      const { error } = await supabase.from('event_checkins').insert({
        user_id: userId,
        event_id: eventId,
        lat,
        lon,
        validated_radius: 100,
        source: 'mobile',
      });

      if (error) {
        console.error('Error checking in:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error checking in:', error);
      return false;
    }
  }
}
