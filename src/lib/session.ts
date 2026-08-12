import { cookies } from "next/headers";
import { getProfileById } from "@/lib/data";

export const SESSION_COOKIE_NAME = "habit_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

/** Lê o id do perfil ativo a partir do cookie de sessão. */
export async function getSessionProfileId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!value) return null;
  
  let id: string;
  try {
    id = decodeURIComponent(value).toLowerCase(); // Normalize to lowercase
  } catch {
    return null; // Invalid cookie value
  }
  
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return null;
  
  // CRITICAL VALIDATION: Verify profile actually exists
  const profile = await getProfileById(id);
  return profile ? id : null; // Return null if profile doesn't exist
}

/** Define o cookie de sessão com o perfil selecionado. */
export async function setSessionCookie(profileId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeURIComponent(profileId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Remove o cookie de sessão. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
