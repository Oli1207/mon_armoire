import { Link } from 'react-router-dom';
import { FaInstagram, FaTiktok, FaFacebook, FaYoutube, FaWhatsapp, FaTruck, FaLock, FaGift, FaHeadset } from 'react-icons/fa';
import useSiteStore from '../store/site';

export default function Footer() {
  const { site } = useSiteStore();
  const socials = [
    ['Instagram', site.instagram, FaInstagram],
    ['TikTok', site.tiktok, FaTiktok],
    ['Facebook', site.facebook, FaFacebook],
    ['YouTube', site.youtube, FaYoutube],
  ].filter(([, url]) => url);
  return (
    <footer className="site-footer">
      <div className="container py-5">
        <div className="row gy-5">
          <div className="col-lg-4">
            <h5 className="font-display fs-3 mb-2">Mon Armoire</h5>
            <p className="small mb-4" style={{ maxWidth: '18rem', opacity: 0.85 }}>{site.footer_text}</p>
            {(socials.length > 0 || site.whatsapp) && (
              <div className="footer-social d-flex fs-5 mb-3">
                {socials.map(([name, url, Icon]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={name}><Icon /></a>)}
                {site.whatsapp && <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><FaWhatsapp /></a>}
              </div>
            )}
            {site.tagline && <p className="font-script fs-4 mb-0">{site.tagline}</p>}
          </div>

          <div className="col-6 col-lg-2">
            <h6 className="text-uppercase small tracking-wide mb-3" style={{ opacity: 0.6 }}>Boutique</h6>
            <ul className="list-unstyled small d-flex flex-column gap-2">
              <li><Link to="/catalogue">Tous les bijoux</Link></li>
              <li><Link to="/coffrets">Coffrets</Link></li>
              <li><Link to="/lookbook">Lookbook</Link></li>
              <li><Link to="/guide-symboles">Guide des symboles</Link></li>
              <li><Link to="/quiz">Quel objet choisir ?</Link></li>
              <li><Link to="/cadeau">Je cherche un cadeau</Link></li>
              <li><Link to="/cartes-cadeaux">Cartes cadeaux</Link></li>
              <li><Link to="/suivi">Suivre ma commande</Link></li>
              <li><Link to="/installer">Installer l’application</Link></li>
            </ul>
          </div>

          <div className="col-6 col-lg-2">
            <h6 className="text-uppercase small tracking-wide mb-3" style={{ opacity: 0.6 }}>Aide</h6>
            <ul className="list-unstyled small d-flex flex-column gap-2">
              <li className="d-flex align-items-center gap-2"><FaTruck size={13} /> Livraison</li>
              <li className="d-flex align-items-center gap-2"><FaLock size={13} /> Paiement sécurisé</li>
              <li className="d-flex align-items-center gap-2"><FaGift size={13} /> Emballage cadeau</li>
              <li className="d-flex align-items-center gap-2"><FaHeadset size={13} /> Service client</li>
            </ul>
          </div>

          <div className="col-6 col-lg-2">
            <h6 className="text-uppercase small tracking-wide mb-3" style={{ opacity: 0.6 }}>Entreprise</h6>
            <ul className="list-unstyled small d-flex flex-column gap-2">
              <li><a href="#histoire">Notre histoire</a></li>
              <li><a href="#avis">Avis clients</a></li>
              {site.contact_email && <li><a href={`mailto:${site.contact_email}`}>{site.contact_email}</a></li>}
            </ul>
          </div>

          <div className="col-6 col-lg-2">
            <h6 className="text-uppercase small tracking-wide mb-3" style={{ opacity: 0.6 }}>Légal</h6>
            <ul className="list-unstyled small d-flex flex-column gap-2">
              {site.has_terms && <li><Link to="/conditions-generales">Conditions générales</Link></li>}
              {site.has_privacy && <li><Link to="/confidentialite">Politique de confidentialité</Link></li>}
              {site.phone && <li><a href={`tel:${site.phone.replace(/[^+\d]/g, '')}`}>{site.phone}</a></li>}
            </ul>
          </div>
        </div>

        <div className="d-flex flex-wrap justify-content-between gap-2 small pt-4 mt-4" style={{ borderTop: '1px solid rgba(253,251,247,0.15)', opacity: 0.75 }}>
          <span>© 2026 Mon Armoire. Tous droits réservés.</span>
          <span>{site.location}</span>
        </div>
      </div>
    </footer>
  );
}
