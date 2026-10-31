// A Steam entrega descrições e notícias no idioma que o desenvolvedor escolheu: algumas chegam em russo, chinês etc.
// Para o site ficar num idioma só (português, com inglês quando não há tradução), textos escritos em outros
// alfabetos são descartados.
const FOREIGN = new RegExp(
  '[\\p{Script=Cyrillic}\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}' +
    '\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Thai}\\p{Script=Devanagari}\\p{Script=Greek}]',
  'gu'
);
const LETTER = /\p{L}/gu;

export function looksForeign(text: string | undefined | null): boolean {
  if (!text) return false;
  const letters = text.match(LETTER)?.length ?? 0;
  if (letters < 6) return false;
  const foreign = text.match(FOREIGN)?.length ?? 0;
  return foreign / letters > 0.2;
}

// Tira o que sobra do formato das notícias da Steam: marcações [tag], imagens e endereços soltos.
export function cleanNewsText(text: string): string {
  return text
    .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, ' ')
    .replace(/\[\/?[a-z0-9*]+(?:=[^\]]*)?\]/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
