export function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

// Remove entradas vazias e repetidas de uma lista de URLs de imagem.
export function uniqueUrls(urls: (string | undefined)[]): string[] {
  return urls.filter((url, index, all): url is string => !!url && all.indexOf(url) === index);
}
