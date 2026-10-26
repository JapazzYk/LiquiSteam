import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL;
export const ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A sessão fica salva no navegador, então o login Steam continua válido ao recarregar.
export const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Token do usuário logado, ou a chave pública quando ninguém está logado.
export async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? ANON_KEY;
}
