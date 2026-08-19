import { useCallback, useEffect, useState } from 'react';

type ApiState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): [ApiState<T>, () => void] {
  const [state, setState] = useState<ApiState<T>>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: 'error', message: error.message });
      });
    return () => {
      cancelled = true;
    };
    // fetcher is expected to be a fresh closure per render when deps change — deps drives refetch, not fetcher identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return [state, reload];
}
