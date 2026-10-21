import { Component, computed, inject, signal, viewChild } from '@angular/core';
import {
  IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher,
  IonRefresherContent, IonSkeletonText, IonTitle, IonToolbar, RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import type { TipoMovimiento } from '../core/database.types';
import { add } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MonthNavComponent } from '../shared/month-nav.component';
import { ChipOption, ChipPickerComponent } from './chip-picker.component';
import { MovementEditorComponent } from './movement-editor.component';
import { MovementListComponent } from './movement-list.component';
import { MOVEMENT_TYPES, typeInfo } from './movement.model';
import { MovementsStore } from './movements-store';

@Component({
  selector: 'app-movements',
  templateUrl: 'movements.page.html',
  styleUrls: ['movements.page.scss'],
  imports: [
    ChipPickerComponent, IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon,
    IonRefresher, IonRefresherContent, IonSkeletonText, IonTitle, IonToolbar, MonthNavComponent,
    MovementEditorComponent, MovementListComponent, TranslatePipe,
  ],
})
export class MovementsPage {
  readonly store = inject(MovementsStore);
  private readonly i18n = inject(I18n);
  readonly editor = viewChild.required(MovementEditorComponent);

  readonly filter = signal('todos');

  readonly filterOptions = computed<ChipOption[]>(() => {
    const list = this.store.list();
    return [
      { value: 'todos', label: `${this.i18n.t('filterAll')} · ${list.length}` },
      ...MOVEMENT_TYPES.map((t) => ({
        value: t.id,
        label: `${this.i18n.t(t.pluralKey)} · ${list.filter((m) => m.tipo === t.id).length}`,
      })),
    ];
  });

  readonly filtered = computed(() => {
    const filter = this.filter();
    const list = this.store.list();
    return filter === 'todos' ? list : list.filter((m) => m.tipo === filter);
  });

  readonly emptyTitle = computed(() => {
    const filter = this.filter();
    if (filter === 'todos') return this.i18n.t('emptyMonth');
    const plural = this.i18n.t(typeInfo(filter as TipoMovimiento).pluralKey);
    return this.i18n.t('noneOfType', plural.toLowerCase());
  });

  constructor() {
    addIcons({ add });
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    this.store.movements.reload();
    await event.target.complete();
  }
}
