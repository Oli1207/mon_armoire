import { Link } from 'react-router-dom';
import { FaInstagram, FaTiktok, FaFacebook, FaYoutube, FaTruck, FaLock, FaGift, FaHeadset } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container py-5">
        <div className="row gy-5">
          <div className="col-lg-4">
            <h5 className="font-display fs-3 mb-2">Mon Armoire</h5>
            <p className="small mb-4" style={{ maxWidth: 280, opacity: 0.85 }}>
              Des bijoux et objets de piété pensés pour accompagner votre foi, au quotidien comme dans les grands moments.
            </p>
            <div className="footer-social d-flex fs-5 mb-3">
              <a href="#" aria-label="Instagram"><FaInstagram /></a>
              <a href="#" aria-label="TikTok"><FaTiktok /></a>
              <a href="#" aria-label="Facebook"><FaFacebook /></a>
              <a href="#" aria-label="YouTube"><FaYoutube /></a>
            </div>
            <p className="font-script fs-4 mb-0">Chaque vision mérite de voir le jour</p>
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
              <li>support@monarmoire.store</li>
            </ul>
          </div>

          <div className="col-6 col-lg-2">
            <h6 className="text-uppercase small tracking-wide mb-3" style={{ opacity: 0.6 }}>Légal</h6>
            <ul className="list-unstyled small d-flex flex-column gap-2">
              <li>Conditions générales</li>
              <li>Politique de confidentialité</li>
              <li>+225 07 99 16 73 93</li>
            </ul>
          </div>
        </div>

        <div className="d-flex flex-wrap justify-content-between gap-2 small pt-4 mt-4" style={{ borderTop: '1px solid rgba(253,251,247,0.15)', opacity: 0.75 }}>
          <span>© 2026 Mon Armoire. Tous droits réservés.</span>
          <span>Abidjan, Côte d'Ivoire</span>
        </div>
      </div>
    </footer>
  );
}
