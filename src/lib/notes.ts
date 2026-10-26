import type { GameNote } from '@/types';
import { supabase } from '@/lib/supabaseClient';

export async function loadNote(
  steamId: string,
  appId: number
): Promise<GameNote | null> {
  const { data, error } = await supabase
    .from('game_notes')
    .select('id, content, updated_at')
    .eq('steam_id', steamId)
    .eq('app_id', appId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return {
    id: data.id as string,
    content: data.content as string,
    updatedAt: data.updated_at as string,
  };
}

export async function saveNote(
  steamId: string,
  appId: number,
  gameName: string,
  content: string
): Promise<GameNote | null> {
  // Upsert: insert if missing, update content + timestamp if present.
  const { data, error } = await supabase
    .from('game_notes')
    .upsert(
      {
        steam_id: steamId,
        app_id: appId,
        game_name: gameName,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'steam_id,app_id' }
    )
    .select('id, content, updated_at')
    .maybeSingle();

  if (error) return null;
  if (!data) return null;
  return {
    id: data.id as string,
    content: data.content as string,
    updatedAt: data.updated_at as string,
  };
}
