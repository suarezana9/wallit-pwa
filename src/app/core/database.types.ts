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

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
        };
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'created_at' | 'invite_code'> & {
          invite_code?: string;
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
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at'>;
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
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export type UserRow = Database['public']['Tables']['users']['Row'];
export type Movimiento = Database['public']['Tables']['expenses']['Row'];
