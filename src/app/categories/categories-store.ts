import { Service, computed, inject, resource } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import type { Json } from '../core/database.types';
import { Supabase } from '../core/supabase';
import { CATEGORIES, type CategoryInfo } from '../movements/movement.model';
import {
  CategoryConfig, CustomCategory, EMPTY_CONFIG, colorFor, lookupCategory, nameTaken, parseConfig, visibleCategories,
} from './category-config';

@Service()
export class CategoriesStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);

  readonly configResource = resource({
    params: () => this.auth.user()?.id,
    loader: async ({ params: userId }): Promise<CategoryConfig> => {
      const { data, error } = await this.supabase.from('users').select('categoria_config').eq('id', userId).single();
      if (error) throw error;
      return parseConfig(data.categoria_config);
    },
  });

  readonly config = computed(() => (this.configResource.hasValue() ? this.configResource.value() : EMPTY_CONFIG));
  readonly visible = computed(() => visibleCategories(this.config()));
  readonly hidden = computed(() => new Set(this.config().ocultas));
  readonly custom = computed(() => this.config().personalizadas);

  info(name: string): CategoryInfo {
    return lookupCategory(name, this.config());
  }

  isTaken(name: string): boolean {
    return nameTaken(name, this.config());
  }

  setHidden(names: readonly string[]): Promise<boolean> {
    return this.save({ ...this.config(), ocultas: [...names] });
  }

  toggleHidden(name: string): Promise<boolean> {
    const hidden = new Set(this.config().ocultas);
    if (hidden.has(name)) hidden.delete(name);
    else hidden.add(name);
    return this.setHidden([...hidden]);
  }

  addCustom(category: Omit<CustomCategory, 'id'>): Promise<boolean> {
    const custom: CustomCategory = { ...category, nombre: category.nombre.trim(), id: `custom_${Date.now()}` };
    return this.save({ ...this.config(), personalizadas: [...this.config().personalizadas, custom] });
  }

  /** Categorías predeterminadas que la persona ocultó: aparecen al buscar, por si las quiere volver a usar. */
  readonly hiddenBuiltins = computed(() => CATEGORIES.filter((c) => this.hidden().has(c.name)));

  /** Alta rápida desde el formulario: el color sale del nombre. Devuelve el nombre guardado o null si falló. */
  async quickCreate(name: string, emoji: string): Promise<string | null> {
    const nombre = name.trim().slice(0, 30);
    if (!nombre || this.isTaken(nombre)) return null;
    const ok = await this.addCustom({ nombre, emoji, color: colorFor(nombre) });
    return ok ? nombre : null;
  }

  async unhide(name: string): Promise<boolean> {
    return this.hidden().has(name) ? this.toggleHidden(name) : true;
  }

  removeCustom(id: string): Promise<boolean> {
    return this.save({ ...this.config(), personalizadas: this.config().personalizadas.filter((c) => c.id !== id) });
  }

  /** Actualización optimista: se ve al instante y vuelve atrás si falla. */
  private async save(next: CategoryConfig): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    const previous = this.config();
    this.configResource.set(next);
    const { error } = await this.supabase
      .from('users')
      .update({ categoria_config: next as unknown as Json })
      .eq('id', userId);
    if (error) {
      this.configResource.set(previous);
      return false;
    }
    return true;
  }
}
