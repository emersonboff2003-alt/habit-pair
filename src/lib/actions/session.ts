"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import type { Profile } from "@/types/database";

type ActionResult = { ok: boolean; error?: string };

/** Seleciona um perfil (estilo Netflix) e cria a sessão. */
export async function selectProfileAction(profileId: string): Promise<ActionResult> {
  try {
    if (!profileId) return { ok: false, error: "Perfil inválido." };

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle<Profile>();

    if (error) {
      console.error("selectProfileAction: query error", error);
      return { ok: false, error: "Erro ao consultar o perfil." };
    }
    if (!profile) return { ok: false, error: "Perfil não encontrado." };

    await setSessionCookie(profile.id);
    revalidatePath("/", "layout");
    redirect("/");
  } catch (e) {
    // redirect() lança um erro intencionalmente; ele não deve ser tratado aqui.
    if (e instanceof Error && "digest" in e) throw e;
    console.error("selectProfileAction", e);
    return { ok: false, error: "Não foi possível entrar. Tente novamente." };
  }
}

/**
 * Troca direta para outro perfil SEM passar pela tela de seleção.
 * Valida o destino, atualiza o cookie e redireciona para o dashboard em uma
 * única navegação (evita a ida a /select-profile do fluxo antigo).
 */
export async function switchProfileAction(profileId: string): Promise<ActionResult> {
  try {
    if (!profileId) return { ok: false, error: "Perfil inválido." };

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle<Profile>();

    if (error) {
      console.error("switchProfileAction: query error", error);
      return { ok: false, error: "Erro ao consultar o perfil." };
    }
    if (!profile) return { ok: false, error: "Perfil não encontrado." };

    await setSessionCookie(profile.id);
    revalidatePath("/", "layout");
    redirect("/");
  } catch (e) {
    if (e instanceof Error && "digest" in e) throw e;
    console.error("switchProfileAction", e);
    return { ok: false, error: "Não foi possível trocar de perfil. Tente novamente." };
  }
}

/** Encerra a sessão e volta para a seleção de perfil. */
export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/select-profile");
}
