import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  initials: string;
  className?: string;
}

export function Avatar({ name, initials, className }: AvatarProps) {
  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-zinc-950",
        className,
      )}
    >
      {initials}
    </div>
  );
}
