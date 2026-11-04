import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonModal, IonSpinner, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { AccountService } from './account.service';

/** "Enviar comentarios": un texto libre que queda en la tabla comentarios (con la pantalla y el dispositivo). */
@Component({
  selector: 'app-feedback-dialog',
  imports: [IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonModal, IonSpinner, IonTitle, IonToolbar, TranslatePipe],
  template: `
    <ion-modal class="wl-dialog wl-dialog-sm wl-dialog-feedback" [isOpen]="isOpen()" (didDismiss)="isOpen.set(false)">
      <ng-template>
        <div class="ion-page">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ 'feedbackTitle' | t }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="isOpen.set(false)" [attr.aria-label]="'close' | t">
                  <ion-icon slot="icon-only" name="close-outline" />
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            <p class="intro">{{ 'feedbackIntro' | t }}</p>
            <textarea
              rows="6"
              maxlength="2000"
              [placeholder]="'feedbackPlaceholder' | t"
              [attr.aria-label]="'feedbackTitle' | t"
              [value]="text()"
              (input)="text.set($any($event.target).value)"
            ></textarea>
            <p class="count">{{ text().length }}/2000</p>
          </ion-content>
          <ion-footer class="ion-no-border">
            <div class="actions">
              <ion-button class="wl-btn wl-btn-primary" expand="block" [disabled]="busy() || !text().trim()" (click)="send()">
                @if (busy()) {
                  <ion-spinner name="crescent" />
                } @else {
                  {{ 'feedbackSend' | t }}
                }
              </ion-button>
            </div>
          </ion-footer>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .intro { margin: 0 0 12px; color: var(--wl-muted); line-height: 1.45; }
    textarea {
      width: 100%; padding: 12px 14px; border-radius: 14px; font: inherit; font-size: 16px; line-height: 1.45; resize: vertical;
      color: var(--ion-text-color); background: var(--wl-field-bg); border: 1px solid var(--wl-field-border); outline: none;
    }
    textarea:focus { border-color: var(--ion-color-primary); }
    .count { margin: 6px 0 0; text-align: right; font-size: 13px; color: var(--wl-muted); }
    ion-footer { border-top: 1px solid var(--wl-field-border); }
    .actions { padding: 12px 16px calc(12px + var(--ion-safe-area-bottom, 0px)); }
  `,
})
export class FeedbackDialogComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly toasts = inject(ToastController);

  readonly isOpen = signal(false);
  readonly text = signal('');
  readonly busy = signal(false);

  constructor() {
    addIcons({ closeOutline });
  }

  open(): void {
    this.isOpen.set(true);
  }

  async send(): Promise<void> {
    this.busy.set(true);
    const ok = await this.account.sendFeedback(this.text(), this.router.url);
    this.busy.set(false);
    const toast = await this.toasts.create({
      message: this.i18n.t(ok ? 'feedbackThanks' : 'feedbackError'),
      duration: 2400,
      position: 'top',
      color: ok ? 'dark' : 'danger',
    });
    await toast.present();
    if (ok) {
      this.text.set('');
      this.isOpen.set(false);
    }
  }
}
