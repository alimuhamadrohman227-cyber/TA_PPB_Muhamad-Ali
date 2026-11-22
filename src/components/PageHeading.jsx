import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PageHeading({ title, subtitle, back = false, action, className = '' }) {
  const navigate = useNavigate();
  return (
    <header className={`mb-5 flex items-center gap-3 ${className}`}>
      {back && (
        <button onClick={() => navigate(-1)} aria-label="Kembali" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#EFEFED] bg-white text-[#24332C]">
          <ChevronLeft size={21} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {subtitle && <p className="eyebrow mb-1.5">{subtitle}</p>}
        <h1 className="page-title min-w-0 break-words">{title}</h1>
      </div>
      {action}
    </header>
  );
}
