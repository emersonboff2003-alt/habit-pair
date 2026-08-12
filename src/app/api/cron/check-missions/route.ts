import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cron job da Vercel (/api/cron/check-missions):
 * gira o ciclo de missões (roll_missions):
 * - temporárias disponíveis sem ativação somem;
 * - temporárias ativadas e não concluídas recebem pontos proporcionais;
 * - missões vencidas falham;
 * - rodadas concluídas/falhas prontas voltam (água sempre ativa; demais
 *   reaparecem 'available'; temporárias voltam aleatoriamente).
 * Agendado em vercel.json. Protegido por CRON_SECRET (Bearer token).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("roll_missions");

    if (error) {
      console.error("cron/check-missions: roll error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...(data as unknown as Record<string, unknown>) });
  } catch (e) {
    console.error("cron/check-missions", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}