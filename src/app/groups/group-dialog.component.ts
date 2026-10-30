import { Component, computed, inject, output, signal } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonModal, IonSpinner,
  IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { airplaneOutline, closeOutline, homeOutline } from 'ionicons/icons';
import type { TipoGrupo } from '../core/database.types';
import { I18n, TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import { GroupsStore } from './groups-store';

export type GroupDialogMode = 'create' | 'join';

@Component({
  selector: 'app-group-dialog',
  imports: [
    IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonModal, IonSpinner,
    IonTitle, IonToolbar, TranslatePipe,
  ],
  template: `
    <ion-modal class="wl-dialog wl-dialog-sm" [class.wl-dialog-md]="mode() === 'create'" [isOpen]="mode() !== null" (didDismiss)="close()">
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
              @if (mode() === 'create') {
                <div class="wl-field kind">
                  <span class="wl-field-label">{{ 'groupKind' | t }}</span>
                  <div class="kinds" role="radiogroup" [attr.aria-label]="'groupKind' | t">
                    @for (option of kinds; track option.id) {
                      <button
                        type="button"
                        role="radio"
                        class="kind-option"
                        [class.selected]="tipo() === option.id"
                        [attr.aria-checked]="tipo() === option.id"
                        (click)="tipo.set(option.id)"
                      >
                        <ion-icon [name]="option.icon" aria-hidden="true" />
                        <span class="kind-title">{{ option.title | t }}</span>
                        <span class="kind-hint">{{ option.hint | t }}</span>
                      </button>
                    }
                  </div>
                </div>
                @if (tipo() === 'viaje') {
                  <div class="dates">
                    <label class="wl-field">
                      <span class="wl-field-label">{{ 'tripFrom' | t }}</span>
                      <input class="date-input" type="date" [value]="from()" (input)="from.set($any($event.target).value)" />
                    </label>
                    <label class="wl-field">
                      <span class="wl-field-label">{{ 'tripTo' | t }}</span>
                      <input class="date-input" type="date" [min]="from()" [value]="to()" (input)="to.set($any($event.target).value)" />
                    </label>
                  </div>
                  <p class="hint">{{ 'tripDatesHint' | t }}</p>
                }
              }
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
    .kind { margin-top: 18px; }
    .kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .kind-option {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px; border-radius: 14px;
      font: inherit; text-align: left; color: inherit; cursor: pointer;
      background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .kind-option ion-icon { font-size: 20px; margin-bottom: 4px; color: var(--wl-muted); }
    .kind-option.selected { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.08); }
    .kind-option.selected ion-icon { color: var(--ion-color-primary); }
    .kind-title { font-size: 14px; font-weight: 700; }
    .kind-hint { font-size: 12px; color: var(--wl-muted); }
    .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
    .date-input {
      height: 46px; padding: 0 12px; border-radius: 12px; font: inherit; color: inherit;
      background: var(--wl-field-bg); border: 1px solid var(--wl-field-border); outline: none;
    }
    .date-input:focus { border-color: var(--ion-color-primary); }
    .hint { margin: 8px 0 0; font-size: 12px; color: var(--wl-muted); }
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
  readonly tipo = signal<TipoGrupo>('hogar');
  readonly from = signal('');
  readonly to = signal('');
  readonly kinds: { id: TipoGrupo; icon: string; title: TranslationKey; hint: TranslationKey }[] = [
    { id: 'hogar', icon: 'home-outline', title: 'kindHome', hint: 'kindHomeHint' },
    { id: 'viaje', icon: 'airplane-outline', title: 'kindTrip', hint: 'kindTripHint' },
  ];
  readonly submitLabel = computed(() => this.i18n.t(this.mode() === 'join' ? 'join' : 'createGroup'));

  constructor() {
    addIcons({ airplaneOutline, closeOutline, homeOutline });
  }

  open(mode: GroupDialogMode, value = ''): void {
    this.value.set(value);
    this.tipo.set('hogar');
    this.from.set('');
    this.to.set('');
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
    const trip = this.tipo() === 'viaje';
    if (mode === 'create' && trip && this.from() && this.to() && this.to() < this.from()) {
      this.error.set(this.i18n.t('errTripDates'));
      return;
    }
    this.busy.set(true);
    const result =
      mode === 'join'
        ? await this.groups.join(value)
        : await this.groups.create(value, {
            tipo: this.tipo(),
            fecha_inicio: trip ? this.from() || null : null,
            fecha_fin: trip ? this.to() || null : null,
          });
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
