import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PageHeading({ title, subtitle, back = false, action }) {
  const navigate = useNavigate();
  return (
    <header className="mb-6 flex items-center gap-3">
      {back && (
        <button onClick={() => navigate(-1)} aria-label="Kembali" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#EFEFED] bg-white text-[#24332C]">
          <ChevronLeft size={21} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {subtitle && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#858A85]">{subtitle}</p>}
        <h1 className="truncate text-[23px] font-bold tracking-tight text-[#202823]">{title}</h1>
      </div>
      {action}
    </header>
  );
}
