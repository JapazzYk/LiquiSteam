import type { GameNote } from '@/types';
import { supabase } from '@/lib/supabaseClient';

// A RLS do banco limita a leitura e a escrita às notas do próprio usuário logado.
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
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return null;

  // Upsert: insere se não existir, atualiza conteúdo e data se já existir.
  const { data, error } = await supabase
    .from('game_notes')
    .upsert(
      {
        user_id: uid,
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
