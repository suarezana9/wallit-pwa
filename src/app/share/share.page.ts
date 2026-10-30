import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircleOutline, shareSocialOutline, sparkles } from 'ionicons/icons';
import { TranslatePipe } from '../core/i18n/i18n';
import { AiSession } from '../ai/ai-session';
import { imageToJpegDataUrl } from '../ai/media';
import { WallitLogoComponent } from '../shared/wallit-logo';
import { SharedPayload, ShareInbox } from './share-inbox';

type Phase = 'reading' | 'working' | 'failed' | 'empty';

/**
 * Destino de "Compartir con Wallit" (Android, app instalada).
 * Lee lo que dejó el service worker, lo pasa por la IA y abre Inicio con el formulario precargado.
 */
@Component({
  selector: 'app-share',
  imports: [IonButton, IonContent, IonIcon, TranslatePipe, WallitLogoComponent],
  providers: [AiSession],
  template: `
    <ion-content>
      <div class="wrap">
        <div class="card">
          <app-wallit-logo [size]="36" />
          @switch (phase()) {
            @case ('empty') {
              <div class="icon" aria-hidden="true"><ion-icon name="share-social-outline" /></div>
              <h1>{{ 'shareEmptyTitle' | t }}</h1>
              <p>{{ 'shareEmptyText' | t }}</p>
              <ion-button class="wl-btn wl-btn-primary" expand="block" (click)="goHome()">{{ 'shareGoHome' | t }}</ion-button>
            }
            @case ('failed') {
              <div class="icon danger" aria-hidden="true"><ion-icon name="alert-circle-outline" /></div>
              <h1>{{ 'shareFailedTitle' | t }}</h1>
              <p role="alert">{{ session.error() }}</p>
              <ion-button class="wl-btn wl-btn-primary" expand="block" (click)="process()">{{ 'retry' | t }}</ion-button>
              <button type="button" class="later" (click)="manual()">{{ 'shareManual' | t }}</button>
            }
            @default {
              @if (session.preview(); as image) {
                <div class="scan">
                  <img [src]="image" alt="" />
                  <span class="scanline" aria-hidden="true"></span>
                </div>
              } @else {
                <div class="orb" aria-hidden="true"><ion-icon name="sparkles" /></div>
              }
              <h1>{{ 'shareWorkingTitle' | t }}</h1>
              @if (payload()?.text; as text) {
                <p class="quote">“{{ text }}”</p>
              }
              <p role="status">{{ session.busyLabel() || ('aiWait' | t) }}</p>
            }
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px 16px; }
    .card {
      width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 14px;
      padding: 32px 24px; border-radius: 24px; text-align: center; border: 1px solid var(--wl-field-border);
      background:
        radial-gradient(120% 80% at 50% 0%, rgba(var(--ion-color-primary-rgb), 0.14), transparent 70%),
        var(--ion-background-color, #fff);
    }
    h1 { margin: 0; font-size: 20px; font-weight: 700; }
    p { margin: 0; color: var(--wl-muted); }
    .quote {
      max-width: 100%; padding: 10px 14px; border-radius: 12px; font-size: 14px; color: var(--ion-text-color);
      background: var(--wl-field-bg); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    }
    .icon {
      width: 56px; height: 56px; border-radius: 18px; display: grid; place-items: center; font-size: 26px;
      color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.12);
    }
    .icon.danger { color: var(--ion-color-danger); background: rgba(var(--ion-color-danger-rgb), 0.12); }
    .orb {
      width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; color: #fff;
      background: linear-gradient(135deg, var(--ion-color-primary), #ec4899);
      box-shadow: 0 10px 30px rgba(var(--ion-color-primary-rgb), 0.4); animation: pulse 1.6s ease-in-out infinite;
    }
    .scan { position: relative; width: 160px; height: 200px; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18); }
    .scan img { width: 100%; height: 100%; object-fit: cover; }
    .scanline {
      position: absolute; left: 0; right: 0; height: 40%; top: -40%;
      background: linear-gradient(180deg, transparent, rgba(var(--ion-color-primary-rgb), 0.45), transparent);
      animation: scan 1.8s ease-in-out infinite;
    }
    ion-button { width: 100%; margin: 6px 0 0; }
    .later { border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--wl-muted); cursor: pointer; }
    @keyframes scan { to { top: 100%; } }
    @keyframes pulse { 50% { transform: scale(1.06); } }
    @media (prefers-reduced-motion: reduce) { .orb, .scanline { animation: none; } }
  `,
})
export class SharePage {
  readonly session = inject(AiSession);
  private readonly inbox = inject(ShareInbox);
  private readonly router = inject(Router);

  readonly phase = signal<Phase>('reading');
  readonly payload = signal<SharedPayload | null>(null);

  constructor() {
    addIcons({ alertCircleOutline, shareSocialOutline, sparkles });
    this.session.listen((result) => this.open(result));
    void this.start();
  }

  private async start(): Promise<void> {
    const payload = await this.inbox.take().catch(() => null);
    this.payload.set(payload);
    if (!payload) {
      this.phase.set('empty');
      return;
    }
    await this.process();
  }

  async process(): Promise<void> {
    const payload = this.payload();
    if (!payload) return;
    this.phase.set('working');
    const ok = payload.file ? await this.session.fromImage(payload.file) : await this.session.fromText(payload.text);
    if (!ok) this.phase.set('failed');
  }

  /** Si la IA falla, igual abrimos el formulario (con la foto como comprobante si era una imagen). */
  async manual(): Promise<void> {
    const file = this.payload()?.file;
    const receipt = file ? await imageToJpegDataUrl(file).catch(() => undefined) : undefined;
    this.open({ movements: [], receipt });
  }

  goHome(): void {
    void this.router.navigateByUrl('/inicio', { replaceUrl: true });
  }

  private open(result: Parameters<ShareInbox['hand']>[0]): void {
    this.inbox.hand(result);
    this.goHome();
  }
}
