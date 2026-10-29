import { useCallback, useState } from 'react';
import type { SyntheticEvent } from 'react';

export type ArtFit = 'cover' | 'contain';

// Mostra a arte inteira, sem cortar. Quando a proporção da imagem bate com a da moldura
// (capa vertical 2:3 no cartão, arte larga no destaque) ela preenche a moldura; quando não bate
// (por exemplo, a imagem horizontal da loja no lugar de uma capa vertical), fica inteira e centralizada
// sobre um fundo desfocado da própria imagem (ver [data-fit='contain'] em src/index.css).
// target = largura / altura esperada; tolerance = diferença relativa aceita.
export function useArtFit(target: number, tolerance: number) {
  const [fit, setFit] = useState<ArtFit>('cover');
  const onLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      setFit(Math.abs(ratio - target) / target > tolerance ? 'contain' : 'cover');
    },
    [target, tolerance]
  );
  return { fit, onLoad };
}

// Variável CSS com a imagem atual, usada no fundo desfocado do modo "contain".
export function artBackdrop(src: string | undefined): Record<string, string> {
  return src ? { '--art-url': `url("${src}")` } : {};
}
