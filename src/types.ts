export interface SteamUser {
  steamId: string;
  personaName: string;
  avatarUrl?: string;
}

export interface InstalledGame {
  appid: number;
  name: string;
  installdir: string;
  size_on_disk?: number;
  library_image: string;
  header_image: string;
}

export type View = 'library' | 'account' | 'updates';

export interface GameNote {
  id: string;
  content: string;
  updatedAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconGray: string;
  achieved: boolean;
  unlockTime?: number; // unix seconds
  globalPercent?: number;
}

export interface AchievementSummary {
  total: number;
  achieved: number;
  achievements: Achievement[];
  hasPersonal?: boolean;
  error?: string;
}

export interface NewsItem {
  title: string;
  url: string;
  date: number; // unix seconds
  author: string;
  summary: string;
}
