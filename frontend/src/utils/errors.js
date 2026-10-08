// Messages d'erreur lisibles pour les clientes : on dit ce qui s'est passé et quoi faire,
// sans jamais montrer de détail technique (trace, nom de table, message brut du serveur sur une erreur 5xx).

const SERVER_TROUBLE = 'Un problème est survenu de notre côté. Réessayez dans un instant ; si cela continue, écrivez-nous à support@monarmoire.store.';

const firstFieldMessage = (data) => {
  const first = Object.values(data)[0];
  const message = Array.isArray(first) ? first[0] : first;
  return typeof message === 'string' ? message : null;
};

/** Texte à afficher pour une erreur d'API. `fallback` sert quand le serveur ne donne aucune précision. */
export function errorText(err, fallback = 'Une erreur est survenue. Veuillez réessayer.') {
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
      return 'La connexion est trop lente : la demande n’a pas abouti. Réessayez dans un instant.';
    }
    if (err?.code === 'ERR_CANCELED') return fallback;
    return 'Connexion impossible. Vérifiez votre connexion internet puis réessayez.';
  }
  const { status, data } = err.response;
  const detail = data && typeof data === 'object' ? data : {};
  if (status === 429) return detail.detail || 'Trop de demandes en peu de temps. Patientez un instant puis réessayez.';
  if (status >= 500) return SERVER_TROUBLE;
  if (status === 413) return 'Le fichier envoyé est trop volumineux.';
  if (status === 401) return 'Votre session a expiré. Veuillez vous reconnecter.';
  if (status === 403) return detail.error || detail.detail || 'Vous n’avez pas l’autorisation d’effectuer cette action.';
  if (status === 404) return detail.error || detail.detail || 'Cet élément est introuvable ou n’est plus disponible.';
  return detail.error || detail.detail || firstFieldMessage(detail) || fallback;
}

/** Erreurs par champ d'un formulaire : { nom: 'message' } (réponse 400 de l'API). */
export function fieldErrors(err) {
  const data = err?.response?.data;
  if (err?.response?.status !== 400 || !data || typeof data !== 'object') return {};
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? String(value[0]) : String(value)]),
  );
}
