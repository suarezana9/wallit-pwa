import { Component, computed, inject, output, signal } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonModal, IonSpinner,
  IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { GroupsStore } from './groups-store';

export type GroupDialogMode = 'create' | 'join';

@Component({
  selector: 'app-group-dialog',
  imports: [
    IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonModal, IonSpinner,
    IonTitle, IonToolbar, TranslatePipe,
  ],
  template: `
    <ion-modal class="wl-dialog wl-dialog-sm" [isOpen]="mode() !== null" (didDismiss)="close()">
      <ng-template>
        <div class="ion-page">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ (mode() === 'join' ? 'joinGroup' : 'createGroup') | t }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="close()" [attr.aria-label]="'close' | t">
                  <ion-icon slot="icon-only" name="close-outline" />
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            <form id="group-form" (submit)="submit($event)" novalidate>
              <p class="intro">{{ (mode() === 'join' ? 'joinGroupText' : 'createGroupText') | t }}</p>
              <div class="wl-field">
                <span class="wl-field-label" aria-hidden="true">{{ (mode() === 'join' ? 'inviteCode' : 'groupName') | t }}</span>
                <ion-input
                  class="wl-input"
                  [class.has-error]="!!error()"
                  [attr.aria-label]="(mode() === 'join' ? 'inviteCode' : 'groupName') | t"
                  [placeholder]="(mode() === 'join' ? 'inviteCodePlaceholder' : 'groupNamePlaceholder') | t"
                  [autocapitalize]="mode() === 'join' ? 'off' : 'sentences'"
                  [maxlength]="mode() === 'join' ? 32 : 60"
                  [value]="value()"
                  (ionInput)="onInput($event.detail.value)"
                />
                @if (error(); as message) {
                  <p class="wl-field-error" role="alert">{{ message }}</p>
                }
              </div>
            </form>
          </ion-content>
          <ion-footer class="ion-no-border">
            <div class="actions">
              <ion-button class="wl-btn wl-btn-primary" type="submit" form="group-form" expand="block" [disabled]="busy()">
                @if (busy()) {
                  <ion-spinner name="crescent" />
                } @else {
                  {{ submitLabel() }}
                }
              </ion-button>
            </div>
          </ion-footer>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .intro { margin: 0 0 18px; color: var(--wl-muted); font-size: 14px; line-height: 1.45; }
    ion-footer { border-top: 1px solid var(--wl-field-border); }
    .actions { padding: 12px 16px calc(12px + var(--ion-safe-area-bottom, 0px)); }
  `,
})
export class GroupDialogComponent {
  private readonly groups = inject(GroupsStore);
  private readonly i18n = inject(I18n);
  private readonly toasts = inject(ToastController);

  readonly done = output<string>();

  readonly mode = signal<GroupDialogMode | null>(null);
  readonly value = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly submitLabel = computed(() => this.i18n.t(this.mode() === 'join' ? 'join' : 'createGroup'));

  constructor() {
    addIcons({ closeOutline });
  }

  open(mode: GroupDialogMode, value = ''): void {
    this.value.set(value);
    this.error.set(null);
    this.mode.set(mode);
  }

  close(): void {
    this.mode.set(null);
  }

  onInput(value: string | null | undefined): void {
    this.value.set(value ?? '');
    this.error.set(null);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    const mode = this.mode();
    const value = this.value().trim();
    if (!value) {
      this.error.set(this.i18n.t(mode === 'join' ? 'errCode' : 'errGroupName'));
      return;
    }
    this.busy.set(true);
    const result = mode === 'join' ? await this.groups.join(value) : await this.groups.create(value);
    this.busy.set(false);
    if (result.error || !result.id) {
      this.error.set(result.error ?? this.i18n.t('errLeaveGroup'));
      return;
    }
    this.close();
    const name = this.groups.list().find((g) => g.group.id === result.id)?.group.name ?? value;
    const message = mode === 'join' ? this.i18n.t('joinedGroup', name) : this.i18n.t('groupCreated');
    const toast = await this.toasts.create({ message, duration: 2200, position: 'top', color: 'dark' });
    await toast.present();
    this.done.emit(result.id);
  }
}
