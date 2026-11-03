import { Component, inject, signal } from '@angular/core';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonSpinner, IonTitle, IonToolbar, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, imageOutline, textOutline } from 'ionicons/icons';
import type { Grupo } from '../core/database.types';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { AvatarComponent } from '../shared/avatar.component';
import { GroupsStore } from './groups-store';
import { spaceColor } from './space-color';

/** Emojis pensados para los grupos típicos: casa, pareja, viajes, amigos, trabajo, mascotas. */
export const GROUP_EMOJIS = [
  '🏠', '❤️', '👨‍👩‍👧', '✈️', '🏖️', '⛰️', '🎉', '🍕',
  '🍻', '⚽', '🚗', '💼', '🎓', '🐶', '🐱', '🎁',
] as const;

/** Elegir el avatar de un grupo: un emoji, una foto o la inicial. Solo lo abre un admin. */
@Component({
  selector: 'app-group-avatar-picker',
  imports: [AvatarComponent, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonSpinner, IonTitle, IonToolbar, TranslatePipe],
  template: `
    <ion-modal class="wl-dialog wl-dialog-sm wl-dialog-avatar" [isOpen]="!!group()" (didDismiss)="group.set(null)">
      <ng-template>
        <div class="ion-page">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ 'groupAvatar' | t }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="group.set(null)" [attr.aria-label]="'close' | t">
                  <ion-icon slot="icon-only" name="close-outline" />
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            @if (group(); as g) {
              <div class="preview">
                <app-avatar [url]="g.avatar_url" [emoji]="g.avatar_emoji" [name]="g.name" [color]="color(g.id)" [size]="80" shape="rounded" />
                @if (busy()) {
                  <ion-spinner name="crescent" />
                }
              </div>
              <p class="hint">{{ 'groupAvatarHint' | t }}</p>

              <div class="emojis" role="radiogroup" [attr.aria-label]="'groupAvatar' | t">
                @for (emoji of emojis; track emoji) {
                  <button
                    type="button"
                    role="radio"
                    class="emoji"
                    [class.selected]="!g.avatar_url && g.avatar_emoji === emoji"
                    [attr.aria-checked]="!g.avatar_url && g.avatar_emoji === emoji"
                    [disabled]="busy()"
                    (click)="save({ emoji })"
                  >
                    {{ emoji }}
                  </button>
                }
              </div>

              <div class="actions">
                <label class="action" [class.disabled]="busy()">
                  <ion-icon name="image-outline" aria-hidden="true" />
                  {{ 'uploadPhoto' | t }}
                  <input type="file" accept="image/*" [disabled]="busy()" (change)="onFile($event)" />
                </label>
                <button type="button" class="action" [class.selected]="!g.avatar_url && !g.avatar_emoji" [disabled]="busy()" (click)="save(null)">
                  <ion-icon name="text-outline" aria-hidden="true" />
                  {{ 'useInitial' | t }}
                </button>
              </div>
            }
          </ion-content>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .preview { position: relative; display: flex; justify-content: center; align-items: center; gap: 12px; margin: 6px 0 10px; }
    .preview ion-spinner { position: absolute; }
    .hint { margin: 0 0 16px; text-align: center; font-size: 14px; color: var(--wl-muted); }
    .emojis { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
    .emoji {
      aspect-ratio: 1; display: grid; place-items: center; padding: 0; font-size: 24px; cursor: pointer;
      border-radius: 14px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .emoji:hover:not(:disabled) { border-color: rgba(var(--ion-color-primary-rgb), 0.5); }
    .emoji.selected, .action.selected { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.12); }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
    .action {
      position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; height: 48px;
      font: inherit; font-size: 15px; font-weight: 600; color: inherit; cursor: pointer;
      border-radius: 14px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .action ion-icon { font-size: 19px; color: var(--ion-color-primary); }
    .action input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .action.disabled, .action:disabled { opacity: 0.5; pointer-events: none; }
    @media (max-width: 420px) { .emojis { gap: 6px; } .emoji { font-size: 21px; border-radius: 12px; } }
  `,
})
export class GroupAvatarPickerComponent {
  private readonly groups = inject(GroupsStore);
  private readonly i18n = inject(I18n);
  private readonly toasts = inject(ToastController);

  readonly group = signal<Grupo | null>(null);
  readonly busy = signal(false);
  readonly emojis = GROUP_EMOJIS;
  readonly color = spaceColor;

  constructor() {
    addIcons({ closeOutline, imageOutline, textOutline });
  }

  open(group: Grupo): void {
    this.group.set(group);
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.save({ file });
  }

  async save(avatar: { emoji: string } | { file: Blob } | null): Promise<void> {
    const group = this.group();
    if (!group || this.busy()) return;
    this.busy.set(true);
    const error = await this.groups.setAvatar(group.id, avatar);
    this.busy.set(false);
    if (error) {
      const toast = await this.toasts.create({ message: error, duration: 2600, position: 'top', color: 'danger' });
      await toast.present();
      return;
    }
    this.group.set(null);
    const toast = await this.toasts.create({ message: this.i18n.t('avatarSaved'), duration: 1600, position: 'top', color: 'dark' });
    await toast.present();
  }
}
