import { Component, computed, effect, inject, input, output, resource, signal } from '@angular/core';
import {
  IonButton, IonIcon, IonSelect, IonSelectOption, IonSkeletonText, SelectCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline, closeCircle, downloadOutline, searchOutline } from 'ionicons/icons';
import { AuthStore } from '../../core/auth-store';
import { monthRange, parseIsoDate, toIsoDate } from '../../core/dates';
import type { Movimiento, TipoMovimiento } from '../../core/database.types';
import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { MoneyPipe } from '../../core/money';
import { PreferencesStore } from '../../core/preferences-store';
import { Supabase } from '../../core/supabase';
import type { GroupMember } from '../../groups/groups-store';
import { CategoryBreakdownComponent } from '../category-breakdown.component';
import { ChipOption, ChipPickerComponent } from '../chip-picker.component';
import { MovementListComponent } from '../movement-list.component';
import { CategoriesStore } from '../../categories/categories-store';
import { MOVEMENT_TYPES, summarize, typeInfo } from '../movement.model';
import {
  ALL, DateRange, EMPTY_FILTERS, ExplorerFilters, applyFilters, groupByDay, isFiltered, normalizeRange,
  spendingByPerson, toSheetRows,
} from './explorer.model';

export const MEMBER_COLORS = ['#6c47ff', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#ef4444'];

@Component({
  selector: 'app-movement-explorer',
  templateUrl: 'movement-explorer.component.html',
  styleUrls: ['movement-explorer.component.scss'],
  imports: [
    CategoryBreakdownComponent, ChipPickerComponent, IonButton, IonIcon, IonSelect, IonSelectOption,
    IonSkeletonText, MoneyPipe, MovementListComponent, TranslatePipe,
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

  readonly dates = signal<DateRange>(this.defaultRange());
  readonly filters = signal<ExplorerFilters>(EMPTY_FILTERS);

  readonly range = computed(() => normalizeRange(this.dates()));
  readonly isDefaultRange = computed(() => {
    const d = this.defaultRange();
    return this.dates().from === d.from && this.dates().to === d.to;
  });

  readonly periodLabel = computed(() => {
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

  private readonly withoutType = computed(() =>
    applyFilters(this.all(), { ...this.filters(), type: ALL }, this.filterContext()),
  );

  readonly filtered = computed(() => {
    const type = this.filters().type;
    const list = this.withoutType();
    return type === ALL ? list : list.filter((m) => m.tipo === type);
  });

  readonly summary = computed(() => summarize(this.filtered()));
  readonly days = computed(() => groupByDay(this.filtered()));
  readonly people = computed(() => spendingByPerson(this.filtered()));
  readonly hasFilters = computed(() => isFiltered(this.filters()) || !this.isDefaultRange());

  readonly typeOptions = computed<ChipOption[]>(() => {
    const list = this.withoutType();
    return [
      { value: ALL, label: `${this.i18n.t('filterAll')} · ${list.length}` },
      ...MOVEMENT_TYPES.map((t) => ({
        value: t.id,
        label: `${this.i18n.t(t.pluralKey)} · ${list.filter((m) => m.tipo === t.id).length}`,
      })),
    ];
  });

  readonly typeValue = computed(() => this.filters().type as string);

  readonly categoryOptions = computed(() => {
    const used = [...new Set(this.all().filter((m) => m.tipo === 'gasto').map((m) => m.category))];
    return used
      .map((name) => this.categories.info(name))
      .map((c) => ({ value: c.name, label: `${c.emoji} ${this.i18n.category(c.name)}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly colorOf = computed(() => {
    const colors: Record<string, string> = {};
    this.members().forEach((m, i) => (colors[m.userId] = MEMBER_COLORS[i % MEMBER_COLORS.length]));
    return colors;
  });

  constructor() {
    addIcons({ calendarOutline, closeCircle, downloadOutline, searchOutline });

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

  setDate(edge: 'from' | 'to', value: string | null | undefined): void {
    if (!value) return;
    this.dates.update((r) => ({ ...r, [edge]: value }));
  }

  patch(change: Partial<ExplorerFilters>): void {
    this.filters.update((f) => ({ ...f, ...change }));
  }

  onType(value: string): void {
    this.patch({ type: value as TipoMovimiento | typeof ALL });
  }

  onSelect(key: 'person' | 'category', event: SelectCustomEvent<string>): void {
    this.patch({ [key]: event.detail.value ?? ALL });
  }

  clearFilters(): void {
    this.filters.set(EMPTY_FILTERS);
    this.dates.set(this.defaultRange());
  }

  private defaultRange(): DateRange {
    const { from, to } = monthRange(0);
    return { from, to };
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
