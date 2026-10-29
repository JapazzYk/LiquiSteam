/* eslint-disable @typescript-eslint/no-explicit-any */
// steam-game: dados da Steam. Dados públicos ficam abertos; dados pessoais
// exigem login e usam a chave guardada no servidor (nunca enviada ao navegador).
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, X-Client-Info',
};

// Cliente administrativo: existe só dentro da função.
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

interface Caller {
  userId: string;
  steamId: string;
}

// Quem está chamando, pelo token JWT. Sem login válido, devolve null.
async function currentCaller(req: Request): Promise<Caller | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin
    .from('steam_profiles')
    .select('steam_id')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (!profile) return null;
  return { userId: data.user.id, steamId: profile.steam_id as string };
}

async function storedApiKey(userId: string): Promise<string | null> {
  const { data } = await admin
    .from('steam_credentials')
    .select('api_key')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.api_key as string | undefined) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const appidParam = url.searchParams.get('appid');
  const appid = appidParam && /^\d+$/.test(appidParam) ? appidParam : null;

  try {
    // Público
    if (action === 'news' && req.method === 'GET') {
      if (!appid) return jsonError(400, 'appid inválido');
      return await handleNews(appid);
    }

    // Público: dados da loja (descrição, gêneros, nota, trailers). A loja da Steam não deixa o navegador
    // pedir direto, então a função busca e entrega só o que o site usa.
    if (action === 'details' && req.method === 'GET') {
      if (!appid) return jsonError(400, 'appid inválido');
      return await handleDetails(appid);
    }

    // Público, com conquistas pessoais se o usuário estiver logado e tiver chave
    if (action === 'achievements' && req.method === 'GET') {
      if (!appid) return jsonError(400, 'appid inválido');
      const caller = await currentCaller(req);
      const key = caller ? await storedApiKey(caller.userId) : null;
      return await handleAchievements(appid, caller && key ? caller.steamId : null, key);
    }

    // Pessoal
    if (action === 'playtime' && req.method === 'GET') {
      const caller = await currentCaller(req);
      if (!caller) return jsonError(401, 'Faça login com a Steam.');
      const key = await storedApiKey(caller.userId);
      if (!key) return jsonError(400, 'Cadastre sua chave da Steam Web API.');
      return await handlePlaytime(key, caller.steamId, appid);
    }

    if (action === 'status' && req.method === 'GET') {
      const caller = await currentCaller(req);
      if (!caller) return jsonError(401, 'Faça login com a Steam.');
      const key = await storedApiKey(caller.userId);
      return json({ hasKey: key !== null });
    }

    // Pessoal: se a conta Steam está online (a Steam aberta e logada, fora do modo invisível).
    if (action === 'presence' && req.method === 'GET') {
      const caller = await currentCaller(req);
      if (!caller) return jsonError(401, 'Faça login com a Steam.');
      const key = await storedApiKey(caller.userId);
      if (!key) return jsonError(400, 'Cadastre sua chave da Steam Web API.');
      return await handlePresence(key, caller.steamId);
    }

    if (action === 'save-key' && req.method === 'POST') {
      const caller = await currentCaller(req);
      if (!caller) return jsonError(401, 'Faça login com a Steam.');
      const body = await req.json().catch(() => null);
      const key = typeof body?.key === 'string' ? body.key.trim() : '';
      if (!/^[A-Fa-f0-9]{32}$/.test(key)) {
        return json({ ok: false, error: 'A chave tem 32 caracteres, só letras e números.' });
      }
      const check = await validateWithSteam(key, caller.steamId);
      if (!check.ok) return json(check);
      const { error } = await admin.from('steam_credentials').upsert({
        user_id: caller.userId,
        api_key: key,
        updated_at: new Date().toISOString(),
      });
      if (error) return jsonError(500, 'Não foi possível salvar a chave.');
      return json({ ok: true });
    }

    if (action === 'delete-key' && req.method === 'POST') {
      const caller = await currentCaller(req);
      if (!caller) return jsonError(401, 'Faça login com a Steam.');
      await admin.from('steam_credentials').delete().eq('user_id', caller.userId);
      return json({ ok: true });
    }

    return jsonError(400, 'Ação desconhecida');
  } catch (err) {
    console.error(err);
    return jsonError(500, 'Erro interno');
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, message: string): Response {
  return json({ error: message }, status);
}

// Detalhes da loja: públicos, sem chave. Guarda o resultado por algumas horas para não pedir à loja
// toda hora (ela limita o número de pedidos).
const detailsCache = new Map<string, { at: number; body: unknown }>();
const DETAILS_TTL_MS = 6 * 60 * 60 * 1000;

async function storeDetails(appid: string, cc: string, lang: string): Promise<{ data?: any; status?: number }> {
  const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=${lang}&cc=${cc}`;
  const res = await fetch(steamUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LiquiSteam/1.0)', Accept: 'application/json' },
  });
  if (!res.ok) return { status: res.status };
  const json = await res.json().catch(() => null);
  const entry = json?.[appid];
  return entry?.success && entry.data ? { data: entry.data } : {};
}

async function handleDetails(appid: string): Promise<Response> {
  const cached = detailsCache.get(appid);
  if (cached && Date.now() - cached.at < DETAILS_TTL_MS) return json(cached.body);

  // Português do Brasil primeiro; se a loja não liberar o jogo nessa região, tenta a versão em inglês.
  let result = await storeDetails(appid, 'br', 'brazilian');
  if (!result.data) {
    const second = await storeDetails(appid, 'us', 'english');
    if (second.data || result.status === undefined) result = second;
    else if (second.status !== undefined) result = { status: second.status };
  }
  if (!result.data) {
    // A resposta é 200 com o motivo, para o site poder explicar por que não há mídia.
    return json({ found: false, reason: result.status ? `store-${result.status}` : 'not-in-store' });
  }
  const d = result.data;

  // A loja às vezes devolve endereços http://; o site é https, então o navegador bloquearia o vídeo.
  const https = (url: unknown): string => (typeof url === 'string' ? url.replace(/^http:\/\//i, 'https://') : '');

  // Desde 2025 a loja não entrega mais mp4/webm direto: os trailers vêm só como streaming (HLS e DASH).
  // O "microtrailer" (mp4 curto e mudo, na mesma pasta) serve para as prévias dos cartões.
  const movies = (Array.isArray(d.movies) ? d.movies : []).slice(0, 8).map((m: any) => {
    const hls = https(m.hls_h264);
    return {
      id: m.id,
      name: m.name ?? '',
      thumbnail: https(m.thumbnail),
      hls,
      dash: https(m.dash_h264),
      micro: hls ? hls.replace(/\/[^\/?]+(\?.*)?$/, '/microtrailer.mp4') : '',
      mp4_480: https(m.mp4?.['480']),
      mp4_max: https(m.mp4?.max),
      webm_480: https(m.webm?.['480']),
      webm_max: https(m.webm?.max),
    };
  });

  const screenshots = (Array.isArray(d.screenshots) ? d.screenshots : []).slice(0, 24).map((sc: any) => ({
    id: sc.id,
    thumb: https(sc.path_thumbnail),
    full: https(sc.path_full),
  }));

  const body = {
    found: true,
    name: d.name ?? '',
    shortDescription: d.short_description ?? '',
    releaseDate: d.release_date?.date ?? '',
    comingSoon: !!d.release_date?.coming_soon,
    developers: Array.isArray(d.developers) ? d.developers : [],
    publishers: Array.isArray(d.publishers) ? d.publishers : [],
    genres: (Array.isArray(d.genres) ? d.genres : []).map((g: any) => g.description).filter(Boolean),
    categories: (Array.isArray(d.categories) ? d.categories : []).map((c: any) => c.description).filter(Boolean),
    metacritic: typeof d.metacritic?.score === 'number' ? d.metacritic.score : null,
    recommendations: typeof d.recommendations?.total === 'number' ? d.recommendations.total : null,
    achievements: typeof d.achievements?.total === 'number' ? d.achievements.total : null,
    dlcCount: Array.isArray(d.dlc) ? d.dlc.length : 0,
    languages: typeof d.supported_languages === 'string' ? d.supported_languages : '',
    controllerSupport: d.controller_support ?? null,
    price: d.is_free
      ? { free: true, final: 'Grátis', discount: 0 }
      : d.price_overview
        ? {
            free: false,
            final: d.price_overview.final_formatted ?? '',
            discount: d.price_overview.discount_percent ?? 0,
          }
        : null,
    platforms: {
      windows: !!d.platforms?.windows,
      mac: !!d.platforms?.mac,
      linux: !!d.platforms?.linux,
    },
    movies,
    screenshots,
  };
  detailsCache.set(appid, { at: Date.now(), body });
  return json(body);
}

// Notícias do jogo: públicas, sem chave.
async function handleNews(appid: string): Promise<Response> {
  const steamUrl =
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${appid}` +
    `&count=6&maxlength=300&format=json`;
  const res = await fetch(steamUrl);
  if (!res.ok) return json({ news: [] });
  const data = await res.json();
  const entries: any[] = data?.appnews?.newsitems ?? [];
  const news = entries.map((e) => ({
    title: e.title ?? '',
    url: e.url ?? `https://store.steampowered.com/app/${appid}`,
    date: e.date ?? 0,
    author: e.author ?? '',
    summary: e.contents ?? '',
  }));
  return json({ news });
}

// Conquistas: percentuais globais são públicos. As conquistas pessoais só vêm
// quando há login e chave cadastrada, e a chave é usada apenas aqui.
async function handleAchievements(
  appid: string,
  steamId: string | null,
  apiKey: string | null
): Promise<Response> {
  const schemaMap: Map<string, {
    name: string;
    displayName: string;
    description: string;
    icon: string;
    iconGray: string;
  }> = new Map();

  if (apiKey) {
    const schemaUrl =
      `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}` +
      `&appid=${appid}&l=english&format=json`;
    try {
      const sr = await fetch(schemaUrl);
      if (sr.ok) {
        const sd = await sr.json();
        const raw: any[] = sd?.game?.availableGameStats?.achievements ?? [];
        for (const a of raw) {
          schemaMap.set(a.name, {
            name: a.name,
            displayName: a.displayName ?? a.name,
            description: a.description ?? '',
            icon: normalizeAchievementImage(a.icon, appid),
            iconGray: normalizeAchievementImage(a.icongray, appid),
          });
        }
      }
    } catch {
      // schema é opcional
    }
  }

  const globalMap: Map<string, number> = new Map();
  try {
    const gUrl =
      `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?appid=${appid}&format=json`;
    const gr = await fetch(gUrl);
    if (gr.ok) {
      const gd = await gr.json();
      const arr: any[] = gd?.achievementpercentages?.achievements ?? [];
      for (const a of arr) {
        globalMap.set(a.name, a.percent);
      }
    }
  } catch {
    // ignora
  }

  const personal: Map<string, { achieved: boolean; unlockTime: number }> = new Map();
  let personalError: string | undefined;
  if (apiKey && steamId) {
    try {
      const pUrl =
        `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?key=${apiKey}` +
        `&steamid=${steamId}&appid=${appid}&l=english&format=json`;
      const pr = await fetch(pUrl);
      if (pr.ok) {
        const pd = await pr.json();
        personalError = pd?.playerstats?.success === false
          ? (pd?.playerstats?.error ?? 'Steam denied personal achievements')
          : undefined;
        const stats: any[] = pd?.playerstats?.achievements ?? [];
        for (const s of stats) {
          personal.set(s.apiname ?? s.name, {
            achieved: s.achieved === 1,
            unlockTime: s.unlocktime ?? 0,
          });
        }
      }
    } catch {
      // ignora
    }
  }

  const names = new Set<string>([...schemaMap.keys(), ...globalMap.keys()]);
  const achievements = [...names].map((name) => {
    const sch = schemaMap.get(name);
    const glob = globalMap.get(name);
    const pers = personal.get(name);
    return {
      id: name,
      name: sch?.displayName ?? name,
      description: sch?.description ?? '',
      icon: sch?.icon ?? '',
      iconGray: sch?.iconGray ?? '',
      achieved: pers?.achieved ?? false,
      unlockTime: pers?.unlockTime,
      globalPercent: glob,
    };
  });

  const achieved = achievements.filter((a) => a.achieved).length;
  return json({
    total: achievements.length,
    achieved,
    achievements,
    hasPersonal: personal.size > 0,
    error: typeof personalError === 'string' ? personalError : undefined,
  });
}

function normalizeAchievementImage(value: unknown, appid: string): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${value}`;
}

// Tempo de jogo de um jogo, ou de todos quando appid não é informado.
async function handlePlaytime(
  apiKey: string,
  steamId: string,
  appid: string | null
): Promise<Response> {
  const endpoint =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}` +
    `&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    return jsonError(res.status, `Steam API returned ${res.status}`);
  }
  const data = await res.json();
  const games: any[] = data?.response?.games ?? [];
  if (appid) {
    const g = games.find((x) => String(x.appid) === String(appid));
    return json({
      appid: Number(appid),
      playtime_forever: g?.playtime_forever ?? 0,
      name: g?.name ?? null,
    });
  }
  const map = games.map((g) => ({
    appid: g.appid,
    name: g.name,
    playtime_forever: g.playtime_forever ?? 0,
    // Minutos nas últimas duas semanas e quando foi jogado pela última vez (segundos desde 1970).
    playtime_2weeks: g.playtime_2weeks ?? 0,
    rtime_last_played: g.rtime_last_played ?? 0,
  }));
  return json({ games: map });
}

// Estado da conta na Steam. personastate 0 = offline; qualquer outro valor = online.
async function handlePresence(apiKey: string, steamId: string): Promise<Response> {
  const endpoint =
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}` +
    `&steamids=${steamId}&format=json`;
  const res = await fetch(endpoint);
  if (!res.ok) return jsonError(res.status, `Steam API returned ${res.status}`);
  const data = await res.json().catch(() => null);
  const player = data?.response?.players?.[0];
  const state = Number(player?.personastate ?? 0);
  return json({ online: state !== 0, personastate: state });
}

// Confirma que a chave é válida para aquele SteamID antes de salvar.
async function validateWithSteam(
  apiKey: string,
  steamId: string
): Promise<{ ok: boolean; error?: string }> {
  const endpoint =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}` +
    `&steamid=${steamId}&include_appinfo=false&format=json`;
  const res = await fetch(endpoint);
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: 'Chave inválida.' };
  }
  if (!res.ok) {
    return { ok: false, error: `A Steam respondeu ${res.status}.` };
  }
  const data = await res.json().catch(() => null);
  if (data?.response && typeof data.response === 'object') return { ok: true };
  return { ok: false, error: 'Resposta inesperada da Steam.' };
}