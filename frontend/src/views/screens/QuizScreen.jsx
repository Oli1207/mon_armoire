import { useState } from 'react';
import { Link } from 'react-router-dom';

const QUESTIONS = [
  {
    question: 'Pour qui cherchez-vous un bijou ?',
    options: [
      { label: 'Pour moi-même', scores: { chaines: 1, medailles: 1 } },
      { label: 'Pour offrir à quelqu\'un', scores: { bracelets: 1, 'bibles-livres': 1 } },
    ],
  },
  {
    question: 'À quelle occasion ?',
    options: [
      { label: 'Un geste au quotidien', scores: { chaines: 2 } },
      { label: 'Un baptême ou une communion', scores: { bracelets: 2, 'bibles-livres': 1 } },
      { label: 'Un moment de prière', scores: { chapelets: 2 } },
      { label: 'Une protection, une bénédiction', scores: { medailles: 2 } },
    ],
  },
  {
    question: 'Quel style vous correspond ?',
    options: [
      { label: 'Discret et épuré', scores: { chaines: 1, medailles: 1 } },
      { label: 'Symbolique et affirmé', scores: { chapelets: 1, 'bibles-livres': 1 } },
      { label: 'Personnalisable, unique', scores: { bracelets: 2 } },
    ],
  },
];

const RESULTS = {
  chaines:        { name: 'Chaînes', slug: 'chaines', description: "Une chaîne fine et élégante, à porter tous les jours." },
  bracelets:      { name: 'Bracelets', slug: 'bracelets', description: "Un bracelet délicat, personnalisable pour un cadeau unique." },
  chapelets:      { name: 'Chapelets', slug: 'chapelets', description: "Un chapelet pour accompagner vos temps de prière." },
  medailles:      { name: 'Médailles', slug: 'medailles', description: "Une médaille protectrice, à garder toujours près de soi." },
  'bibles-livres': { name: 'Bibles & Livres', slug: 'bibles-livres', description: "Un livre pour nourrir la foi et l'inspiration au quotidien." },
};

export default function QuizScreen() {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState({});

  const answer = (optionScores) => {
    const next = { ...scores };
    Object.entries(optionScores).forEach(([key, value]) => {
      next[key] = (next[key] || 0) + value;
    });
    setScores(next);
    setStep((s) => s + 1);
  };

  const restart = () => {
    setStep(0);
    setScores({});
  };

  const finished = step >= QUESTIONS.length;
  const topSlug = finished
    ? Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'chaines'
    : null;
  const result = topSlug ? RESULTS[topSlug] : null;

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Trouvez votre bijou</p>
        <h1 className="h1 mb-3">Quel objet choisir ?</h1>
        <p className="text-muted mx-auto" style={{ maxWidth: 480 }}>
          Répondez à 3 questions pour découvrir le bijou qui vous correspond.
        </p>
      </div>

      <div className="container py-5" style={{ maxWidth: 620 }}>
        {!finished ? (
          <div>
            <p className="text-uppercase small tracking-wide text-gold mb-2">
              Question {step + 1} / {QUESTIONS.length}
            </p>
            <h2 className="h4 mb-4">{QUESTIONS[step].question}</h2>
            <div className="d-flex flex-column gap-2">
              {QUESTIONS[step].options.map((opt) => (
                <button
                  key={opt.label}
                  className="btn btn-outline-primary text-start py-3 px-4"
                  onClick={() => answer(opt.scores)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-uppercase small tracking-wide text-gold mb-2">Notre recommandation</p>
            <h2 className="h2 mb-3">{result.name}</h2>
            <p className="text-muted mb-4">{result.description}</p>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <Link to={`/catalogue?category=${result.slug}`} className="btn btn-primary px-4 py-2 text-uppercase small tracking-wide">
                Découvrir la sélection
              </Link>
              <button className="btn btn-outline-primary px-4 py-2 text-uppercase small tracking-wide" onClick={restart}>
                Recommencer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
