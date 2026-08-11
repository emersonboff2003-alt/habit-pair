import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cron job da Vercel (/api/cron/check-missions):
 * 1) expira missões que passaram do prazo (duration_days) -> 'failed';
 * 2) renova as missões diárias (duration_days = 1) para a nova rodada do dia.
 * Agendado em vercel.json. Protegido por CRON_SECRET (Bearer token).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [expiredRes, renewedRes] = await Promise.all([
      supabaseAdmin.rpc("expire_stale_missions"),
      supabaseAdmin.rpc("renew_daily_missions"),
    ]);

    if (expiredRes.error) {
      console.error("cron/check-missions: expire error", expiredRes.error);
      return NextResponse.json({ error: expiredRes.error.message }, { status: 500 });
    }
    if (renewedRes.error) {
      console.error("cron/check-missions: renew error", renewedRes.error);
      return NextResponse.json({ error: renewedRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      expired: expiredRes.data,
      renewed: renewedRes.data,
    });
  } catch (e) {
    console.error("cron/check-missions", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
