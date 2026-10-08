import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../utils/axios';
import { errorText } from '../../utils/errors';
import ListStatus from '../../components/ListStatus';

const PAGES = {
  terms: { title: 'Conditions générales de vente', field: 'terms_text' },
  privacy: { title: 'Politique de confidentialité', field: 'privacy_text' },
};

/** Page de texte juridique : le texte vient de l'Admin ; il est affiché tel quel (jamais interprété comme du HTML). */
export default function LegalScreen({ page }) {
  const { title, field } = PAGES[page];
  const [state, setState] = useState({ loading: true, error: '', text: '' });

  const load = useCallback(() => {
    setState({ loading: true, error: '', text: '' });
    axiosInstance.get('/api/site/legal/')
      .then(({ data }) => setState({ loading: false, error: '', text: data[field] || '' }))
      .catch((err) => setState({ loading: false, error: errorText(err, 'Cette page n’a pas pu être chargée.'), text: '' }));
  }, [field]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="container py-4 py-md-5" style={{ maxWidth: '46rem' }}>
      <h1 className="h2 mb-4">{title}</h1>
      <ListStatus loading={state.loading} error={state.error} onRetry={load} isEmpty={!state.text} emptyText="Ce texte sera bientôt disponible." rows={5} />
      {state.text && state.text.split(/\n{2,}/).map((block, i) => <p key={i} style={{ whiteSpace: 'pre-line' }}>{block}</p>)}
    </div>
  );
}
