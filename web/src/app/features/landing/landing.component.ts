import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'sc-landing',
  imports: [RouterLink, ButtonModule],
  styles: `
    .sc-hero-glow {
      background:
        radial-gradient(60% 50% at 50% 0%, rgba(212, 246, 58, 0.16), transparent 70%);
    }

    .sc-scoreboard {
      transform: rotate(-1.5deg);
      box-shadow:
        0 0 0 1px rgba(212, 246, 58, 0.25),
        0 0 44px rgba(212, 246, 58, 0.12),
        0 24px 60px rgba(0, 0, 0, 0.55);
    }

    @keyframes sc-points-pop {
      0%,
      55% {
        opacity: 0;
        transform: translateY(8px) scale(0.8);
      }
      70%,
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .sc-points-pop {
      animation: sc-points-pop 2.6s ease-out both;
    }

    .sc-ticket {
      transform: rotate(1.5deg);
      position: relative;
      background: linear-gradient(150deg, var(--sc-pitch-700), var(--sc-pitch-800));
      border: 1px dashed rgba(212, 246, 58, 0.4);
      border-radius: var(--sc-radius);
    }

    .sc-ticket::before,
    .sc-ticket::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--sc-pitch-900);
      border: 1px dashed rgba(212, 246, 58, 0.4);
      top: 50%;
      margin-top: -9px;
    }

    .sc-ticket::before {
      left: -10px;
    }

    .sc-ticket::after {
      right: -10px;
    }

    .sc-code-cell {
      width: 2rem;
      height: 2.5rem;
      display: grid;
      place-items: center;
      border: 1px solid rgba(212, 246, 58, 0.35);
      border-radius: 0.5rem;
      background: var(--sc-pitch-900);
    }

    .sc-step-number {
      font-family: var(--sc-font-display);
      font-size: 2.5rem;
      line-height: 1;
      color: var(--sc-volt-400);
      opacity: 0.9;
    }

    .sc-mini-podium div {
      border-radius: 0.5rem 0.5rem 0 0;
    }
  `,
  template: `
    <div class="min-h-dvh flex flex-col">
      <!-- Barre supérieure -->
      <header class="flex items-center justify-between px-5 py-4 max-w-5xl mx-auto w-full">
        <span class="sc-wordmark text-xl">ScoreChallenge</span>
        @if (store.isLoggedIn()) {
          <a routerLink="/dashboard">
            <p-button label="Mes groupes" size="small" data-testid="landing-dashboard" />
          </a>
        } @else {
          <a routerLink="/login" class="text-sm underline sc-muted" data-testid="landing-login">
            Se connecter
          </a>
        }
      </header>

      <!-- Hero -->
      <section class="sc-hero-glow px-5 pt-10 pb-16">
        <div class="max-w-5xl mx-auto grid gap-10 md:grid-cols-2 md:items-center">
          <div class="flex flex-col gap-5 sc-stagger text-center md:text-left">
            <span class="sc-pill self-center md:self-start">⚽️ Pronostics entre amis</span>
            <h1 class="sc-display text-4xl md:text-5xl leading-tight">
              Vos matchs.<br />
              Vos pronos.<br />
              <span style="color: var(--sc-volt-400)">Un seul champion.</span>
            </h1>
            <p class="sc-muted text-lg">
              Créez votre groupe, invitez vos amis ou collègues avec un simple lien, et laissez
              parler les pronostics. Points et classement calculés automatiquement — fini les
              disputes sur Excel.
            </p>
            <div class="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <a routerLink="/register">
                <p-button
                  label="Créer mon groupe gratuitement"
                  size="large"
                  data-testid="landing-cta"
                />
              </a>
            </div>
            <p class="text-xs sc-muted">
              Seul l’organisateur crée un compte — vos invités rejoignent avec un code, sans
              inscription.
            </p>
          </div>

          <!-- Scoreboard de démonstration -->
          <div class="flex flex-col gap-6 items-center sc-fade-up" aria-hidden="true">
            <div class="sc-scoreboard sc-card-raised p-6 w-full max-w-sm flex flex-col gap-3">
              <div class="flex items-center justify-between text-xs">
                <span class="sc-pill">Terminé</span>
                <span class="sc-muted">CdM 2026 — Open Space</span>
              </div>
              <div class="flex items-center justify-center gap-4">
                <span class="sc-display text-lg flex-1 text-right">France</span>
                <span class="sc-score text-4xl">3 – 2</span>
                <span class="sc-display text-lg flex-1">Brésil</span>
              </div>
              <div class="text-center text-sm sc-muted">
                Ton prono : <strong class="sc-score" style="color: var(--sc-text)">3 – 2</strong>
                <span class="sc-points-pop sc-score ml-2" style="color: var(--sc-volt-400)">
                  +5 pts 🎯
                </span>
              </div>
            </div>

            <div class="sc-ticket p-4 w-full max-w-sm flex items-center justify-between gap-3">
              <div class="flex flex-col gap-1">
                <span class="text-xs uppercase tracking-widest sc-muted">Invitation</span>
                <span class="sc-display text-sm">Marc, entre ton code :</span>
              </div>
              <div class="flex gap-1 sc-score">
                <span class="sc-code-cell">R</span>
                <span class="sc-code-cell">A</span>
                <span class="sc-code-cell">9</span>
                <span class="sc-code-cell">C</span>
                <span class="sc-code-cell">G</span>
                <span class="sc-code-cell">P</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Comment ça marche -->
      <section class="px-5 py-14" style="background: rgba(6, 18, 12, 0.6)">
        <div class="max-w-5xl mx-auto flex flex-col gap-8">
          <h2 class="sc-display text-2xl text-center">Comment ça marche ?</h2>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 sc-stagger">
            <div class="sc-card p-5 flex flex-col gap-2">
              <span class="sc-step-number">1</span>
              <h3 class="sc-display">Créez votre groupe</h3>
              <p class="text-sm sc-muted">
                Un nom, une description, et c’est parti. Amis, collègues, famille — à vous de voir.
              </p>
            </div>
            <div class="sc-card p-5 flex flex-col gap-2">
              <span class="sc-step-number">2</span>
              <h3 class="sc-display">Invitez sans friction</h3>
              <p class="text-sm sc-muted">
                Partagez le lien du groupe et donnez à chacun son code personnel. Aucun compte requis
                pour vos invités.
              </p>
            </div>
            <div class="sc-card p-5 flex flex-col gap-2">
              <span class="sc-step-number">3</span>
              <h3 class="sc-display">Pronostiquez</h3>
              <p class="text-sm sc-muted">
                Chacun donne son score avant la deadline. Une seule modification permise, puis c’est
                verrouillé.
              </p>
            </div>
            <div class="sc-card p-5 flex flex-col gap-2">
              <span class="sc-step-number">4</span>
              <h3 class="sc-display">Le classement tranche</h3>
              <p class="text-sm sc-muted">
                Score final saisi → points calculés et podium mis à jour automatiquement. Place aux
                chambrages.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Bénéfices + mini podium -->
      <section class="px-5 py-14">
        <div class="max-w-5xl mx-auto grid gap-10 md:grid-cols-2 md:items-center">
          <div class="flex items-end justify-center gap-2 sc-mini-podium" aria-hidden="true">
            <div
              class="flex-1 max-w-24 text-center py-4"
              style="background: var(--sc-pitch-700); border-top: 3px solid var(--sc-silver)"
            >
              <div class="text-xl">🥈</div>
              <div class="sc-score text-sm" style="color: var(--sc-silver)">38 pts</div>
            </div>
            <div
              class="flex-1 max-w-28 text-center py-8"
              style="
                background: linear-gradient(180deg, var(--sc-pitch-600), var(--sc-pitch-700));
                border-top: 3px solid var(--sc-gold);
              "
            >
              <div class="text-2xl">🥇</div>
              <div class="sc-score" style="color: var(--sc-gold)">45 pts</div>
            </div>
            <div
              class="flex-1 max-w-24 text-center py-2"
              style="background: var(--sc-pitch-800); border-top: 3px solid var(--sc-bronze)"
            >
              <div class="text-xl">🥉</div>
              <div class="sc-score text-sm" style="color: var(--sc-bronze)">31 pts</div>
            </div>
          </div>

          <div class="flex flex-col gap-4 sc-stagger">
            <h2 class="sc-display text-2xl">Pensé pour la compétition amicale</h2>
            <div class="sc-card p-4">
              <h3 class="sc-display text-sm" style="color: var(--sc-volt-400)">
                🛡 Anti-triche par construction
              </h3>
              <p class="text-sm sc-muted">
                Pronostics cachés jusqu’à la deadline, verrouillage automatique, calculs côté
                serveur. Personne ne peut tricher, pas même l’organisateur.
              </p>
            </div>
            <div class="sc-card p-4">
              <h3 class="sc-display text-sm" style="color: var(--sc-volt-400)">
                ⚡️ Zéro friction pour vos invités
              </h3>
              <p class="text-sm sc-muted">
                Un lien + un code de 6 caractères = dans le jeu en 10 secondes, depuis n’importe quel
                téléphone.
              </p>
            </div>
            <div class="sc-card p-4">
              <h3 class="sc-display text-sm" style="color: var(--sc-volt-400)">
                🎚 Le barème, à votre façon
              </h3>
              <p class="text-sm sc-muted">
                Score exact 5 pts, bon vainqueur 3 pts, bon score d’une équipe 1 pt — par défaut.
                Ajustez les valeurs pour votre groupe.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA final -->
      <section class="px-5 py-16 text-center sc-hero-glow">
        <div class="max-w-xl mx-auto flex flex-col gap-5 items-center">
          <h2 class="sc-display text-3xl">Le coup d’envoi, c’est maintenant.</h2>
          <p class="sc-muted">
            Coupe du monde, CAN, Ligue des Champions ou championnat du dimanche : votre prochain
            concours de pronostics démarre en deux minutes.
          </p>
          <a routerLink="/register">
            <p-button label="Créer mon compte" size="large" data-testid="landing-cta-bottom" />
          </a>
        </div>
      </section>

      <footer class="px-5 py-6 text-center text-xs sc-muted border-t border-white/5">
        ScoreChallenge — la compétition amicale, sans les disputes de comptage.
      </footer>
    </div>
  `,
})
export class LandingComponent {
  readonly store = inject(AuthStore);
}
