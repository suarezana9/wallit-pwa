// Tipos de la base de Supabase, portados de la app de React Native (types/database.ts)
// y actualizados con las migraciones 004 a 009.
// Más adelante se pueden generar automáticamente con: supabase gen types typescript

export type Categoria =
  | 'Supermercado' | 'Servicios' | 'Transporte' | 'Salud' | 'Educación'
  | 'Ocio' | 'Restaurantes' | 'Ropa' | 'Tecnología'
  | 'Hogar' | 'Mascotas' | 'Viajes' | 'Suscripciones' | 'Deporte'
  | 'Belleza' | 'Auto' | 'Farmacia' | 'Regalos' | 'Delivery'
  | 'Bar' | 'Banco' | 'Trabajo' | 'Otros'
  | (string & {}); // categorías personalizadas

export type TipoMovimiento = 'gasto' | 'ingreso' | 'ahorro' | 'inversion';
export type FuenteIngreso = 'sueldo' | 'freelance' | 'alquiler' | 'otro';
export type RolGrupo = 'admin' | 'member';
export type TipoGrupo = 'hogar' | 'viaje';
export type TipoActividad =
  | 'gasto_nuevo' | 'gasto_editado' | 'gasto_borrado' | 'pago' | 'pago_borrado' | 'miembro_entro' | 'miembro_salio';

/** Lo que guardan los triggers en group_activity.data (migración 013). */
export interface ActividadData {
  actor_name?: string;
  descripcion?: string;
  categoria?: string;
  tipo?: TipoMovimiento;
  monto?: number;
  monto_anterior?: number;
  de?: string;
  para?: string;
}

/** División de un gasto de grupo (columna expenses.division, migración 012). */
export type Division =
  | { tipo: 'iguales'; entre: string[] }
  | { tipo: 'montos'; partes: Record<string, number> };

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
          push_token: string | null;
          notif_config: Json | null;
          notif_enviadas: Json | null;
          categoria_config: Json | null;
        };
        Insert: Partial<Database['public']['Tables']['users']['Row']> & { id: string; email: string };
        Update: Partial<Database['public']['Tables']['users']['Row']>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          currency: string;
          created_by: string | null;
          invite_code: string;
          created_at: string;
          /** Migración 013. */
          tipo: TipoGrupo;
          fecha_inicio: string | null;
          fecha_fin: string | null;
          archivado: boolean;
        };
        Insert: Omit<
          Database['public']['Tables']['groups']['Row'],
          'id' | 'created_at' | 'invite_code' | 'tipo' | 'fecha_inicio' | 'fecha_fin' | 'archivado'
        > & {
          invite_code?: string;
          tipo?: TipoGrupo;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          archivado?: boolean;
        };
        Update: Partial<Database['public']['Tables']['groups']['Row']>;
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: RolGrupo;
          joined_at: string;
        };
        Insert: Omit<Database['public']['Tables']['group_members']['Row'], 'id' | 'joined_at'>;
        Update: Partial<Database['public']['Tables']['group_members']['Row']>;
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          group_id: string | null;
          user_id: string;
          amount: number;
          category: Categoria;
          description: string;
          date: string;
          is_private: boolean;
          receipt_url: string | null;
          created_at: string;
          tipo: TipoMovimiento;
          fuente: FuenteIngreso | null;
          /** Quién pagó; null = quien lo cargó (user_id). */
          paid_by: string | null;
          /** Cómo se divide un gasto de grupo; null = no se divide. */
          division: Division | null;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'paid_by' | 'division'> & {
          paid_by?: string | null;
          division?: Division | null;
        };
        Update: Partial<Database['public']['Tables']['expenses']['Row']>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          group_id: string | null;
          user_id: string | null;
          name: string;
          categories: Categoria[];
          amount_limit: number;
          month: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['budgets']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['budgets']['Row']>;
        Relationships: [];
      };
      settlements: {
        Row: {
          id: string;
          group_id: string;
          from_user: string;
          to_user: string;
          amount: number;
          date: string;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['settlements']['Row'], 'id' | 'created_at' | 'date'> & { date?: string };
        Update: Partial<Database['public']['Tables']['settlements']['Row']>;
        Relationships: [];
      };
      group_activity: {
        Row: {
          id: string;
          group_id: string;
          actor: string | null;
          kind: TipoActividad;
          data: ActividadData;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          user_id: string;
          amount: number;
          settled: boolean;
        };
        Insert: Omit<Database['public']['Tables']['expense_splits']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['expense_splits']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      buscar_grupo_por_codigo: {
        Args: { p_codigo: string };
        Returns: { id: string; name: string; invite_code: string }[];
      };
      guardar_suscripcion_push: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string; p_user_agent?: string | null };
        Returns: undefined;
      };
      obtener_miembros_grupo: {
        Args: { p_group_id: string };
        Returns: {
          user_id: string;
          name: string | null;
          email: string | null;
          avatar_url: string | null;
          role: RolGrupo;
          joined_at: string;
        }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export type UserRow = Database['public']['Tables']['users']['Row'];
export type Movimiento = Database['public']['Tables']['expenses']['Row'];
export type Grupo = Database['public']['Tables']['groups']['Row'];
export type Pago = Database['public']['Tables']['settlements']['Row'];
export type Actividad = Database['public']['Tables']['group_activity']['Row'];
