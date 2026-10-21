import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Database } from './database.types';

/**
 * Único cliente de Supabase de la app.
 * PKCE es el flujo recomendado para OAuth en una SPA: al volver de Google,
 * supabase-js detecta el ?code= en la URL y lo canjea por una sesión.
 */
@Service()
export class Supabase {
  readonly client: SupabaseClient<Database> = createClient<Database>(
    environment.supabaseUrl,
    environment.supabaseKey,
    {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
}
