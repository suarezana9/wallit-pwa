import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel,
  IonList, IonListHeader, IonNote, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { ExpenseStore } from '../services/expense-store';
import { AuthStore } from '../core/auth-store';
import { ProfileStore } from '../core/profile-store';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CurrencyPipe, DatePipe, IonButton, IonButtons, IonContent, IonHeader, IonIcon,
    IonItem, IonLabel, IonList, IonListHeader, IonNote, IonTitle, IonToolbar,
  ],
})
export class HomePage {
  private readonly expenseStore = inject(ExpenseStore);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly profileStore = inject(ProfileStore);

  readonly expenses = this.expenseStore.expenses;
  readonly total = this.expenseStore.total;
  readonly displayName = this.profileStore.displayName;
  readonly profile = this.profileStore.profile;

  constructor() {
    addIcons({ logOutOutline });
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
