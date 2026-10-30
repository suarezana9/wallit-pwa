import { Component, inject } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  homeOutline, listOutline, peopleOutline, personCircleOutline, pieChartOutline, swapHorizontalOutline,
} from 'ionicons/icons';
import { GroupsStore } from '../groups/groups-store';
import { TranslatePipe } from '../core/i18n/i18n';

@Component({
  selector: 'app-tabs',
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs, TranslatePipe],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="ion-hide-lg-up">
        <ion-tab-button tab="inicio">
          <ion-icon name="home-outline" aria-hidden="true" />
          <ion-label>{{ 'navHome' | t }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="movimientos">
          <ion-icon name="list-outline" aria-hidden="true" />
          <ion-label>{{ 'navMovements' | t }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="presupuestos">
          <ion-icon name="pie-chart-outline" aria-hidden="true" />
          <ion-label>{{ 'navBudgets' | t }}</ion-label>
        </ion-tab-button>
        <!-- En un grupo, esta pestaña lleva a sus cuentas; en Personal, a la lista de grupos. -->
        @if (groups.activeGroupId(); as groupId) {
          <ion-tab-button [tab]="'grupos/' + groupId">
            <ion-icon name="swap-horizontal-outline" aria-hidden="true" />
            <ion-label>{{ 'navAccounts' | t }}</ion-label>
          </ion-tab-button>
        } @else {
          <ion-tab-button tab="grupos">
            <ion-icon name="people-outline" aria-hidden="true" />
            <ion-label>{{ 'navGroups' | t }}</ion-label>
          </ion-tab-button>
        }
        <ion-tab-button tab="cuenta">
          <ion-icon name="person-circle-outline" aria-hidden="true" />
          <ion-label>{{ 'navAccount' | t }}</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  readonly groups = inject(GroupsStore);

  constructor() {
    addIcons({ homeOutline, listOutline, peopleOutline, personCircleOutline, pieChartOutline, swapHorizontalOutline });
  }
}
