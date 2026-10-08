import { Component } from 'react';

/** Évite l'écran blanc : message simple et bouton pour recharger. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container py-5 text-center" role="alert">
        <h1 className="h3 mb-3">Une erreur est survenue</h1>
        <p className="text-muted mb-4">La page n'a pas pu s'afficher. Vérifiez votre connexion, puis réessayez.</p>
        <button type="button" className="btn btn-primary pager-btn px-4" onClick={() => window.location.reload()}>
          Recharger la page
        </button>
      </div>
    );
  }
}
