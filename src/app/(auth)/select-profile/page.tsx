import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { supabaseAnon } from "@/lib/supabase/server";
import { getSessionProfileId } from "@/lib/session";
import { ProfileCard } from "@/components/auth/profile-card";
import { CreateProfileCard } from "@/components/auth/create-profile-card";

export const dynamic = "force-dynamic";

export default async function SelectProfilePage() {
  const sessionId = await getSessionProfileId();
  if (sessionId) redirect("/");

  const { data: profiles, error } = await supabaseAnon.from("profiles").select("*").order("name");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-6 safe-bottom">
      <div className="text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 shadow-lg shadow-accent/25">
          <Sparkles className="h-8 w-8 text-zinc-950" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">
          Habit<span className="text-accent">Pair</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Quem está jogando agora?</p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Erro ao carregar os perfis. Verifique a conexão com o Supabase.
        </p>
      ) : profiles && profiles.length > 0 ? (
        <div className="flex w-full max-w-sm flex-col gap-3 animate-fade-in-up">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
          <CreateProfileCard />
        </div>
      ) : (
        <p className="text-sm text-muted">
          Nenhum perfil encontrado. Execute o schema.sql no Supabase.
        </p>
      )}
    </main>
  );
}
