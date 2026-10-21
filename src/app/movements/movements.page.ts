import { Component, computed, inject, signal, viewChild } from '@angular/core';
import {
  IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher,
  IonRefresherContent, IonSkeletonText, IonTitle, IonToolbar, RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
import { MonthNavComponent } from '../shared/month-nav.component';
import { ChipOption, ChipPickerComponent } from './chip-picker.component';
import { MovementEditorComponent } from './movement-editor.component';
import { MovementListComponent } from './movement-list.component';
import { MOVEMENT_TYPES } from './movement.model';
import { MovementsStore } from './movements-store';

const PLURALS: Record<string, string> = {
  gasto: 'Gastos',
  ingreso: 'Ingresos',
  ahorro: 'Ahorros',
  inversion: 'Inversiones',
};

@Component({
  selector: 'app-movements',
  templateUrl: 'movements.page.html',
  styleUrls: ['movements.page.scss'],
  imports: [
    ChipPickerComponent, IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon,
    IonRefresher, IonRefresherContent, IonSkeletonText, IonTitle, IonToolbar, MonthNavComponent,
    MovementEditorComponent, MovementListComponent,
  ],
})
export class MovementsPage {
  readonly store = inject(MovementsStore);
  readonly editor = viewChild.required(MovementEditorComponent);

  readonly filter = signal('todos');

  readonly filterOptions = computed<ChipOption[]>(() => {
    const list = this.store.list();
    return [
      { value: 'todos', label: `Todos · ${list.length}` },
      ...MOVEMENT_TYPES.map((t) => ({
        value: t.id,
        label: `${PLURALS[t.id]} · ${list.filter((m) => m.tipo === t.id).length}`,
      })),
    ];
  });

  readonly filtered = computed(() => {
    const filter = this.filter();
    const list = this.store.list();
    return filter === 'todos' ? list : list.filter((m) => m.tipo === filter);
  });

  readonly emptyTitle = computed(() =>
    this.filter() === 'todos'
      ? 'Todavía no hay movimientos este mes'
      : `No hay ${PLURALS[this.filter()].toLowerCase()} este mes`,
  );

  constructor() {
    addIcons({ add });
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    this.store.movements.reload();
    await event.target.complete();
  }
}
