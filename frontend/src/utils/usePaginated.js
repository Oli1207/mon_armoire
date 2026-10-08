import { useCallback, useEffect, useRef, useState } from 'react';

const LOAD_ERROR = 'Impossible de charger la liste. Vérifiez votre connexion puis réessayez.';

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Liste paginée « page par page » (back-office).
 * fetcher({ ...params, page }) doit renvoyer la réponse DRF { count, results }.
 * Une réponse arrivée en retard (ancienne page ou ancien filtre) est ignorée.
 */
export default function usePaginated(fetcher, params = {}, pageSize = 20) {
  const key = JSON.stringify(params);
  const [pageState, setPageState] = useState({ key, page: 1 });
  const page = pageState.key === key ? pageState.page : 1; // un nouveau filtre revient à la page 1 sans requête en double
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ items: [], count: 0, loading: true, error: '' });
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fetcher({ ...JSON.parse(key), page })
      .then(({ data }) => {
        if (id === latest.current) setState({ items: data.results, count: data.count, loading: false, error: '' });
      })
      .catch(() => {
        if (id === latest.current) setState((s) => ({ ...s, loading: false, error: LOAD_ERROR }));
      });
  }, [key, page, version]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    page,
    pageSize,
    setPage: (next) => setPageState({ key, page: next }),
    reload: () => setVersion((v) => v + 1),
  };
}

/** Liste « Voir plus » (catalogue, commandes du compte, avis) : les pages suivantes s'ajoutent à la suite. */
export function useLoadMore(fetcher, params = {}, enabled = true) {
  const key = JSON.stringify(params);
  const [state, setState] = useState({ items: [], count: 0, summary: null, page: 1, hasMore: false, loading: true, loadingMore: false, error: '' });
  const latest = useRef(0);

  const load = useCallback((page) => {
    const id = ++latest.current;
    setState((s) => (page === 1 ? { ...s, loading: true, error: '' } : { ...s, loadingMore: true, error: '' }));
    fetcher({ ...JSON.parse(key), page })
      .then(({ data }) => {
        if (id !== latest.current) return;
        setState((s) => ({
          items: page === 1 ? data.results : [...s.items, ...data.results],
          count: data.count,
          summary: data.summary ?? s.summary,
          page,
          hasMore: Boolean(data.next),
          loading: false,
          loadingMore: false,
          error: '',
        }));
      })
      .catch(() => {
        if (id === latest.current) setState((s) => ({ ...s, loading: false, loadingMore: false, error: LOAD_ERROR }));
      });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) load(1);
  }, [load, enabled]);

  return {
    ...state,
    loadMore: () => { if (state.hasMore && !state.loadingMore) load(state.page + 1); },
    reload: () => load(1),
    setItems: (updater) => setState((s) => ({ ...s, items: updater(s.items) })),
  };
}
