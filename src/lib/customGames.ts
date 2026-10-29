import type { InstalledGame } from '@/types';
import type { HelperCustomGame } from '@/lib/steamHelper';

// ID numérico negativo, estável, só para identificar o jogo próprio nas listas (nunca vai para a Steam).
function pseudoAppId(customId: string): number {
  return -(parseInt(customId.slice(0, 7), 16) + 1);
}

export function customToGame(custom: HelperCustomGame): InstalledGame {
  return {
    appid: pseudoAppId(custom.id),
    name: custom.name,
    installdir: '',
    library_image: custom.cover ?? '',
    header_image: custom.cover ?? '',
    custom: true,
    customId: custom.id,
    added: custom.added,
  };
}

// Capa de reserva para jogos sem imagem: cor estável a partir do nome.
export function placeholderHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}
