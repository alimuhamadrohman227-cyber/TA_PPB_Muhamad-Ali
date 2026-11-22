import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function YearSelect({ year, years, onChange }) {
  return (
    <label className="relative flex h-11 min-w-28 items-center justify-center rounded-xl bg-white px-3 text-sm font-bold text-[#1F2937]">
      <span className="sr-only">Pilih tahun</span>
      <select
        value={year}
        onChange={(event) => onChange(Number(event.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {years.map((optionYear) => <option key={optionYear} value={optionYear}>{optionYear}</option>)}
      </select>
      {year}
      <ChevronDown size={15} className="ml-1.5 text-[#6B7280]" />
    </label>
  );
}

export default function PeriodPicker({
  mode,
  value,
  onChange,
  availableYears,
  yearsWithData = [],
  monthsWithData = [],
  onClose,
}) {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const selectedYear = value.getFullYear();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  const selectMonth = (month) => {
    onChange(new Date(viewYear, month, 1));
    onClose();
  };

  const selectYear = (year) => {
    onChange(new Date(year, value.getMonth(), 1));
    onClose();
  };

  const changePickerYear = (year) => {
    if (mode === 'month') setViewYear(year);
    else selectYear(year);
  };

  const jumpToCurrent = () => {
    const now = new Date();
    if (mode === 'month') onChange(new Date(now.getFullYear(), now.getMonth(), 1));
    else onChange(new Date(now.getFullYear(), value.getMonth(), 1));
    onClose();
  };

  const sheetContent = (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Pilih periode"
      className="period-picker-sheet relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] sm:rounded-3xl sm:px-6 sm:pb-6"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-[#E5E7EB] sm:hidden" />
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1F2937]">{mode === 'month' ? 'Pilih Bulan' : 'Pilih Tahun'}</h2>
        <button type="button" aria-label="Tutup" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-[#6B7280] transition active:scale-[0.97]">
          <X size={20} />
        </button>
      </div>

      {mode === 'month' ? (
        <>
          <div className="mb-4 flex justify-center rounded-2xl bg-[#F8F9FB] p-1">
            <YearSelect year={viewYear} years={availableYears} onChange={changePickerYear} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {monthLabels.map((label, month) => {
              const isSelected = selectedYear === viewYear && value.getMonth() === month;
              const hasData = monthsWithData.includes(`${viewYear}-${String(month + 1).padStart(2, '0')}`);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectMonth(month)}
                  className={`relative min-h-12 rounded-2xl text-sm font-semibold transition active:scale-[0.97] ${isSelected ? 'bg-[#465A4F] text-white' : 'bg-[#F8F9FB] text-[#1F2937] hover:bg-[#EEF1EE]'}`}
                >
                  {label}
                  {hasData && <span aria-hidden="true" className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSelected ? 'bg-white' : 'bg-[#465A4F]'}`} />}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center rounded-2xl bg-[#F8F9FB] px-4 py-5">
            <YearSelect year={selectedYear} years={availableYears} onChange={changePickerYear} />
            <p className="mt-3 text-xs text-[#6B7280]">
              {yearsWithData.includes(selectedYear) ? 'Ada transaksi pada tahun ini' : 'Belum ada transaksi pada tahun ini'}
            </p>
          </div>
        </>
      )}

      <button type="button" onClick={jumpToCurrent} className="mt-3 min-h-12 w-full rounded-2xl bg-[#F8F9FB] text-sm font-semibold text-[#465A4F] transition active:scale-[0.97]">
        {mode === 'month' ? 'Bulan Ini' : 'Tahun Ini'}
      </button>
    </section>
  );

  return (
    <div className="period-picker-overlay fixed inset-0 z-[70] flex items-end justify-center bg-black/30 sm:items-center sm:px-4" onClick={onClose}>
      {sheetContent}
    </div>
  );
}
