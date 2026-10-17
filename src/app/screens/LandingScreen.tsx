/** What a signed-out visitor sees: what CheMrster is, the plans, and the way in. */
import { PricingTable, SignInButton, SignUpButton } from '@clerk/react';
import { BoardIcon, ChainIcon, ChartIcon, MapIcon, PathIcon, TutorIcon } from '../components/Icons.tsx';
import { MoleculeView } from '../components/MoleculeView.tsx';

const FEATURES = [
  { icon: PathIcon, title: 'Trilha do zero ao herói', text: 'Vinte lições curtas, do carbono às biomoléculas, com teoria antes da prática e questões novas a cada vez.' },
  { icon: ChainIcon, title: 'Estruturas como na prova', text: 'Cada molécula é desenhada como nos cadernos do ENEM: mesmo traço, mesma fonte, mesmas convenções.' },
  { icon: TutorIcon, title: 'Tutor com IA', text: 'Explica o seu erro, dá dicas sem entregar a resposta e confere a química no mesmo motor que corrige as questões.' },
  { icon: ChartIcon, title: 'Revisão espaçada', text: 'Cada lição volta na hora certa, e o progresso mostra o que você domina e o que está esquecendo.' },
  { icon: MapIcon, title: 'Mapa de conceitos', text: 'Um caderno infinito para ligar funções, reações e estruturas com setas, como num esquema de reação.' },
  { icon: BoardIcon, title: 'Quadro de estudos', text: 'Organize a semana até a prova; o tutor monta o plano com você.' },
];

export function LandingScreen() {
  return (
    <div className="landing">
      <header className="landing-bar">
        <span className="wordmark">CheMrster</span>
        <SignInButton mode="modal">
          <button type="button" className="btn btn--quiet">
            Entrar
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className="btn btn--primary">
            Criar conta
          </button>
        </SignUpButton>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-text">
            <p className="landing-kicker">Química orgânica para o ENEM</p>
            <h1>Aprenda a ler a prova antes de chegar nela.</h1>
            <p className="landing-lead">
              Lições curtas como um jogo, estruturas desenhadas como no caderno impresso e um tutor que conhece cada questão que você errou.
            </p>
            <div className="landing-cta">
              <SignUpButton mode="modal">
                <button type="button" className="btn btn--primary">
                  Começar de graça
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button type="button" className="btn">
                  Já tenho conta
                </button>
              </SignInButton>
            </div>
          </div>
          <figure className="landing-specimen paper" aria-label="Aspirina, desenhada como no ENEM">
            <MoleculeView smiles="CC(=O)Oc1ccccc1C(=O)O" size={46} caption="ácido acetilsalicílico" />
          </figure>
        </section>

        <section className="landing-features" aria-label="O que tem no CheMrster">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="landing-feature">
              <Icon />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="landing-pricing" aria-labelledby="landing-plans">
          <h2 id="landing-plans">Planos</h2>
          <p className="landing-lead">A trilha inteira é grátis. O Pro dá muito mais conversa com o tutor de IA, todo dia.</p>
          <PricingTable newSubscriptionRedirectUrl="/#/planos" />
        </section>
      </main>

      <footer className="landing-foot">
        <span>CheMrster</span>
        <span>Seu progresso fica salvo na sua conta, em qualquer aparelho.</span>
      </footer>
    </div>
  );
}
