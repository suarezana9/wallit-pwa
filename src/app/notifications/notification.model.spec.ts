import { PushEnvironment, pushStatus, readPref, withPref } from './notification.model';

const base: PushEnvironment = {
  hasKey: true, swEnabled: true, hasNotificationApi: true, isIos: false, isStandalone: false, permission: 'default', subscribed: false,
};

describe('notification.model', () => {
  it('lee preferencias con default activado y no pisa las de la app móvil', () => {
    expect(readPref(null, 'pagos')).toBe(true);
    expect(readPref({ pagos: false }, 'pagos')).toBe(false);
    expect(withPref({ sin_actividad: false }, 'deudas', false)).toEqual({ sin_actividad: false, deudas: false });
  });

  it('decide el estado según el navegador', () => {
    expect(pushStatus({ ...base, hasKey: false })).toBe('unconfigured');
    expect(pushStatus({ ...base, isIos: true })).toBe('install-ios');
    expect(pushStatus({ ...base, isIos: true, isStandalone: true })).toBe('off');
    expect(pushStatus({ ...base, swEnabled: false })).toBe('dev');
    expect(pushStatus({ ...base, permission: 'denied' })).toBe('denied');
    expect(pushStatus({ ...base, permission: 'granted', subscribed: true })).toBe('on');
  });
});
