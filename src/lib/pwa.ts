// Detects whether the File System Access API (needed to read the local Steam
// folder) can actually run in the current context. An embedded preview runs the app
// inside an iframe, and browsers block showDirectoryPicker() in iframed
// documents unless the allow="local-folders" permission is set. We surface a
// clear, actionable message when that's the case.

export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function fileSystemAccessBlockedByIframe(): boolean {
  // showDirectoryPicker may exist on window even inside an iframe, but calling
  // it throws SecurityError. We treat iframe + present API as "blocked" and
  // let the user install the app to escape the iframe.
  return isInIframe();
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

export function initInstallPromptListener(): () => void {
  const handler = (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l(deferredPrompt));
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}

export function onInstallPromptChange(
  cb: (e: BeforeInstallPromptEvent | null) => void
): () => void {
  listeners.add(cb);
  cb(deferredPrompt);
  return () => {
    listeners.delete(cb);
  };
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  listeners.forEach((l) => l(null));
  return choice.outcome;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
