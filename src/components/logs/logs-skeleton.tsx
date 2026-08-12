export function LogsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[0, 1].map((block) => (
        <div key={block} className="space-y-3">
          <div className="h-4 w-32 rounded-full bg-raised" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl border border-border bg-card" />
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-3">
        <div className="h-4 w-28 rounded-full bg-raised" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 shrink-0 rounded-full bg-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 rounded-full bg-raised" />
                <div className="h-3 w-40 rounded-full bg-raised" />
              </div>
              <div className="h-9 w-20 rounded-xl bg-raised" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}