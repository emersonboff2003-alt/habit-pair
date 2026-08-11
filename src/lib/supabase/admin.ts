import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isMockMode, mockClient } from "@/lib/supabase/mock";

/**
 * Cliente do lado do servidor com a chave de serviço (bypassa RLS).
 * Deve ser usado SOMENTE em Server Components, Server Actions e Route Handlers.
 * NUNCA importe este módulo em componentes cliente.
 *
 * Sem NEXT_PUBLIC_SUPABASE_URL (ou com NEXT_PUBLIC_MOCK_MODE=true), usa o
 * cliente mock em memória para desenvolvimento/teste.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isMockMode()) {
    return mockClient as unknown as SupabaseClient<Database>;
  }

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Variáveis de ambiente ausentes: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabaseAdmin = createAdminClient();
