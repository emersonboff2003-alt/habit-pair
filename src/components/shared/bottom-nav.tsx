"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardPlus, Target, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Início", icon: Home },
  { href: "/logs", label: "Registrar", icon: ClipboardPlus },
  { href: "/missions", label: "Missões", icon: Target },
  { href: "/store", label: "Recompensas", icon: Gift },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 pb-2 pt-1.5 text-[11px] font-medium transition-colors",
                active ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-5 w-5", active && "text-violet-400")} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
