import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AuthStore } from '../core/auth-store';
import { safeRedirect } from '../core/auth.guards';
import { TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import { markIntroSeen } from '../core/intro';
import { WallitLogoComponent } from '../shared/wallit-logo';

interface Slide {
  id: 'ai' | 'local' | 'groups' | 'insights';
  title: TranslationKey;
  text: TranslationKey;
}

/**
 * Bienvenida: cuatro pantallas que se deslizan (con el dedo o con "Siguiente") y cuentan qué hace Wallit
 * antes de pedir que te registres. Se ve una sola vez por dispositivo.
 * Las ilustraciones son HTML y CSS (pedacitos de la propia app), así pesan nada y respetan el modo oscuro.
 */
@Component({
  selector: 'app-intro',
  imports: [IonContent, TranslatePipe, WallitLogoComponent],
  templateUrl: 'intro.page.html',
  styleUrls: ['intro.page.scss'],
})
export class IntroPage {
  private readonly router = inject(Router);
  private readonly redirect = safeRedirect(inject(ActivatedRoute).snapshot.queryParamMap.get('redirect'));
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  /** Con sesión iniciada (abierta desde Cuenta) no tiene sentido mandar al login: vuelve a la app. */
  readonly loggedIn = inject(AuthStore).isLoggedIn;

  readonly slides: Slide[] = [
    { id: 'ai', title: 'introAiTitle', text: 'introAiText' },
    { id: 'local', title: 'introLocalTitle', text: 'introLocalText' },
    { id: 'groups', title: 'introGroupsTitle', text: 'introGroupsText' },
    { id: 'insights', title: 'introInsightsTitle', text: 'introInsightsText' },
  ];

  readonly index = signal(0);
  readonly isLast = computed(() => this.index() === this.slides.length - 1);

  /** El índice sale del scroll, así funciona igual deslizando con el dedo que con los botones. */
  onScroll(): void {
    const el = this.track().nativeElement;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== this.index()) this.index.set(Math.min(Math.max(i, 0), this.slides.length - 1));
  }

  goTo(i: number): void {
    const el = this.track().nativeElement;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    this.index.set(i);
  }

  next(): void {
    if (this.isLast()) void this.finish();
    else this.goTo(this.index() + 1);
  }

  async finish(mode: 'signup' | 'login' = 'signup'): Promise<void> {
    markIntroSeen();
    if (this.loggedIn()) {
      await this.router.navigateByUrl('/cuenta', { replaceUrl: true });
      return;
    }
    await this.router.navigate(['/login'], {
      replaceUrl: true,
      queryParams: { ...(this.redirect ? { redirect: this.redirect } : {}), ...(mode === 'login' ? { modo: 'login' } : {}) },
    });
  }
}
