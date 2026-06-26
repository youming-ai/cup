import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'wc-favorites';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(load);
  const favRef = useRef(favorites);
  favRef.current = favorites;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...favorites]));
    } catch {
      /* private/full storage — keep in-memory only */
    }
  }, [favorites]);

  // Sync favorites across browser tabs via the storage event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        setFavorites(new Set(JSON.parse(e.newValue) as string[]));
      } catch {
        /* ignore parse errors */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favRef.current.has(id), []);

  return { favorites, toggle, isFavorite };
}
