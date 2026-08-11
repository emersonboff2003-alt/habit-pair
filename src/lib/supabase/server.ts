import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isMockMode, mockClient } from "@/lib/supabase/mock";

/**
 * Cliente do lado do servidor com a chave anônima (respeita RLS).
 * Usado para leituras públicas do catálogo (ex.: lista de perfis na tela
 * de seleção de perfil). Nunca execute mutações por aqui.
 *
 * Em modo mock, usa o cliente em memória.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isMockMode()) {
    return mockClient as unknown as SupabaseClient<Database>;
  }

  if (!url || !anonKey) {
    throw new Error(
      "Variáveis de ambiente ausentes: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabaseAnon = createAnonClient();
