export default function SectionHeader({ title, total, count, tone = 'expense', onToggle, open, collapsible = false }) {
  const toneClass = tone === 'income' ? 'text-[#15803D]' : 'text-[#DC2626]';
  const prefix = tone === 'income' ? '+' : '-';
  const content = (
    <>
      <div className="min-w-0">
        <p className="card-title">{title}</p>
        {count !== undefined && <p className="caption tabular-nums mt-0.5">{count} transaksi</p>}
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-2">
        <p className={`money text-sm font-bold ${toneClass}`}>{prefix}Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(Number(total) || 0))}</p>
        {collapsible && (
          <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 text-[#9A9F9A] transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </>
  );
  return collapsible ? (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-4 text-left">
      {content}
    </button>
  ) : (
    <div className="flex w-full items-center justify-between px-5 py-3.5">{content}</div>
  );
}
