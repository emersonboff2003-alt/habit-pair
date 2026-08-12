export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-4 w-40 rounded-full bg-raised" />
        <div className="mt-2 h-6 w-56 rounded-full bg-raised" />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
        <div className="h-8 w-24 rounded-full bg-raised" />
        <div className="mt-3 h-10 w-32 rounded-full bg-raised" />
        <div className="mt-4 h-4 w-44 rounded-full bg-raised" />
      </div>

      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded-full bg-raised" />
                <div className="h-3 w-32 rounded-full bg-raised" />
              </div>
              <div className="h-5 w-16 rounded-full bg-raised" />
            </div>
            <div className="mt-4 h-2.5 w-full rounded-full bg-raised" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="h-5 w-28 rounded-full bg-raised" />
        <div className="mt-4 space-y-4">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-full bg-raised" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-20 rounded-full bg-raised" />
                  <div className="h-3 w-28 rounded-full bg-raised" />
                </div>
                <div className="h-4 w-10 rounded-full bg-raised" />
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-raised" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}