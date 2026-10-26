import type { InstalledGame } from '@/types';
import { libraryImageUrl, headerImageUrl } from '@/lib/steamLibrary';

const demoAppIds: { appid: number; name: string }[] = [
  { appid: 1086940, name: 'Baldur’s Gate 3' },
  { appid: 292030, name: 'The Witcher 3: Wild Hunt' },
  { appid: 1245620, name: 'Elden Ring' },
  { appid: 1174180, name: 'Red Dead Redemption 2' },
  { appid: 1091500, name: 'Cyberpunk 2077' },
  { appid: 2050650, name: 'Resident Evil 4' },
  { appid: 1593500, name: 'God of War' },
  { appid: 1716740, name: 'STAR WARS Jedi: Survivor' },
  { appid: 1888930, name: 'The Last of Us Part I' },
  { appid: 1599340, name: 'Hogwarts Legacy' },
  { appid: 1817070, name: 'Marvel’s Spider-Man Remastered' },
  { appid: 1817190, name: 'Marvel’s Spider-Man: Miles Morales' },
  { appid: 1145360, name: 'Hades' },
  { appid: 578080, name: 'PUBG: BATTLEGROUNDS' },
  { appid: 271590, name: 'Grand Theft Auto V' },
  { appid: 289070, name: 'Sid Meier’s Civilization VI' },
  { appid: 230410, name: 'Warframe' },
  { appid: 779340, name: 'Total War: THREE KINGDOMS' },
  { appid: 1144200, name: 'Horizon Zero Dawn' },
];

export const demoGames: InstalledGame[] = demoAppIds.map((g) => ({
  appid: g.appid,
  name: g.name,
  installdir: '',
  library_image: libraryImageUrl(g.appid),
  header_image: headerImageUrl(g.appid),
}));
