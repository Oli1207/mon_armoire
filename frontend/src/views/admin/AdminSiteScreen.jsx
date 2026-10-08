import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { Field, ImageField, PageHeader, errorText, fieldErrors } from './ui/parts';

export default function AdminSiteScreen() {
  const { notify } = useAdminUi();
  const [site, setSite] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [errors, setErrors] = useState({});
  const [epoch, setEpoch] = useState(0);   // remonté seulement après une erreur : les champs repartent des valeurs enregistrées

  const load = useCallback(() => {
    adminAPI.siteSettings()
      .then(({ data }) => { setSite(data); setStatus({ loading: false, error: '' }); })
      .catch((err) => setStatus({ loading: false, error: errorText(err, 'Impossible de charger les réglages.') }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (field, value, success = 'Enregistré. Le site est à jour (quelques minutes au maximum).') => {
    setErrors({});
    try {
      const { data } = await adminAPI.updateSiteSettings({ [field]: value });
      setSite(data);
      notify(success);
    } catch (err) {
      setErrors(fieldErrors(err));
      notify(errorText(err), 'error');
      setEpoch((e) => e + 1);
    }
  };

  if (!site) return <div><PageHeader title="Textes et contacts" /><ListStatus loading={status.loading} error={status.error} onRetry={load} isEmpty rows={4} /></div>;

  const text = (field, label, help, props = {}) => (
    <Field label={label} help={help} error={errors[field]} htmlFor={`s-${field}`}>
      <input
        id={`s-${field}`} className="form-control" autoComplete="off" defaultValue={site[field]} {...props}
        onBlur={(e) => { if (e.target.value !== (site[field] ?? '')) save(field, e.target.value); }}
      />
    </Field>
  );

  return (
    <div key={epoch}>
      <PageHeader
        kicker="Réglages" title="Textes et contacts"
        lead="Tout ce qui est écrit sur le site et que vous pouvez changer vous-même. Chaque case s’enregistre toute seule quand vous cliquez en dehors : un message vert confirme. Le site se met à jour en quelques minutes."
      />

      <section className="admin-card">
        <h2 className="admin-card-title">Bandeau tout en haut du site</h2>
        {text('announcement', 'Message du bandeau vert', 'La phrase qui défile tout en haut de chaque page (ex : « Livraison offerte dès 50 000 FCFA »). Laissez vide pour ne rien afficher.', { maxLength: 200 })}
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Page d’accueil — grande bannière</h2>
        <div className="admin-grid cols-2">
          {text('hero_kicker', 'Petit texte au-dessus du titre', 'Ex : Bijoux & objets chrétiens.', { maxLength: 80 })}
          {text('hero_title', 'Titre', 'Le dernier mot du titre s’affiche en doré. Ex : « Porte ta foi avec élégance ».', { maxLength: 80 })}
        </div>
        {text('hero_text', 'Phrase sous le titre', 'Une ou deux lignes pour présenter la boutique.', { maxLength: 250 })}
        <ImageField
          label="Photo de la bannière" value={site.hero_image} onProblem={(m) => notify(m, 'error')}
          help="Photo en hauteur de préférence, avec le bijou bien visible. Si vous n’en choisissez pas, la photo d’origine reste."
          onChange={async (file) => {
            const form = new FormData();
            form.append('hero_image', file);
            try {
              const { data } = await adminAPI.updateSiteSettings(form);
              setSite(data);
              notify('Photo de la bannière enregistrée.');
            } catch (err) {
              notify(errorText(err), 'error');
            }
          }}
        />
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Bas de page</h2>
        {text('footer_text', 'Texte de présentation', 'Quelques mots sur la boutique, sous le nom en bas de chaque page.', { maxLength: 250 })}
        <div className="admin-grid cols-2">
          {text('tagline', 'Slogan (écriture manuscrite)', 'Ex : « Chaque vision mérite de voir le jour ».', { maxLength: 120 })}
          {text('location', 'Ville affichée', 'Ex : Abidjan, Côte d’Ivoire.', { maxLength: 80 })}
        </div>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Contacts</h2>
        <div className="admin-grid cols-2">
          {text('contact_email', 'Adresse e-mail de contact', 'Affichée en bas de page. Les clientes peuvent cliquer pour vous écrire.', { type: 'email', inputMode: 'email' })}
          {text('phone', 'Téléphone', 'Affiché en bas de page, avec l’indicatif. Ex : +225 07 99 16 73 93.', { type: 'tel', inputMode: 'tel', maxLength: 30 })}
        </div>
        {text('whatsapp', 'Numéro WhatsApp', 'Chiffres seulement, avec l’indicatif du pays, sans « + » ni espaces. Ex : 2250799167393. Une icône WhatsApp apparaît en bas de page.', { inputMode: 'numeric', maxLength: 20 })}
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Alertes par e-mail</h2>
        {text('notify_email', 'Adresse qui reçoit les alertes', 'Privée : jamais affichée sur le site. Elle reçoit un e-mail à chaque nouvelle commande payée, stock faible ou nouvel avis. Laissez vide pour ne pas recevoir d’e-mail (les notifications sur votre téléphone restent possibles : bouton « Activer les alertes » en haut de l’Admin).', { type: 'email', inputMode: 'email' })}
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Réseaux sociaux</h2>
        <p className="admin-help">Ouvrez votre page (Instagram, TikTok…), copiez l’adresse tout en haut du navigateur (elle commence par https://) et collez-la ici. Laissez vide : l’icône n’apparaît pas.</p>
        <div className="admin-grid cols-2">
          {text('instagram', 'Instagram', null, { type: 'url', inputMode: 'url', placeholder: 'https://www.instagram.com/…' })}
          {text('tiktok', 'TikTok', null, { type: 'url', inputMode: 'url', placeholder: 'https://www.tiktok.com/@…' })}
          {text('facebook', 'Facebook', null, { type: 'url', inputMode: 'url', placeholder: 'https://www.facebook.com/…' })}
          {text('youtube', 'YouTube', null, { type: 'url', inputMode: 'url', placeholder: 'https://www.youtube.com/@…' })}
        </div>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Textes juridiques</h2>
        <p className="admin-help">
          Collez ici le texte complet. Une ligne vide sépare deux paragraphes. Quand un texte est rempli, un lien apparaît en bas de page ; vide, le lien n’apparaît pas.
          Faites relire ces textes par une personne compétente avant de les publier.
        </p>
        <Field label="Conditions générales de vente" htmlFor="s-terms_text" error={errors.terms_text}>
          <textarea id="s-terms_text" rows={10} className="form-control" defaultValue={site.terms_text} onBlur={(e) => { if (e.target.value !== site.terms_text) save('terms_text', e.target.value); }} />
        </Field>
        <Field label="Politique de confidentialité" htmlFor="s-privacy_text" error={errors.privacy_text}>
          <textarea id="s-privacy_text" rows={10} className="form-control" defaultValue={site.privacy_text} onBlur={(e) => { if (e.target.value !== site.privacy_text) save('privacy_text', e.target.value); }} />
        </Field>
      </section>
    </div>
  );
}
