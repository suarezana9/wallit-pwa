import { Component, inject } from '@angular/core';
import { IonApp, IonMenu, IonRouterOutlet, IonSplitPane } from '@ionic/angular';
import { AuthStore } from './core/auth-store';
import { PreferencesStore } from './core/preferences-store';
import { SidebarComponent } from './shared/sidebar.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonMenu, IonRouterOutlet, IonSplitPane, SidebarComponent],
})
export class AppComponent {
  readonly auth = inject(AuthStore);
  readonly preferences = inject(PreferencesStore);
}
