// Atalhos para o cliente da Steam pelo protocolo steam://. O navegador pergunta uma vez se pode abrir o
// endereço; depois disso abre sem perguntar. Não há como o site confirmar que a Steam abriu: quem informa o
// estado real é o Helper (ou a conta Steam), ver useSteamStatus.ts.

export function openSteamClient(): void {
  window.location.href = 'steam://open/main';
}

export function stopSteamClient(): void {
  window.location.href = 'steam://exit';
}

export function launchGame(appid: number): void {
  window.location.href = `steam://run/${appid}`;
}
