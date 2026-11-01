import { Component, computed, inject, viewChild } from '@angular/core';
import {
  IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle,
  IonToolbar, RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
import { TranslatePipe } from '../core/i18n/i18n';
import { ContextSwitcherComponent } from '../groups/context-switcher.component';
import { GroupsStore } from '../groups/groups-store';
import { MovementExplorerComponent } from './explorer/movement-explorer.component';
import { MovementEditorComponent } from './movement-editor.component';

import { FabAutoHideDirective } from '../shared/fab-auto-hide.directive';
@Component({
  selector: 'app-movements',
  templateUrl: 'movements.page.html',
  styleUrls: ['movements.page.scss'],
  imports: [
    FabAutoHideDirective,
    ContextSwitcherComponent, IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher,
    IonRefresherContent, IonTitle, IonToolbar, MovementEditorComponent, MovementExplorerComponent, TranslatePipe,
  ],
})
export class MovementsPage {
  private readonly groups = inject(GroupsStore);
  readonly editor = viewChild.required(MovementEditorComponent);
  readonly explorer = viewChild.required(MovementExplorerComponent);

  readonly activeGroup = computed(() => this.groups.active()?.group ?? null);
  readonly groupId = this.groups.activeGroupId;
  readonly members = computed(() => (this.groups.activeMembers.hasValue() ? this.groups.activeMembers.value() : []));
  readonly fileName = computed(() => `wallit-${this.activeGroup()?.name ?? 'personal'}`);

  constructor() {
    addIcons({ add });
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    this.explorer().reload();
    await event.target.complete();
  }
}
