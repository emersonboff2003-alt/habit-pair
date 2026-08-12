"use client";

import { useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activateMissionAction } from "@/lib/actions/missions";

export function ActivateMissionButton({ missionId }: { missionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await activateMissionAction(missionId);
        })
      }
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      Ativar
    </Button>
  );
}