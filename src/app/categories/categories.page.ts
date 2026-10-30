import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonTitle, IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, trashOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { CATEGORIES } from '../movements/movement.model';
import { CategoriesStore } from './categories-store';
import { COLOR_CHOICES, CustomCategory, EMOJI_CHOICES } from './category-config';

@Component({
  selector: 'app-categories',
  templateUrl: 'categories.page.html',
  styleUrls: ['categories.page.scss'],
  imports: [
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonTitle, IonToolbar,
    TranslatePipe,
  ],
})
export class CategoriesPage {
  readonly store = inject(CategoriesStore);
  readonly i18n = inject(I18n);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly builtin = CATEGORIES;
  readonly emojis = EMOJI_CHOICES;
  readonly colors = COLOR_CHOICES;

  readonly activeCount = computed(() => this.builtin.filter((c) => !this.store.hidden().has(c.name)).length);
  readonly allActive = computed(() => this.activeCount() === this.builtin.length);

  readonly name = signal('');
  readonly emoji = signal(EMOJI_CHOICES[0]);
  readonly color = signal(COLOR_CHOICES[6]);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
    addIcons({ add, trashOutline });
  }

  async toggle(name: string): Promise<void> {
    await this.result(await this.store.toggleHidden(name));
  }

  async toggleAll(): Promise<void> {
    await this.result(await this.store.setHidden(this.allActive() ? this.builtin.map((c) => c.name) : []));
  }

  async addCustom(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.name().trim();
    if (!name) {
      this.error.set(this.i18n.t('errCategoryName'));
      return;
    }
    if (this.store.isTaken(name)) {
      this.error.set(this.i18n.t('errCategoryExists'));
      return;
    }
    this.saving.set(true);
    const ok = await this.store.addCustom({ nombre: name, emoji: this.emoji(), color: this.color() });
    this.saving.set(false);
    if (!ok) {
      this.error.set(this.i18n.t('errSaveCategories'));
      return;
    }
    this.name.set('');
    this.error.set(null);
  }

  async confirmRemove(category: CustomCategory): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('deleteCategoryConfirm', category.nombre),
      message: this.i18n.t('deleteCategoryText'),
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        {
          text: this.i18n.t('delete'),
          role: 'destructive',
          handler: () => void this.store.removeCustom(category.id).then((ok) => this.result(ok)),
        },
      ],
    });
    await alert.present();
  }

  onName(value: string | null | undefined): void {
    this.name.set(value ?? '');
    this.error.set(null);
  }

  private async result(ok: boolean): Promise<void> {
    if (ok) return;
    const toast = await this.toasts.create({
      message: this.i18n.t('errSaveCategories'),
      color: 'danger',
      duration: 2200,
      position: 'top',
    });
    await toast.present();
  }
}
