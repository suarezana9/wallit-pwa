import { Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { IonIcon, IonSkeletonText } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addCircleOutline, createOutline, logInOutline, logOutOutline, swapHorizontalOutline, trashOutline,
} from 'ionicons/icons';
import { relativeDate } from '../core/dates';
import type { Actividad, TipoActividad } from '../core/database.types';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { Supabase } from '../core/supabase';
import { MEMBER_COLORS } from '../movements/explorer/movement-explorer.component';
import { typeInfo } from '../movements/movement.model';
import { groupByLocalDay, relativeTime } from './activity.model';
import type { GroupMember } from './groups-store';

const LIMIT = 60;

const ICONS: Record<TipoActividad, string> = {
  gasto_nuevo: 'add-circle-outline',
  gasto_editado: 'create-outline',
  gasto_borrado: 'trash-outline',
  pago: 'swap-horizontal-outline',
  pago_borrado: 'trash-outline',
  miembro_entro: 'log-in-outline',
  miembro_salio: 'log-out-outline',
};

interface FeedItem {
  id: string;
  kind: TipoActividad;
  icon: string;
  color: string;
  initial: string;
  text: string;
  amount: number | null;
  previous: number | null;
  struck: boolean;
  time: string;
}

/** Qué pasó en el grupo: la tabla group_activity la llenan triggers de la base y llega en vivo por Realtime. */
@Component({
  selector: 'app-group-activity',
  imports: [IonIcon, IonSkeletonText, MoneyPipe, TranslatePipe],
  template: `
    <section class="wl-panel">
      @if (feed.isLoading() && !feed.hasValue()) {
        @for (row of [1, 2, 3, 4]; track row) {
          <ion-skeleton-text [animated]="true" class="skeleton" />
        }
      } @else if (!days().length) {
        <p class="empty">{{ 'activityEmpty' | t }}</p>
      } @else {
        @for (day of days(); track day.day) {
          <h3 class="day">{{ day.label }}</h3>
          <ul>
            @for (item of day.items; track item.id) {
              <li>
                <span class="avatar" [style.background]="item.color" aria-hidden="true">
                  {{ item.initial }}
                  <span class="badge" [class]="'badge ' + item.kind"><ion-icon [name]="item.icon" /></span>
                </span>
                <span class="text">
                  <span class="line">{{ item.text }}</span>
                  <span class="time">{{ item.time }}</span>
                </span>
                @if (item.amount !== null) {
                  <span class="amount" [class.struck]="item.struck">
                    {{ item.amount | money }}
                    @if (item.previous !== null) {
                      <span class="previous">{{ 'activityBefore' | t }} {{ item.previous | money }}</span>
                    }
                  </span>
                }
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: `
    .skeleton { height: 44px; margin: 8px 0; border-radius: 12px; }
    .empty { margin: 8px 0; color: var(--wl-muted); }
    .day { margin: 16px 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--wl-muted); }
    .day:first-child { margin-top: 0; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--wl-field-border); }
    li:last-child { border-bottom: 0; }
    .avatar {
      position: relative; flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
      font-size: 14px; font-weight: 700; color: #fff;
    }
    .badge {
      position: absolute; right: -4px; bottom: -4px; width: 18px; height: 18px; border-radius: 50%;
      display: grid; place-items: center; font-size: 11px; color: #fff; background: var(--ion-color-primary);
      border: 2px solid var(--ion-background-color, #fff);
    }
    .badge.gasto_borrado, .badge.pago_borrado, .badge.miembro_salio { background: #9ca3af; }
    .badge.pago { background: var(--wl-type-ingreso); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .line { font-size: 14px; line-height: 1.35; }
    .time { font-size: 12px; color: var(--wl-muted); }
    .amount { flex: none; display: flex; flex-direction: column; align-items: flex-end; font-weight: 700; font-variant-numeric: tabular-nums; }
    .amount.struck { text-decoration: line-through; color: var(--wl-muted); }
    .previous { font-size: 11px; font-weight: 500; color: var(--wl-muted); }
  `,
})
export class GroupActivityComponent {
  readonly groupId = input.required<string>();
  readonly members = input<readonly GroupMember[]>([]);

  private readonly supabase = inject(Supabase).client;
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);

  /** Se refresca cada minuto para que "hace 5 min" no quede viejo. */
  private readonly now = signal(new Date());

  readonly feed = resource({
    params: () => this.groupId(),
    loader: async ({ params: groupId }): Promise<Actividad[]> => {
      const { data, error } = await this.supabase
        .from('group_activity')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data;
    },
  });

  // En el feed van los nombres reales ("Ana agregó…"), también para vos: "Vos agregó" suena mal.
  private readonly people = computed(
    () => new Map(this.members().map((m, i) => [m.userId, { name: m.name, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }])),
  );

  readonly days = computed(() => {
    const list = this.feed.hasValue() ? this.feed.value() : [];
    const now = this.now();
    const locale = this.preferences.locale();
    return groupByLocalDay(list).map((group) => ({
      day: group.day,
      label: relativeDate(group.day, now, locale, { today: this.i18n.t('today'), yesterday: this.i18n.t('yesterday') }),
      items: group.items.map((item) => this.toItem(item, now, locale)),
    }));
  });

  constructor() {
    addIcons({ addCircleOutline, createOutline, logInOutline, logOutOutline, swapHorizontalOutline, trashOutline });

    effect((onCleanup) => {
      const groupId = this.groupId();
      const channel = this.supabase
        .channel(`actividad-${groupId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_activity', filter: `group_id=eq.${groupId}` }, (payload) =>
          this.feed.update((list) => [payload.new as Actividad, ...(list ?? [])].slice(0, LIMIT)),
        )
        .subscribe();
      const timer = setInterval(() => this.now.set(new Date()), 60_000);
      onCleanup(() => {
        clearInterval(timer);
        void this.supabase.removeChannel(channel);
      });
    });
  }

  /** Recarga a mano (por ejemplo, después de guardar algo desde esta misma pantalla). */
  reload(): void {
    this.feed.reload();
  }

  private name(userId: string | null | undefined, fallback?: string): string {
    if (!userId) return fallback || this.i18n.t('formerMember');
    return this.people().get(userId)?.name ?? (fallback || this.i18n.t('formerMember'));
  }

  private toItem(item: Actividad, now: Date, locale: string): FeedItem {
    const data = item.data ?? {};
    const actor = this.name(item.actor, data.actor_name);
    const what = data.descripcion?.trim()
      || (data.tipo && data.tipo !== 'gasto' ? this.i18n.t(typeInfo(data.tipo).labelKey) : this.i18n.category(data.categoria ?? 'Otros'));
    const text = (() => {
      switch (item.kind) {
        case 'gasto_nuevo': return this.i18n.t('activityAdded', actor, what);
        case 'gasto_editado': return this.i18n.t('activityEdited', actor, what);
        case 'gasto_borrado': return this.i18n.t('activityDeleted', actor, what);
        case 'pago': return this.i18n.t('activityPaid', this.name(data.de), this.name(data.para));
        case 'pago_borrado': return this.i18n.t('activityPaymentDeleted', actor, this.name(data.de), this.name(data.para));
        case 'miembro_entro': return this.i18n.t('activityJoined', actor);
        case 'miembro_salio': return this.i18n.t('activityLeft', actor);
      }
    })();
    const amount = typeof data.monto === 'number' || typeof data.monto === 'string' ? Number(data.monto) : null;
    const previous = item.kind === 'gasto_editado' && data.monto_anterior != null && Number(data.monto_anterior) !== amount
      ? Number(data.monto_anterior)
      : null;
    return {
      id: item.id,
      kind: item.kind,
      icon: ICONS[item.kind],
      color: (item.actor && this.people().get(item.actor)?.color) || '#9ca3af',
      initial: actor.charAt(0).toUpperCase(),
      text,
      amount,
      previous,
      struck: item.kind === 'gasto_borrado' || item.kind === 'pago_borrado',
      time: relativeTime(item.created_at, now, locale, this.i18n.t('justNow')),
    };
  }
}

