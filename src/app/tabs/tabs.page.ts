import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { homeOutline, listOutline, personCircleOutline } from 'ionicons/icons';
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
        <ion-tab-button tab="cuenta">
          <ion-icon name="person-circle-outline" aria-hidden="true" />
          <ion-label>{{ 'navAccount' | t }}</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  constructor() {
    addIcons({ homeOutline, listOutline, personCircleOutline });
  }
}
