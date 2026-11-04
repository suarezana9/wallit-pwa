import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonReorder, IonReorderGroup,
  IonTitle, IonToolbar, ItemReorderEventDetail, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, reorderThreeOutline, trashOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { CategoriesStore } from './categories-store';
import { CategoryEntry, COLOR_CHOICES, EMOJI_CHOICES, moveItem } from './category-config';
import { EmojiGridComponent } from './emoji-grid.component';

@Component({
  selector: 'app-categories',
  templateUrl: 'categories.page.html',
  styleUrls: ['categories.page.scss'],
  imports: [
    EmojiGridComponent, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonReorder, IonReorderGroup,
    IonTitle, IonToolbar,
    TranslatePipe,
  ],
})
export class CategoriesPage {
  readonly store = inject(CategoriesStore);
  readonly i18n = inject(I18n);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly colors = COLOR_CHOICES;

  readonly activeCount = computed(() => this.store.all().filter((c) => !c.hidden).length);
  readonly allActive = computed(() => this.store.all().every((c) => !c.hidden));

  readonly name = signal('');
  readonly emoji = signal(EMOJI_CHOICES[0]);
  readonly color = signal(COLOR_CHOICES[6]);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
    addIcons({ add, reorderThreeOutline, trashOutline });
  }

  /** Arrastrar: Ionic mueve el elemento en pantalla y acá se guarda el orden nuevo. */
  async onReorder(event: CustomEvent<ItemReorderEventDetail>): Promise<void> {
    const { from, to } = event.detail;
    // complete() sin lista: Ionic termina la animación; el @for se redibuja con el orden del store.
    event.detail.complete();
    if (from === to) return;
    const names = moveItem(this.store.all().map((c) => c.name), from, to);
    await this.result(await this.store.setOrder(names));
  }

  async resetOrder(): Promise<void> {
    await this.result(await this.store.resetOrder());
  }

  async toggle(name: string): Promise<void> {
    await this.result(await this.store.toggleHidden(name));
  }

  async toggleAll(): Promise<void> {
    await this.result(await this.store.setHidden(this.allActive() ? this.store.all().map((c) => c.name) : []));
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

  label(category: CategoryEntry): string {
    return category.custom ? category.name : this.i18n.category(category.name);
  }

  async restoreBuiltins(): Promise<void> {
    await this.result(await this.store.restoreBuiltins());
  }

  async confirmRemove(category: CategoryEntry): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('deleteCategoryConfirm', this.label(category)),
      message: this.i18n.t(category.custom ? 'deleteCategoryText' : 'deleteBuiltinText'),
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        {
          text: this.i18n.t('delete'),
          role: 'destructive',
          handler: () => void this.store.remove(category).then((ok) => this.result(ok)),
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
