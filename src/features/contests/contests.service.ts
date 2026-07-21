import { supabase } from '@/lib/supabase/client';
import type { Contest, ContestEntry, ContestReward, ContestVote } from './contests.types';

const VISIBLE_STATUSES = ['scheduled', 'open', 'voting_closed', 'closed'] as const;

export const ContestsService = {
  async listVisible(): Promise<Contest[]> {
    const { data, error } = await supabase
      .from('contests')
      .select(
        'id, title, description, theme, cover_url, rules_md, legal_version, start_at, end_at, voting_ends_at, geo_grid_meters, status, reward, jury_announced_at'
      )
      .in('status', [...VISIBLE_STATUSES])
      .order('start_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Contest[];
  },

  async getById(id: string): Promise<Contest> {
    const { data, error } = await supabase
      .from('contests')
      .select(
        'id, title, description, theme, cover_url, rules_md, legal_version, start_at, end_at, voting_ends_at, geo_grid_meters, status, reward, jury_announced_at'
      )
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Contest;
  },

  async listActiveEntries(contestId: string): Promise<ContestEntry[]> {
    const { data, error } = await supabase
      .from('contest_entries')
      .select(
        'id, contest_id, user_id, title, content, media_url, status, votes_count, zone_lat, zone_lng, refusal_reason, created_at'
      )
      .eq('contest_id', contestId)
      .eq('status', 'active')
      .order('votes_count', { ascending: false });
    if (error) throw error;
    return (data || []) as ContestEntry[];
  },

  async getMyEntry(contestId: string, userId: string): Promise<ContestEntry | null> {
    const { data, error } = await supabase
      .from('contest_entries')
      .select(
        'id, contest_id, user_id, title, content, media_url, status, votes_count, zone_lat, zone_lng, refusal_reason, created_at'
      )
      .eq('contest_id', contestId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as ContestEntry) || null;
  },

  async getMyVote(contestId: string, userId: string): Promise<ContestVote | null> {
    const { data, error } = await supabase
      .from('contest_votes')
      .select('contest_id, entry_id, user_id')
      .eq('contest_id', contestId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as ContestVote) || null;
  },

  async castVote(contestId: string, entryId: string): Promise<ContestVote> {
    const { data, error } = await supabase.rpc('contests_cast_vote', {
      p_contest_id: contestId,
      p_entry_id: entryId,
    });
    if (error) throw error;
    return data as ContestVote;
  },

  async listRewards(contestId: string): Promise<ContestReward[]> {
    const { data, error } = await supabase
      .from('contest_rewards')
      .select('id, contest_id, entry_id, user_id, rank')
      .eq('contest_id', contestId)
      .order('rank', { ascending: true });
    if (error) throw error;
    return (data || []) as ContestReward[];
  },

  async uploadEntryPhoto(params: {
    contestId: string;
    userId: string;
    uri: string;
  }): Promise<{ publicUrl: string; storagePath: string }> {
    const response = await fetch(params.uri);
    const arrayBuffer = await response.arrayBuffer();
    const ext = params.uri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `entry-${Date.now()}.${ext}`;
    const storagePath = `entries/${params.contestId}/${params.userId}/${fileName}`;
    const contentType =
      response.headers.get('content-type') ||
      (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

    const { error } = await supabase.storage.from('contest-media').upload(storagePath, arrayBuffer, {
      contentType,
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from('contest-media').getPublicUrl(storagePath);
    return { publicUrl: data.publicUrl, storagePath };
  },

  async submitEntry(params: {
    contestId: string;
    title: string;
    content: string;
    mediaUrl: string;
    storagePath: string;
    legalVersion: string;
    lat?: number | null;
    lng?: number | null;
  }): Promise<ContestEntry> {
    const { data, error } = await supabase.rpc('contests_submit_entry', {
      p_contest_id: params.contestId,
      p_title: params.title,
      p_content: params.content,
      p_media_url: params.mediaUrl,
      p_storage_path: params.storagePath,
      p_legal_version: params.legalVersion,
      p_lat: params.lat ?? null,
      p_lng: params.lng ?? null,
    });
    if (error) throw error;
    return data as ContestEntry;
  },
};
