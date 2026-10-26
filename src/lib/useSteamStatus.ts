import { useCallback, useEffect, useState } from 'react';

// Tracks whether the Steam client is "running" in the background.
// Browsers can't inspect OS processes, so this is a user-confirmed state:
// when the user clicks "Open Steam", we attempt to launch it via steam:// and
// mark the state as "starting". After a short delay we mark it "running" so
// the run buttons unlock. The user can also toggle it manually if Steam is
// already open.
export type SteamStatus = 'unknown' | 'starting' | 'running' | 'not-running';

const STORAGE_KEY = 'liquid_steam_status';

function readStored(): SteamStatus {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'running' || v === 'not-running') return v;
  } catch {
    // ignore
  }
  return 'unknown';
}

export function useSteamStatus() {
  const [status, setStatus] = useState<SteamStatus>(() => readStored());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, status);
    } catch {
      // ignore
    }
  }, [status]);

  const markStarting = useCallback(() => {
    setStatus('starting');
    // Give Steam a moment to launch before unlocking run buttons.
    window.setTimeout(() => {
      setStatus((s) => (s === 'starting' ? 'running' : s));
    }, 4000);
  }, []);

  const setRunning = useCallback(() => setStatus('running'), []);
  const setNotRunning = useCallback(() => setStatus('not-running'), []);

  const toggle = useCallback(() => {
    setStatus((s) => (s === 'running' ? 'not-running' : 'running'));
  }, []);

  return { status, markStarting, setRunning, setNotRunning, toggle };
}
