export function SummarySkeleton() {
  return (
    <div role="status" aria-label="Memuat ringkasan" className="card motion-enter p-card">
      <div className="skeleton h-3 w-36 rounded-full" />
      <div className="skeleton mt-4 h-8 w-48 max-w-full rounded-lg" />
      <div className="skeleton mt-3 h-3 w-28 rounded-full" />
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div role="status" aria-label="Memuat daftar transaksi" className="card divide-y divide-[#F1F1EF] px-card">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex items-center gap-3.5 py-3.5">
          <div className="skeleton h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="skeleton h-3.5 w-32 max-w-full rounded-full" />
            <div className="skeleton mt-2 h-3 w-24 max-w-full rounded-full" />
          </div>
          <div className="skeleton h-3.5 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
