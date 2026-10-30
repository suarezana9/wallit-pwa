import { Component, computed, inject, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { airplaneOutline, archiveOutline, flagOutline } from 'ionicons/icons';
import { toIsoDate, parseIsoDate } from '../core/dates';
import type { Grupo, Movimiento } from '../core/database.types';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { CategoriesStore } from '../categories/categories-store';
import { formatTripRange, tripStatus, tripSummary } from './trip.model';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Resumen de un grupo de tipo viaje: total, por persona, por día y, al terminar, la invitación a archivarlo. */
@Component({
  selector: 'app-trip-summary',
  imports: [IonButton, IonIcon, MoneyPipe, TranslatePipe],
  template: `
    <section class="trip">
      <header>
        <span class="icon" aria-hidden="true"><ion-icon name="airplane-outline" /></span>
        <div class="title">
          <h2>{{ 'tripSummary' | t }}</h2>
          @if (range()) {
            <span>{{ range() }}</span>
          }
        </div>
        <span class="status" [class]="'status ' + status()">{{ statusLabel() }}</span>
      </header>

      <div class="stats">
        <div><span>{{ 'tripTotal' | t }}</span><strong>{{ summary().total | money }}</strong></div>
        <div><span>{{ 'tripPerPerson' | t }}</span><strong>{{ summary().perPerson | money }}</strong></div>
        <div><span>{{ 'tripPerDay' | t }}</span><strong>{{ summary().perDay | money }}</strong></div>
        <div><span>{{ 'tripDays' | t }}</span><strong>{{ summary().days }}</strong></div>
      </div>

      @if (categories().length) {
        <div class="cats">
          @for (cat of categories(); track cat.name) {
            <span class="cat">{{ cat.emoji }} {{ cat.label }} · {{ cat.total | money }}</span>
          }
        </div>
      }

      @if (status() === 'ended' && !group().archivado && isAdmin()) {
        <div class="ended">
          <ion-icon name="flag-outline" aria-hidden="true" />
          <p>{{ (pendingDebts() ? 'tripEndedPending' : 'tripEndedReady') | t }}</p>
          @if (!pendingDebts()) {
            <ion-button class="wl-btn" size="small" (click)="archive.emit()">
              <ion-icon slot="start" name="archive-outline" />
              {{ 'archiveTrip' | t }}
            </ion-button>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .trip {
      display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; border-radius: 20px;
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(108, 71, 255, 0.08));
      border: 1px solid rgba(14, 165, 233, 0.25);
    }
    header { display: flex; align-items: center; gap: 12px; }
    .icon { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-size: 20px; color: #fff; background: #0ea5e9; }
    .title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    h2 { margin: 0; font-size: 17px; }
    .title span { font-size: 13px; color: var(--wl-muted); }
    .status { flex: none; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--wl-field-bg); color: var(--wl-muted); }
    .status.ongoing { color: #0369a1; background: rgba(14, 165, 233, 0.15); }
    .status.ended { color: var(--wl-muted); }
    .status.upcoming { color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.12); }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    @media (max-width: 600px) { .stats { grid-template-columns: repeat(2, 1fr); } }
    .stats div { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 14px; background: var(--ion-background-color, #fff); }
    .stats span { font-size: 12px; color: var(--wl-muted); }
    .stats strong { font-size: 17px; font-variant-numeric: tabular-nums; }
    .cats { display: flex; flex-wrap: wrap; gap: 6px; }
    .cat { padding: 5px 10px; border-radius: 999px; font-size: 13px; background: var(--ion-background-color, #fff); }
    .ended { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: var(--ion-background-color, #fff); }
    .ended ion-icon { flex: none; font-size: 20px; color: #0ea5e9; }
    .ended p { flex: 1; margin: 0; font-size: 14px; }
  `,
})
export class TripSummaryComponent {
  readonly group = input.required<Grupo>();
  readonly movements = input<readonly Movimiento[]>([]);
  readonly memberCount = input(0);
  readonly pendingDebts = input(false);
  readonly isAdmin = input(false);
  readonly archive = output<void>();

  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);
  private readonly categoriesStore = inject(CategoriesStore);

  private readonly today = toIsoDate(new Date());

  readonly summary = computed(() => tripSummary(this.movements(), this.memberCount(), this.group()));
  readonly status = computed(() => tripStatus(this.group(), this.today));
  readonly range = computed(() =>
    formatTripRange(this.group().fecha_inicio, this.group().fecha_fin, this.preferences.locale(), this.i18n.t('since')),
  );

  readonly statusLabel = computed(() => {
    const { fecha_inicio: from, fecha_fin: to } = this.group();
    const days = (a: string, b: string) => Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / DAY_MS);
    switch (this.status()) {
      case 'upcoming':
        return this.i18n.t('tripStartsIn', String(days(this.today, from!)));
      case 'ongoing':
        return from && to
          ? this.i18n.t('tripDayOf', String(days(from, this.today) + 1), String(days(from, to) + 1))
          : this.i18n.t('tripOngoing');
      case 'ended':
        return this.i18n.t('tripEnded');
      default:
        return this.i18n.t('tripLabel');
    }
  });

  readonly categories = computed(() =>
    this.summary().topCategories.map((c) => {
      const info = this.categoriesStore.info(c.name);
      return { ...c, emoji: info.emoji, label: this.i18n.category(info.name) };
    }),
  );

  constructor() {
    addIcons({ airplaneOutline, archiveOutline, flagOutline });
  }
}
