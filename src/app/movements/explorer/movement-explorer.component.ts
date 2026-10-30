import { Component, computed, effect, inject, input, output, resource, signal } from '@angular/core';
import { IonButton, IonIcon, IonModal, IonSkeletonText } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline, close, closeCircle, downloadOutline, optionsOutline, searchOutline } from 'ionicons/icons';
import { AuthStore } from '../../core/auth-store';
import { parseIsoDate, toIsoDate } from '../../core/dates';
import type { Movimiento, TipoMovimiento } from '../../core/database.types';
import { I18n, TranslatePipe, TranslationKey } from '../../core/i18n/i18n';
import { MoneyPipe } from '../../core/money';
import { PreferencesStore } from '../../core/preferences-store';
import { Supabase } from '../../core/supabase';
import type { GroupMember } from '../../groups/groups-store';
import { MonthNavComponent } from '../../shared/month-nav.component';
import { CategoryBreakdownComponent } from '../category-breakdown.component';
import { MovementListComponent } from '../movement-list.component';
import { MovementsStore } from '../movements-store';
import { CategoriesStore } from '../../categories/categories-store';
import { CARD_PAYMENT_TYPE, MOVEMENT_TYPES, PAYMENT_METHODS, TypeInfo, typeInfo } from '../movement.model';
import {
  ALL, DateRange, EMPTY_FILTERS, ExplorerFilters, PeriodPreset, activeFilterCount, applyDateEdge, applyFilters, groupByDay,
  isFiltered, normalizeRange, presetRange, spendingByPerson, toSheetRows,
} from './explorer.model';

export const MEMBER_COLORS = ['#6c47ff', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#ef4444'];

interface StatTile {
  type: TypeInfo;
  total: number;
  count: number;
}

interface ActiveChip {
  key: 'person' | 'category' | 'payment' | 'range';
  label: string;
}

/**
 * Pantalla de movimientos: período (el mismo mes que Inicio), totales que filtran por tipo, buscador,
 * filtros en una hoja aparte y la lista por día. Lo que no se usa siempre (fechas a medida, categoría,
 * persona, medio de pago, exportar) no ocupa lugar hasta que hace falta.
 */
@Component({
  selector: 'app-movement-explorer',
  templateUrl: 'movement-explorer.component.html',
  styleUrls: ['movement-explorer.component.scss'],
  imports: [
    CategoryBreakdownComponent, IonButton, IonIcon, IonModal, IonSkeletonText, MoneyPipe, MonthNavComponent,
    MovementListComponent, TranslatePipe,
  ],
})
export class MovementExplorerComponent {
  readonly groupId = input<string | null>(null);
  readonly members = input<readonly GroupMember[]>([]);
  readonly fileName = input('wallit');

  readonly selected = output<Movimiento>();
  readonly removed = output<string>();

  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);
  private readonly categories = inject(CategoriesStore);
  /** El mes es el mismo que en Inicio: si allá pasaste a noviembre, acá también. */
  readonly month = inject(MovementsStore);

  /** Rango a medida (desde el filtro). null = el mes elegido arriba. */
  readonly customRange = signal<DateRange | null>(null);
  readonly filters = signal<ExplorerFilters>(EMPTY_FILTERS);
  readonly sheetOpen = signal(false);
  /** En pantallas anchas los filtros abren como diálogo; en el celular, como hoja desde abajo. */
  readonly wide = typeof matchMedia === 'function' && matchMedia('(min-width: 768px)').matches;

  readonly range = computed(() => {
    const custom = this.customRange();
    if (custom) return normalizeRange(custom);
    const { from, to } = this.month.range();
    return { from, to };
  });

  readonly rangeLabel = computed(() => {
    const locale = this.preferences.locale();
    const { from, to } = this.range();
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    const fmt = (iso: string, withYear: boolean) =>
      parseIsoDate(iso)
        .toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
        .replace(/ de /g, ' ');
    return `${fmt(from, !sameYear)} – ${fmt(to, true)}`;
  });

  readonly data = resource({
    params: () => {
      const userId = this.auth.user()?.id;
      if (!userId) return undefined;
      return { userId, groupId: this.groupId(), ...this.range() };
    },
    loader: async ({ params }): Promise<Movimiento[]> => {
      const base = this.supabase.from('expenses').select('*');
      const scoped = params.groupId
        ? base.eq('group_id', params.groupId)
        : base.eq('user_id', params.userId).is('group_id', null);
      const { data, error } = await scoped
        .gte('date', params.from)
        .lte('date', params.to)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data;
    },
  });

  readonly all = computed(() => (this.data.hasValue() ? this.data.value() : []));
  readonly isGroup = computed(() => !!this.groupId());

  readonly names = computed<Record<string, string>>(() =>
    Object.fromEntries(this.members().map((m) => [m.userId, m.name])),
  );

  private readonly filterContext = computed(() => {
    const names = this.names();
    return { categoryName: (n: string) => this.i18n.category(n), authorName: (id: string) => names[id] ?? '' };
  });

  /** Todo menos el tipo: así los totales de arriba no se vacían cuando tocás uno. */
  private readonly withoutType = computed(() =>
    applyFilters(this.all(), { ...this.filters(), type: ALL }, this.filterContext()),
  );

  readonly filtered = computed(() => {
    const type = this.filters().type;
    const list = this.withoutType();
    return type === ALL ? list : list.filter((m) => m.tipo === type);
  });

  readonly stats = computed<StatTile[]>(() => {
    const list = this.withoutType();
    const tile = (type: TypeInfo): StatTile => {
      const items = list.filter((m) => m.tipo === type.id);
      return { type, total: items.reduce((sum, m) => sum + Number(m.amount), 0), count: items.length };
    };
    const tiles = MOVEMENT_TYPES.map(tile);
    const card = tile(CARD_PAYMENT_TYPE);
    return card.count ? [...tiles, card] : tiles;
  });

  readonly days = computed(() => groupByDay(this.filtered()));
  readonly people = computed(() => spendingByPerson(this.filtered()));
  readonly hasFilters = computed(() => isFiltered(this.filters()) || this.customRange() !== null);
  readonly filterCount = computed(() => activeFilterCount(this.filters(), this.customRange() !== null));

  readonly typeOptions = computed(() => [
    { value: ALL, label: this.i18n.t('filterAll') },
    ...this.stats().map((s) => ({ value: s.type.id as string, label: this.i18n.t(s.type.pluralKey) })),
  ]);

  readonly categoryOptions = computed(() => {
    const used = [...new Set(this.all().filter((m) => m.tipo === 'gasto').map((m) => m.category))];
    return used
      .map((name) => this.categories.info(name))
      .map((c) => ({ value: c.name, emoji: c.emoji, label: this.i18n.category(c.name) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly paymentOptions = PAYMENT_METHODS;
  readonly presets: { id: PeriodPreset; label: TranslationKey }[] = [
    { id: 'thisMonth', label: 'presetThisMonth' },
    { id: 'lastMonth', label: 'presetLastMonth' },
    { id: 'last3', label: 'presetLast3' },
    { id: 'thisYear', label: 'presetThisYear' },
  ];

  readonly activePreset = computed<PeriodPreset | 'custom'>(() => {
    const custom = this.customRange();
    const today = new Date();
    if (!custom) {
      const offset = this.month.monthOffset();
      return offset === 0 ? 'thisMonth' : offset === -1 ? 'lastMonth' : 'custom';
    }
    for (const id of ['last3', 'thisYear'] as const) {
      const r = presetRange(id, today) as DateRange;
      if (r.from === custom.from && r.to === custom.to) return id;
    }
    return 'custom';
  });

  /** Filtros elegidos, como chips que se pueden quitar de a uno. */
  readonly activeChips = computed<ActiveChip[]>(() => {
    const f = this.filters();
    const chips: ActiveChip[] = [];
    if (f.category !== ALL) {
      const c = this.categories.info(f.category);
      chips.push({ key: 'category', label: `${c.emoji} ${this.i18n.category(c.name)}` });
    }
    if (f.person !== ALL) chips.push({ key: 'person', label: this.names()[f.person] ?? '—' });
    if (f.payment !== ALL) {
      const p = PAYMENT_METHODS.find((o) => o.id === f.payment);
      if (p) chips.push({ key: 'payment', label: `${p.emoji} ${this.i18n.t(p.labelKey)}` });
    }
    return chips;
  });

  readonly colorOf = computed(() => {
    const colors: Record<string, string> = {};
    this.members().forEach((m, i) => (colors[m.userId] = MEMBER_COLORS[i % MEMBER_COLORS.length]));
    return colors;
  });

  readonly typeName = (id: TipoMovimiento) => this.i18n.t(typeInfo(id).labelKey);

  constructor() {
    addIcons({ calendarOutline, close, closeCircle, downloadOutline, optionsOutline, searchOutline });

    effect((onCleanup) => {
      const groupId = this.groupId();
      if (!groupId) return;
      const channel = this.supabase
        .channel(`explorer-${groupId}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () =>
          this.data.reload(),
        )
        .subscribe();
      onCleanup(() => void this.supabase.removeChannel(channel));
    });
  }

  reload(): void {
    this.data.reload();
  }

  patch(change: Partial<ExplorerFilters>): void {
    this.filters.update((f) => ({ ...f, ...change }));
  }

  /** Tocar un total filtra por ese tipo; tocarlo de nuevo vuelve a "todos". */
  toggleType(type: TipoMovimiento): void {
    this.patch({ type: this.filters().type === type ? ALL : type });
  }

  /** En la hoja de filtros: tocar la opción elegida la deselecciona. */
  pick(key: 'type' | 'category' | 'person' | 'payment', value: string): void {
    const current = this.filters()[key];
    this.patch({ [key]: current === value && value !== ALL ? ALL : value } as Partial<ExplorerFilters>);
  }

  removeChip(key: ActiveChip['key']): void {
    if (key === 'range') this.customRange.set(null);
    else this.patch({ [key]: ALL });
  }

  applyPreset(id: PeriodPreset): void {
    const result = presetRange(id, new Date());
    if ('monthOffset' in result) {
      this.customRange.set(null);
      this.month.monthOffset.set(result.monthOffset);
    } else {
      this.customRange.set(result);
    }
  }

  /**
   * Cambia "Desde" o "Hasta" sin que se crucen: si elegís un Desde posterior al Hasta, el Hasta se mueve
   * a esa misma fecha (y al revés). Una fecha incompleta o fuera de rango se descarta y el campo vuelve al valor anterior.
   */
  setDate(edge: 'from' | 'to', field: HTMLInputElement): void {
    const current = this.range();
    const next = applyDateEdge(current, edge, field.value);
    if (!next) {
      field.value = current[edge];
      return;
    }
    this.customRange.set(next);
  }

  clearFilters(): void {
    this.filters.set(EMPTY_FILTERS);
    this.customRange.set(null);
  }

  dayLabel(iso: string): string {
    const today = toIsoDate(new Date());
    const yesterday = toIsoDate(new Date(Date.now() - 86_400_000));
    if (iso === today) return this.i18n.t('today');
    if (iso === yesterday) return this.i18n.t('yesterday');
    const date = parseIsoDate(iso);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString(this.preferences.locale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  }

  readonly exporting = signal(false);

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const es = this.preferences.language() === 'es';
      const names = this.names();
      const rows = toSheetRows(this.filtered(), {
        columns: {
          date: this.i18n.t('date'),
          type: this.i18n.t('csvType'),
          category: this.i18n.t('category'),
          description: this.i18n.t('description'),
          amount: `${this.i18n.t('amount')} (${this.preferences.currency()})`,
          person: this.isGroup() ? this.i18n.t('person') : null,
          private: this.isGroup() ? this.i18n.t('privateExpense') : null,
        },
        dateFormat: es ? 'dd/mm/yyyy' : 'mm/dd/yyyy',
        yes: this.i18n.t('yes'),
        typeName: (tipo) => this.i18n.t(typeInfo(tipo).labelKey),
        categoryName: (n) => this.i18n.category(n),
        authorName: (id) => names[id] ?? '',
      });
      const { default: writeExcelFile } = await import('write-excel-file/universal');
      const widths = [12, 12, 18, 36, 16, 20, 14].slice(0, rows[0].length).map((width) => ({ width }));
      const blob = await writeExcelFile(rows, { columns: widths, sheet: this.i18n.t('navMovements'), stickyRowsCount: 1 }).toBlob();
      const { from, to } = this.range();
      this.download(blob, `${this.fileName()}_${from}_${to}.xlsx`);
    } finally {
      this.exporting.set(false);
    }
  }

  private download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name.replace(/[\\/:*?"<>|]/g, '-');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
