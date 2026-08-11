"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionProfileId } from "@/lib/session";
import { isThemeValid } from "@/lib/themes";

type ActionResult = { ok: boolean; error?: string };

/**
 * Salva o tema escolhido no perfil ativo.
 * O tema é por perfil: cada pessoa tem a sua escolha, independente da outra.
 */
export async function updateThemeAction(theme: string): Promise<ActionResult> {
  try {
    if (!isThemeValid(theme)) return { ok: false, error: "Tema inválido." };

    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ theme })
      .eq("id", profileId);

    if (error) {
      console.error("updateThemeAction: update error", error);
      return { ok: false, error: "Não foi possível salvar o tema." };
    }

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("updateThemeAction", e);
    return { ok: false, error: "Erro inesperado ao salvar o tema." };
  }
}
