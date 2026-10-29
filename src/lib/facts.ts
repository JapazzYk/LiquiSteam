import type { InstalledGame } from '@/types';
import type { GameDetails, PlaytimeEntry } from '@/lib/steamMeta';

// "48 h", "1,5 h", "35 min".
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1).replace('.', ',')} h`;
  return `${Math.round(hours).toLocaleString('pt-BR')} h`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export interface LibraryStats {
  totalMinutes: number;
  twoWeeksMinutes: number;
  played: number;
  neverPlayed: number;
  total: number;
  top: { game: InstalledGame; minutes: number } | null;
}

// Resumo da biblioteca a partir do tempo de jogo da Steam. Só conta jogos que estão na lista.
export function libraryStats(games: InstalledGame[], playtimes: Map<number, PlaytimeEntry>): LibraryStats {
  let totalMinutes = 0;
  let twoWeeksMinutes = 0;
  let played = 0;
  let neverPlayed = 0;
  let top: LibraryStats['top'] = null;
  for (const game of games) {
    if (game.custom) continue;
    const entry = playtimes.get(game.appid);
    const minutes = entry?.forever ?? 0;
    totalMinutes += minutes;
    twoWeeksMinutes += entry?.twoWeeks ?? 0;
    if (minutes > 0) played++;
    else neverPlayed++;
    if (minutes > 0 && (!top || minutes > top.minutes)) top = { game, minutes };
  }
  return { totalMinutes, twoWeeksMinutes, played, neverPlayed, total: played + neverPlayed, top };
}

// Curiosidades sobre as horas de um jogo, comparando com a sua biblioteca.
export function playtimeFacts(
  game: InstalledGame,
  playtimes: Map<number, PlaytimeEntry>,
  games: InstalledGame[]
): string[] {
  const entry = playtimes.get(game.appid);
  if (!entry) return [];
  const minutes = entry.forever;
  if (minutes <= 0) return ['Você ainda não jogou este título: ele está esperando na biblioteca.'];

  const facts: string[] = [];
  const hours = minutes / 60;
  facts.push(`Você jogou ${formatHours(minutes)} no total.`);

  if (hours >= 24) {
    const days = hours / 24;
    facts.push(`Isso equivale a ${days.toFixed(1).replace('.', ',')} dias seguidos, sem dormir.`);
  } else if (hours >= 2) {
    const movies = Math.floor(hours / 2);
    facts.push(`Dá para assistir ${movies} ${plural(movies, 'filme', 'filmes')} de 2 horas nesse tempo.`);
  }
  if (hours >= 40) {
    const weeks = hours / 40;
    facts.push(`São ${weeks.toFixed(1).replace('.', ',')} semanas de trabalho de 40 horas.`);
  }

  const installed = games.filter((g) => !g.custom);
  let totalMinutes = 0;
  const ranked: number[] = [];
  for (const g of installed) {
    const m = playtimes.get(g.appid)?.forever ?? 0;
    totalMinutes += m;
    if (m > 0) ranked.push(m);
  }
  if (totalMinutes > 0) {
    const share = (minutes / totalMinutes) * 100;
    if (share >= 1) facts.push(`É ${Math.round(share)}% de todo o seu tempo de jogo da biblioteca.`);
    const position = ranked.filter((m) => m > minutes).length + 1;
    if (ranked.length > 1) {
      facts.push(`É o ${position}º mais jogado, entre ${ranked.length} jogos que você já abriu.`);
    }
  }

  if (entry.twoWeeks > 0) facts.push(`Nas últimas 2 semanas: ${formatHours(entry.twoWeeks)}.`);
  if (entry.lastPlayed > 0) {
    const days = Math.floor((Date.now() / 1000 - entry.lastPlayed) / 86400);
    if (days <= 0) facts.push('Você jogou hoje.');
    else if (days === 1) facts.push('Você jogou ontem.');
    else if (days < 60) facts.push(`Faz ${days} dias desde a última vez que você jogou.`);
    else facts.push(`Faz ${Math.round(days / 30)} meses desde a última vez que você jogou.`);
  }
  return facts;
}

// Curiosidades sobre o jogo, vindas da loja da Steam.
export function gameFacts(details: GameDetails): string[] {
  const facts: string[] = [];
  if (details.releaseDate) {
    facts.push(details.comingSoon ? `Lançamento previsto: ${details.releaseDate}.` : `Lançado em ${details.releaseDate}.`);
  }
  if (details.developers.length > 0) {
    const publisher = details.publishers.find((p) => !details.developers.includes(p));
    facts.push(
      `Desenvolvido por ${details.developers.slice(0, 2).join(' e ')}${publisher ? `, publicado por ${publisher}` : ''}.`
    );
  }
  if (details.genres.length > 0) facts.push(`Gêneros: ${details.genres.slice(0, 4).join(', ')}.`);
  if (details.metacritic !== null) facts.push(`Nota da crítica no Metacritic: ${details.metacritic}.`);
  if (details.recommendations !== null && details.recommendations > 0) {
    facts.push(`${details.recommendations.toLocaleString('pt-BR')} jogadores recomendaram o jogo na Steam.`);
  }
  if (details.achievements !== null && details.achievements > 0) {
    facts.push(`Tem ${details.achievements} conquistas para desbloquear.`);
  }
  if (details.languages) {
    facts.push(
      /portugu[eê]s\s*-\s*brasil/i.test(details.languages)
        ? 'Tem tradução para o português do Brasil.'
        : 'Não tem tradução oficial para o português do Brasil.'
    );
  }
  if (details.controllerSupport === 'full') facts.push('Tem suporte completo a controle.');
  if (details.dlcCount > 0) facts.push(`Tem ${details.dlcCount} ${plural(details.dlcCount, 'conteúdo extra', 'conteúdos extras')} (DLC).`);
  if (details.price) {
    facts.push(
      details.price.free
        ? 'É gratuito.'
        : `Preço atual na loja: ${details.price.final}${details.price.discount > 0 ? ` (${details.price.discount}% de desconto)` : ''}.`
    );
  }
  return facts;
}
