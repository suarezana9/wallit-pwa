# Supabase de Wallit

Base de datos, autenticación, archivos y funciones del servidor. Todo lo que está acá se aplica **a mano** desde el panel de Supabase o con la CLI: no hay un pipeline automático.

## Migraciones

Están en `migrations/`, numeradas. Cada una se corre **una vez**, en orden, en **SQL Editor**. Son idempotentes: correr una dos veces no rompe nada.

> El esquema base (`users`, `groups`, `group_members`, `expenses`, `budgets` y funciones como `es_miembro` y `obtener_miembros_grupo`) es anterior a la 011 y no está en este repo.

| # | Qué agrega | Requiere |
|---|---|---|
| 011 | Comprobantes en Storage (bucket `receipts`) | |
| 012 | Cuentas de grupo: quién pagó, división y pagos entre miembros (`settlements`) | |
| 013 | Viajes y actividad del grupo (`group_activity`) | |
| 014 | Notificaciones push: `push_subscriptions`, triggers y aviso semanal de deudas | pg_net, pg_cron y el secreto en Vault (ver abajo) |
| 015 | Detalle de ítems de un gasto | |
| 016 | Tarjetas, medio de pago y modo de división del grupo | |
| 017 | Cuotas y gastos fijos (`recurrentes`) | |
| 018 | Límite diario de uso de la IA | |
| 019 | Datos para cobrar (alias y CBU/CVU/IBAN) | |
| 020 | Resumen mensual con IA (`resumenes_ia`) y su aviso del día 1 | 014 |
| 021 | Avisos sin duplicados (`notif_eventos`) y limpieza de suscripciones repetidas | 014 |
| 022 | Foto de perfil y avatar de grupo (bucket `avatars`) | |
| 023 | Eliminar cuenta (`eliminar_mi_cuenta()`) y comentarios (`comentarios`) | 019 |

Para ver qué se corrió: los nombres de tablas y funciones de cada migración aparecen en **Table Editor** y **Database → Functions**.

## Edge Functions

| Función | Qué hace | JWT |
|---|---|---|
| `wallit-ia` | Interpreta texto, audio e imágenes para cargar movimientos y escribe el resumen mensual. Aplica el límite diario de la 018. | Sí (la llama la app con la sesión) |
| `wallit-notificaciones` | Manda los Web Push. La llaman los triggers y pg_cron con un secreto compartido. | **No** (`--no-verify-jwt`) |

### Deploy

Desde la raíz del repo (la primera vez: `npx supabase login` y `npx supabase link --project-ref <ref>`):

```bash
npx supabase functions deploy wallit-ia --use-api
npx supabase functions deploy wallit-notificaciones --no-verify-jwt --use-api
```

`--use-api` arma la función en los servidores de Supabase (no hace falta Docker).

### Secretos

Se cargan en **Edge Functions → Secrets** (o `npx supabase secrets set NOMBRE=valor`). Nunca en el código ni en el front.

| Secreto | Función | Qué es |
|---|---|---|
| `GROQ_API_KEY` | wallit-ia | Clave de la API de Groq |
| `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`, `GROQ_AUDIO_MODEL` | wallit-ia | Opcionales: cambian los modelos por defecto |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | wallit-notificaciones | Par de claves de Web Push (la pública también va en `environment.ts`) |
| `VAPID_SUBJECT` | wallit-notificaciones | Opcional: `mailto:` de contacto para los servicios de push |
| `WEBHOOK_SECRET` | wallit-notificaciones | El mismo valor que el secreto `wallit_webhook_secret` de Vault |

`SUPABASE_URL` y las claves del proyecto las pone Supabase solo.

Secreto de Vault (una vez, antes de la 014):

```sql
select vault.create_secret('VALOR_LARGO_Y_AL_AZAR', 'wallit_webhook_secret');
```

### Tests

```bash
cd supabase/functions/wallit-ia && deno test -A
cd supabase/functions/wallit-notificaciones && deno test -A
```

## Tareas programadas (pg_cron)

| Nombre | Cuándo (UTC) | Qué hace |
|---|---|---|
| `wallit-deudas-semanal` | Lunes 12:00 | Recordatorio a quien debe plata en un grupo |
| `wallit-resumen-mensual` | Día 1, 13:00 | Aviso del resumen del mes anterior |
| `wallit-notif-eventos-limpieza` | Todos los días 07:17 | Borra el registro de avisos de más de 40 días |

Se ven en **Integrations → Cron** (o `select * from cron.job`).

## Autenticación

| Dónde | Qué configurar |
|---|---|
| Authentication → URL Configuration | Site URL `https://wallit-pwa.vercel.app` y Redirect URLs `https://wallit-pwa.vercel.app/**` (más `http://localhost:4200/**` para desarrollo) |
| Authentication → Providers → Google | Client ID y secret de Google Cloud |
| Authentication → Emails → SMTP | Servidor propio (Resend, Brevo…) para que lleguen los mails a cualquier usuario |
| Authentication → Emails → Templates | El "Magic Link" tiene que incluir `{{ .Token }}` (el código de 6 dígitos) además del link |

## Leer los comentarios

**Table Editor → comentarios**: texto, pantalla desde donde se mandó, dispositivo y fecha. La app solo puede escribir; leerlos es solo desde el panel.

## Seguridad

- Todas las tablas tienen RLS: cada persona ve lo suyo y lo de sus grupos.
- Las funciones `security definer` validan siempre `auth.uid()` y la pertenencia al grupo.
- Revisar **Advisors → Security** después de cada migración.
