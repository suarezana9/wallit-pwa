import type { Json } from '../core/database.types';

/** Claves de users.notif_config (compartido con la app móvil). Las que faltan valen como activadas. */
export type NotifPref = 'gasto_grupo' | 'pagos' | 'presupuesto' | 'deudas';

export const NOTIF_PREFS: readonly NotifPref[] = ['gasto_grupo', 'pagos', 'presupuesto', 'deudas'];

export function readPref(config: Json | null | undefined, pref: NotifPref): boolean {
  const value = config && typeof config === 'object' && !Array.isArray(config) ? config[pref] : undefined;
  return typeof value === 'boolean' ? value : true;
}

/** Cambia una preferencia sin pisar las de la app móvil (sin_actividad, inicio_mes, etc.). */
export function withPref(config: Json | null | undefined, pref: NotifPref, value: boolean): Record<string, Json | undefined> {
  const base = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  return { ...base, [pref]: value };
}

export type PushStatus = 'unconfigured' | 'dev' | 'unsupported' | 'install-ios' | 'denied' | 'off' | 'on';

export interface PushEnvironment {
  hasKey: boolean;
  swEnabled: boolean;
  hasNotificationApi: boolean;
  isIos: boolean;
  isStandalone: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}

/** Qué mostrar en la pantalla según el navegador. En iPhone, Web Push solo funciona con la app instalada (iOS 16.4+). */
export function pushStatus(env: PushEnvironment): PushStatus {
  if (!env.hasKey) return 'unconfigured';
  if (env.isIos && !env.isStandalone) return 'install-ios';
  if (!env.swEnabled) return env.hasNotificationApi ? 'dev' : 'unsupported';
  if (!env.hasNotificationApi) return 'unsupported';
  if (env.permission === 'denied') return 'denied';
  return env.subscribed && env.permission === 'granted' ? 'on' : 'off';
}
