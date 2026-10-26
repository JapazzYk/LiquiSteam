// steam-auth: confirma no servidor a resposta do login Steam (OpenID 2.0) e
// devolve um token para o navegador criar uma sessão Supabase real.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, X-Client-Info',
};

// Origens que podem iniciar login. Pode ser trocado pela variável ALLOWED_ORIGINS.
const ALLOWED_ORIGINS = (
  Deno.env.get('ALLOWED_ORIGINS') ?? 'https://liquisteam.vercel.app,http://localhost:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  try {
    const body = await req.json().catch(() => null);
    const params = sanitizeParams(body?.params);
    if (!params) return json({ error: 'Parâmetros inválidos' }, 400);

    if (params['openid.ns'] !== OPENID_NS || params['openid.mode'] !== 'id_res') {
      return json({ error: 'Resposta de login inválida' }, 400);
    }
    if (params['openid.op_endpoint'] !== STEAM_OPENID_ENDPOINT) {
      return json({ error: 'Provedor inesperado' }, 400);
    }

    // A resposta só vale se foi enviada de uma origem permitida.
    const returnTo = params['openid.return_to'] ?? '';
    if (!ALLOWED_ORIGINS.some((origin) => returnTo.startsWith(origin + '/'))) {
      return json({ error: 'Origem não autorizada' }, 400);
    }

    const claimed = params['openid.claimed_id'] ?? '';
    const match = claimed.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
    if (!match) return json({ error: 'Identidade Steam inválida' }, 400);
    const steamId = match[1];

    // Confirma com a Steam que a assinatura é verdadeira e que a resposta ainda não foi usada.
    const verifyBody = new URLSearchParams({ ...params, 'openid.mode': 'check_authentication' });
    const verifyRes = await fetch(STEAM_OPENID_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody,
    });
    const verifyText = await verifyRes.text();
    if (!/is_valid\s*:\s*true/.test(verifyText)) {
      return json({ error: 'A Steam não confirmou o login' }, 401);
    }

    const profile = await fetchProfile(steamId);
    const userId = await findOrCreateUser(steamId);

    const { error: profileError } = await admin.from('steam_profiles').upsert({
      steam_id: steamId,
      user_id: userId,
      persona_name: profile.persona_name,
      avatar_url: profile.avatar_url,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    // Vincula notas antigas deste SteamID (criadas antes das contas) ao novo usuário.
    await admin.from('game_notes').update({ user_id: userId }).eq('steam_id', steamId).is('user_id', null);

    // Gera um token de uso único que o navegador troca por uma sessão.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: emailFor(steamId),
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) return json({ error: 'Não foi possível criar a sessão' }, 500);

    return json({
      token_hash: tokenHash,
      steam_id: steamId,
      persona_name: profile.persona_name,
      avatar_url: profile.avatar_url,
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Erro interno' }, 500);
  }
});

function sanitizeParams(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.startsWith('openid.')) continue;
    if (typeof value !== 'string' || value.length > 2000) return null;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function emailFor(steamId: string): string {
  // Conta interna: não recebe e-mails e não tem senha. O acesso é só pela Steam.
  return `${steamId}@steam.liquisteam.app`;
}

async function findOrCreateUser(steamId: string): Promise<string> {
  const { data: existing } = await admin
    .from('steam_profiles')
    .select('user_id')
    .eq('steam_id', steamId)
    .maybeSingle();
  if (existing?.user_id) return existing.user_id as string;

  const { data, error } = await admin.auth.admin.createUser({
    email: emailFor(steamId),
    email_confirm: true,
    app_metadata: { provider: 'steam', steam_id: steamId },
  });
  if (error || !data.user) throw error ?? new Error('createUser falhou');
  return data.user.id;
}

// Nome e avatar vêm direto do servidor da Steam, sem proxy de terceiros.
async function fetchProfile(steamId: string): Promise<{ persona_name: string; avatar_url: string | null }> {
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
    if (!res.ok) throw new Error('profile fetch failed');
    const xml = await res.text();
    const name = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
    const avatar = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
    return {
      persona_name: name ? name[1] : 'Steam Player',
      avatar_url: avatar ? avatar[1] : null,
    };
  } catch {
    return { persona_name: 'Steam Player', avatar_url: null };
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
