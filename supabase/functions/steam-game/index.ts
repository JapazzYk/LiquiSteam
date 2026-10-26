/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action'); // 'news' | 'achievements' | 'playtime' | 'validate'
  const appid = url.searchParams.get('appid');

  try {
    if (action === 'news') {
      if (!appid) return jsonError(400, 'Missing appid');
      return await handleNews(appid);
    }
    if (action === 'achievements') {
      if (!appid) return jsonError(400, 'Missing appid');
      const steamId = url.searchParams.get('steamid');
      const apiKey = url.searchParams.get('key');
      return await handleAchievements(appid, steamId, apiKey);
    }
    if (action === 'playtime') {
      const apiKey = url.searchParams.get('key');
      const steamId = url.searchParams.get('steamid');
      if (!apiKey || !steamId) return jsonError(400, 'Missing key or steamid');
      const targetAppid = appid; // optional: filter to a single game
      return await handlePlaytime(apiKey, steamId, targetAppid);
    }
    if (action === 'validate') {
      const apiKey = url.searchParams.get('key');
      const steamId = url.searchParams.get('steamid');
      if (!apiKey || !steamId) return jsonError(400, 'Missing key or steamid');
      return await handleValidate(apiKey, steamId);
    }
    return jsonError(400, 'Unknown action');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonError(500, msg);
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

// Recent news/announcements for an app — public, no key required.
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

// Achievements: global unlock percentages (public) + the user's personal
// achievements if a Steam Web API key + steamid are provided.
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
      // schema optional
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
    // ignore
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
          personal.set(s.name, {
            achieved: s.achieved === 1,
            unlockTime: s.unlocktime ?? 0,
          });
        }
      }
    } catch {
      // ignore
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

// Playtime: fetch the user's owned games (server-side, with key) and return
// playtime_forever for the requested app (or the full map if no appid).
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
  }));
  return json({ games: map });
}

// Validate the key + steamid pair by making a tiny owned-games call. Returns
// ok=false with the Steam error message if the pair is invalid.
async function handleValidate(apiKey: string, steamId: string): Promise<Response> {
  const endpoint =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}` +
    `&steamid=${steamId}&include_appinfo=false&format=json`;
  const res = await fetch(endpoint);
  if (res.status === 401 || res.status === 403) {
    return json({ ok: false, error: 'Invalid Steam Web API key.' });
  }
  if (!res.ok) {
    return json({ ok: false, error: `Steam API returned ${res.status}` });
  }
  const data = await res.json();
  if (data?.response && typeof data.response === 'object') {
    return json({ ok: true });
  }
  return json({ ok: false, error: 'Unexpected Steam response.' });
}
