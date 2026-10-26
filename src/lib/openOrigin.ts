// Posição de onde o detalhe do jogo "nasce": a capa que o usuário clicou.
// O detalhe usa esse retângulo para abrir e fechar como uma expansão da capa.
export interface OpenOrigin {
  rect: DOMRect;
  radius: number;
}

export function readOrigin(element: HTMLElement | null | undefined): OpenOrigin | undefined {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
  return { rect, radius };
}
