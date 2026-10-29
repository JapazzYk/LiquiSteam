import { useCallback, useState } from 'react';
import type { SyntheticEvent } from 'react';

export type ArtFit = 'cover' | 'contain';

// Mostra a arte inteira, sem cortar. Quando a proporção da imagem bate com a da moldura
// (capa vertical 2:3 no cartão, arte larga no destaque) ela preenche a moldura; quando não bate
// (por exemplo, a imagem horizontal da loja no lugar de uma capa vertical), fica inteira e centralizada
// sobre um fundo desfocado da própria imagem (ver [data-fit='contain'] em src/index.css).
// target = largura / altura esperada; tolerance = diferença relativa aceita.
// cacheKey: lembra o resultado por jogo, para a capa não "piscar" quando o cartão é recriado (ex.: busca).
const fitCache = new Map<string, ArtFit>();

export function useArtFit(target: number, tolerance: number, cacheKey?: string) {
  const [fit, setFit] = useState<ArtFit>(() => (cacheKey ? fitCache.get(cacheKey) : undefined) ?? 'cover');
  const onLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      const next: ArtFit = Math.abs(ratio - target) / target > tolerance ? 'contain' : 'cover';
      if (cacheKey) fitCache.set(cacheKey, next);
      setFit(next);
    },
    [target, tolerance, cacheKey]
  );
  return { fit, onLoad };
}

// Variável CSS com a imagem atual, usada no fundo desfocado do modo "contain".
export function artBackdrop(src: string | undefined): Record<string, string> {
  return src ? { '--art-url': `url("${src}")` } : {};
}
