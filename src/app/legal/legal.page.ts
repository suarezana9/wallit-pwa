import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthStore } from '../core/auth-store';
import { TranslatePipe } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import { LEGAL } from './legal.config';
import { LegalDoc, legalText } from './legal.content';

/** Privacidad y Términos: se ven con o sin sesión (Google pide que estén publicadas). */
@Component({
  selector: 'app-legal',
  imports: [IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, RouterLink, TranslatePipe],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="back()" [text]="''" />
        </ion-buttons>
        <ion-title>{{ text().title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <article class="legal">
        <h1>{{ text().title }}</h1>
        <p class="intro">{{ text().intro }}</p>
        @for (section of text().sections; track section.title) {
          <section>
            <h2>{{ section.title }}</h2>
            @for (paragraph of section.body; track $index) {
              @if (paragraph.startsWith('• ')) {
                <p class="item">{{ paragraph.slice(2) }}</p>
              } @else {
                <p>{{ paragraph }}</p>
              }
            }
          </section>
        }
        <p class="updated">{{ 'legalUpdated' | t: updated() }}</p>
        <nav class="other">
          @if (doc() === 'privacy') {
            <a routerLink="/terminos">{{ 'termsLink' | t }} →</a>
          } @else {
            <a routerLink="/privacidad">{{ 'privacyLink' | t }} →</a>
          }
        </nav>
      </article>
    </ion-content>
  `,
  styles: `
    .legal { max-width: 720px; margin: 0 auto; padding: 8px 20px 64px; line-height: 1.6; }
    h1 { margin: 8px 0 8px; font-size: 28px; letter-spacing: -0.02em; }
    .intro { margin: 0 0 8px; font-size: 17px; color: var(--wl-muted); }
    h2 { margin: 28px 0 8px; font-size: 18px; }
    p { margin: 0 0 10px; font-size: 16px; }
    .item { position: relative; padding-left: 18px; }
    .item::before { content: '•'; position: absolute; left: 4px; color: var(--ion-color-primary); }
    .updated { margin-top: 32px; font-size: 14px; color: var(--wl-muted); }
    .other a { font-weight: 600; color: var(--ion-color-primary); text-decoration: none; }
  `,
})
export class LegalPage {
  private readonly route = inject(ActivatedRoute);
  private readonly preferences = inject(PreferencesStore);
  private readonly auth = inject(AuthStore);

  readonly doc = computed<LegalDoc>(() => (this.route.snapshot.data['doc'] === 'terms' ? 'terms' : 'privacy'));
  readonly text = computed(() => legalText(this.doc(), this.preferences.language()));
  readonly back = computed(() => (this.auth.isLoggedIn() ? '/cuenta' : '/login'));
  readonly updated = computed(() => {
    const [y, m, d] = LEGAL.updated.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.preferences.locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  });
}
