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

/** Renomeia um perfil. */
export async function updateProfileAction(
  profileId: string,
  name: string,
): Promise<ActionResult> {
  try {
    const trimmed = name.trim();
    if (!profileId) return { ok: false, error: "Perfil inválido." };
    if (!trimmed) return { ok: false, error: "Digite um nome." };
    if (trimmed.length > 50) return { ok: false, error: "Nome muito longo (máx. 50 caracteres)." };

    const { data: all, error: listError } = await supabaseAdmin
      .from("profiles")
      .select("id, name");
    if (listError) {
      console.error("updateProfileAction: list error", listError);
      return { ok: false, error: "Não foi possível renomear o perfil." };
    }
    const duplicate = (all ?? []).some(
      (p) => p.id !== profileId && p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) return { ok: false, error: "Já existe um perfil com esse nome." };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ name: trimmed })
      .eq("id", profileId);

    if (error) {
      console.error("updateProfileAction: update error", error);
      return { ok: false, error: "Não foi possível renomear o perfil." };
    }

    revalidatePath("/select-profile", "page");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("updateProfileAction", e);
    return { ok: false, error: "Erro inesperado ao renomear o perfil." };
  }
}

/** Exclui um perfil (mantém pelo menos um perfil no app). */
export async function deleteProfileAction(profileId: string): Promise<ActionResult> {
  try {
    if (!profileId) return { ok: false, error: "Perfil inválido." };

    const { data: profiles, error: listError } = await supabaseAdmin
      .from("profiles")
      .select("id");
    if (listError) {
      console.error("deleteProfileAction: list error", listError);
      return { ok: false, error: "Não foi possível excluir o perfil." };
    }
    if ((profiles ?? []).length <= 1) {
      return { ok: false, error: "Não é possível excluir o último perfil." };
    }

    const { error } = await supabaseAdmin.from("profiles").delete().eq("id", profileId);

    if (error) {
      console.error("deleteProfileAction: delete error", error);
      return { ok: false, error: "Não foi possível excluir o perfil." };
    }

    revalidatePath("/select-profile", "page");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("deleteProfileAction", e);
    return { ok: false, error: "Erro inesperado ao excluir o perfil." };
  }
}
