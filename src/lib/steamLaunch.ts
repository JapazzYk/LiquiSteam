// Detecting whether the Steam client is actually running is something a real
// desktop launcher (Tauri/Electron) does by checking the OS process list. In a
// browser/web app we can't inspect processes — but we CAN trigger
// `steam://run/...` and `steam://open/...` URL schemes. Browsers show a prompt
// the first time a scheme is used; once the user has allowed `steam://`, links
// open Steam without prompts.
//
// So for the "Open Steam" button we simply navigate to a steam:// URL. There's
// no reliable way to programmatically confirm Steam launched, so the
// "running" state in the UI is a manual toggle the user confirms — with a
// best-effort auto-attempt when they click "Open Steam".

export function openSteamClient(): void {
  window.location.href = 'steam://open/main';
}

export function stopSteamClient(): void {
  window.location.href = 'steam://exit';
}

export function launchGame(appid: number): void {
  window.location.href = `steam://run/${appid}`;
}
