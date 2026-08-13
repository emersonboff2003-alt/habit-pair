"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ActionResult = { ok: boolean; error?: string };

/** Cria um novo perfil (com missões e preferências padrão via RPC create_profile). */
export async function createProfileAction(name: string): Promise<ActionResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Digite um nome." };
    if (trimmed.length > 50) return { ok: false, error: "Nome muito longo (máx. 50 caracteres)." };

    const { data, error } = await supabaseAdmin.rpc("create_profile", {
      p_name: trimmed,
      p_theme: "classic-dark",
    });

    if (error) {
      console.error("createProfileAction: rpc error", error);
      return { ok: false, error: "Não foi possível criar o perfil." };
    }

    const result = data as unknown as { ok: boolean; error?: string };
    if (!result.ok) {
      const message =
        result.error === "nome_duplicado"
          ? "Já existe um perfil com esse nome."
          : result.error === "nome_muito_longo"
            ? "Nome muito longo (máx. 50 caracteres)."
            : "Não foi possível criar o perfil.";
      return { ok: false, error: message };
    }

    revalidatePath("/select-profile", "page");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("createProfileAction", e);
    return { ok: false, error: "Erro inesperado ao criar o perfil." };
  }
}
