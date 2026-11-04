# Wallit

Finanzas del hogar, solo o en grupo. Una PWA para cargar gastos en segundos (a mano, con la voz o con una foto del ticket), ver a dónde va la plata cada mes y dividir cuentas con la familia, la pareja o un viaje.

**Producción:** https://wallit-pwa.vercel.app

## Qué hace

| Área | Funciones |
|---|---|
| **Movimientos** | Ingresos, gastos, ahorros e inversiones. Categorías propias, medios de pago, cuotas de tarjeta, gastos fijos que se cargan solos, comprobantes adjuntos y exportación a Excel. |
| **Carga con IA** | Texto libre ("súper 45 mil ayer"), dictado por voz, foto del ticket o foto pegada desde el portapapeles. La IA propone el movimiento y la persona lo revisa antes de guardar. |
| **Inicio** | Disponible del mes, "Ritmo del mes" (cuánto queda por día y comparación con el mes anterior), gastos por categoría y primeros pasos para quien recién empieza. |
| **Resumen mensual** | El día 1, aviso con el resumen del mes anterior escrito por la IA y un consejo. |
| **Presupuestos** | Por categoría, con avisos al 80% y al 100%. |
| **Grupos** | Hogar o viaje, en bolsa común o dividiendo gastos. Saldos, "quién le debe a quién", pagos con alias/CBU, actividad, invitación por link y avatar del grupo. |
| **Notificaciones** | Web Push: gastos en tus grupos, pagos, presupuestos, recordatorio semanal de deudas y resumen del mes. |
| **Cuenta** | Foto de perfil, moneda, idioma (es/en), tema claro u oscuro, datos de cobro, uso de la IA, comentarios, privacidad y eliminar cuenta. |

## Stack

| Capa | Tecnología |
|---|---|
| Front | Angular 22 (standalone, signals, Signal Forms) + Ionic 9, PWA con service worker de Angular |
| Back | Supabase: Postgres con RLS, Auth (email, código por mail y Google), Storage, Edge Functions (Deno), pg_cron y pg_net |
| IA | Groq (texto, visión y transcripción de audio) desde la Edge Function `wallit-ia` |
| Hosting | Vercel (`vercel.json`) |
| Tests | Vitest (`ng test`), ESLint, tests de Deno para las funciones |

## Correr en local

Requisitos: **Node 22** y npm.

```bash
npm ci
npm start            # http://localhost:4200
```

La app usa el proyecto de Supabase configurado en `src/environments/environment.ts`:

| Campo | Qué va | ¿Secreto? |
|---|---|---|
| `supabaseUrl` | URL del proyecto | No |
| `supabaseKey` | Clave **publishable** (o anon) | No: es pública por diseño, la seguridad la da RLS |
| `vapidPublicKey` | Clave pública de Web Push | No |

> Nunca pongas en el front la clave `sb_secret_…` / service role, ni la clave privada VAPID, ni la de Groq: van solo como secretos de las Edge Functions (ver [supabase/README.md](supabase/README.md)).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción en `www/` |
| `npm test` | Tests unitarios (Vitest); en CI: `npx ng test --watch=false` |
| `npm run lint` | ESLint |
| `deno test -A` (dentro de cada función) | Tests de las Edge Functions |

## Estructura

```
src/app/
  ai/             Carga con IA (texto, voz, foto, pegar), límite de uso
  account/        Cuenta: perfil, datos de cobro, comentarios, eliminar cuenta
  auth/           Bienvenida, login (Google, código por mail, contraseña)
  budgets/        Presupuestos
  categories/     Categorías propias y ocultas
  core/           Supabase, auth, preferencias, i18n (es/en), tipos de la base, montos y fechas
  groups/         Grupos, saldos, pagos, actividad, avatares, selector de espacio
  home/           Inicio y primeros pasos
  legal/          Política de privacidad y Términos (/privacidad, /terminos)
  movements/      Movimientos, formulario, cuotas, fijos, resumen mensual, Ritmo del mes
  notifications/  Web Push y preferencias de avisos
  receipts/       Comprobantes en Storage
  shared/         Componentes comunes (avatar, montos, sidebar, logo)
  theme/          Paleta (claro y oscuro) y estilos globales
supabase/
  migrations/     SQL numerado (se corre a mano en el SQL Editor, en orden)
  functions/      Edge Functions: wallit-ia y wallit-notificaciones
public/           Íconos, manifest y service worker propio (wallit-sw.js)
```

Convenciones del código: lógica de negocio en funciones puras (`*.model.ts`) con tests, estado en servicios con signals (`*-store.ts`), componentes standalone y textos siempre en `core/i18n/es.ts` y `en.ts`.

## Deploy

1. **Base de datos:** correr en el SQL Editor de Supabase las migraciones nuevas, en orden (ver [supabase/README.md](supabase/README.md)).
2. **Funciones:** si cambió algo en `supabase/functions`, desplegarlas.
3. **Front:** push a `main`; Vercel construye y publica solo.

Después de un deploy, la PWA instalada toma la versión nueva al cerrarla del todo y volver a abrirla.

## Antes de producción (checklist)

- [ ] Servidor de mail propio en Supabase (Authentication → Emails → SMTP). El de Supabase solo envía unos pocos mails por hora y a los miembros del proyecto.
- [ ] Google Cloud → OAuth consent screen en **Producción**, con nombre, logo y los links a `/privacidad` y `/terminos`.
- [ ] Completar responsable y email de contacto en `src/app/legal/legal.config.ts`.
- [ ] Supabase → Authentication → URL Configuration: Site URL `https://wallit-pwa.vercel.app` y Redirect URLs con `/**`.
- [ ] Plan de Supabase con backups (el gratis pausa el proyecto tras 7 días sin uso).
- [ ] Security Advisor de Supabase sin alertas.
- [ ] Monitoreo de errores (Sentry).
