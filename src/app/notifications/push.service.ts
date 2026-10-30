import { Service, computed, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../environments/environment';
import { AuthStore } from '../core/auth-store';
import { I18n } from '../core/i18n/i18n';
import { Supabase } from '../core/supabase';
import { NotifPref, pushStatus, readPref, withPref } from './notification.model';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Web Push con el service worker de Angular (SwPush): pide permiso, registra la suscripción en Supabase
 * y guarda qué avisos quiere cada persona. Las notificaciones las manda la función wallit-notificaciones.
 */
@Service()
export class PushService {
  private readonly swPush = inject(SwPush);
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18n);

  private readonly permission = signal<NotificationPermission>(typeof Notification === 'undefined' ? 'denied' : Notification.permission);
  private readonly subscription = toSignal(this.swPush.subscription, { initialValue: null });
  readonly busy = signal(false);

  readonly status = computed(() =>
    pushStatus({
      hasKey: !!environment.vapidPublicKey,
      swEnabled: this.swPush.isEnabled,
      hasNotificationApi: typeof Notification !== 'undefined',
      isIos: isIos(),
      isStandalone: isStandalone(),
      permission: this.permission(),
      subscribed: !!this.subscription(),
    }),
  );

  readonly prefs = resource({
    params: () => this.auth.user()?.id,
    loader: async ({ params: userId }) => {
      const { data, error } = await this.supabase.from('users').select('notif_config').eq('id', userId).single();
      if (error) throw error;
      return data.notif_config;
    },
  });

  wants(pref: NotifPref): boolean {
    return readPref(this.prefs.hasValue() ? this.prefs.value() : null, pref);
  }

  async setPref(pref: NotifPref, value: boolean): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return this.i18n.t('errSessionExpired');
    const previous = this.prefs.hasValue() ? this.prefs.value() : null;
    const next = withPref(previous, pref, value);
    this.prefs.set(next);
    const { error } = await this.supabase.from('users').update({ notif_config: next }).eq('id', userId);
    if (error) {
      this.prefs.set(previous);
      return this.i18n.t('errSaveChanges');
    }
    return null;
  }

  async enable(): Promise<string | null> {
    this.busy.set(true);
    try {
      // Si el servicio de push del navegador no responde, no dejamos el botón girando para siempre.
      const subscription = await Promise.race([
        this.swPush.requestSubscription({ serverPublicKey: environment.vapidPublicKey }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PUSH_TIMEOUT')), 20_000)),
      ]);
      this.permission.set(Notification.permission);
      const { endpoint, keys } = subscription.toJSON();
      if (!endpoint || !keys?.['p256dh'] || !keys?.['auth']) return this.i18n.t('errPush');
      const { error } = await this.supabase.rpc('guardar_suscripcion_push', {
        p_endpoint: endpoint,
        p_p256dh: keys['p256dh'],
        p_auth: keys['auth'],
        p_user_agent: navigator.userAgent,
      });
      return error ? this.i18n.t('errPush') : null;
    } catch {
      this.permission.set(typeof Notification === 'undefined' ? 'denied' : Notification.permission);
      return this.permission() === 'denied' ? this.i18n.t('pushDeniedHint') : this.i18n.t('errPush');
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    const subscription = this.subscription();
    this.busy.set(true);
    try {
      if (subscription) await this.supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      await this.swPush.unsubscribe().catch(() => undefined);
    } finally {
      this.busy.set(false);
    }
  }

  /** Notificación local para comprobar que el permiso y el service worker andan (no pasa por el servidor). */
  async test(): Promise<void> {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('Wallit', {
      body: this.i18n.t('pushTestBody'),
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'wallit-test',
    });
  }
}
