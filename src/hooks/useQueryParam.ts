import { useState, useCallback } from 'react';

export function useQueryParam(key: string): [string | null, (value: string | null) => void] {
  const [value, setValue] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get(key),
  );

  const set = useCallback(
    (v: string | null) => {
      setValue(v);
      const params = new URLSearchParams(window.location.search);
      if (v === null) {
        params.delete(key);
      } else {
        params.set(key, v);
      }
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    },
    [key],
  );

  return [value, set];
}
