import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, TrendingDown } from 'lucide-react';
import AnimatedCurrency from '../components/AnimatedCurrency.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LiquidSegmentedControl from '../components/LiquidSegmentedControl.jsx';
import { ListSkeleton, SummarySkeleton } from '../components/LoadingSkeleton.jsx';
import PageHeading from '../components/PageHeading.jsx';
import TransactionGroupList from '../components/TransactionGroupList.jsx';
import useExpenseLimits from '../hooks/useExpenseLimits.js';
import useTransactions from '../hooks/useTransactions.js';
import { isSameMonth } from '../utils/format.js';

const expenseCategories = ['Makan', 'Belanja', 'Tagihan', 'Transportasi', 'Lainnya'];

const periods = [
  { value: 'Harian', label: 'Harian' },
  { value: 'Mingguan', label: 'Mingguan' },
  { value: 'Bulanan', label: 'Bulanan' },
];

export default function Pengeluaran() {
  const { transactions, loading, error } = useTransactions();
  const { limits, syncPending, loading: limitsLoading, error: limitsError, saveLimits } = useExpenseLimits();
  const [period, setPeriod] = useState('Bulanan');
  const [search, setSearch] = useState('');
  const [now] = useState(() => new Date());
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limitDraft, setLimitDraft] = useState({});
  const [limitDraftDirty, setLimitDraftDirty] = useState(false);
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsSaved, setLimitsSaved] = useState(false);
  const [limitsFormError, setLimitsFormError] = useState('');

  useEffect(() => {
    if (!limitsLoading && !limitDraftDirty) {
      setLimitDraft(Object.fromEntries(expenseCategories.map((category) => [
        category,
        limits[category] ? String(limits[category]) : '',
      ])));
    }
  }, [limits, limitsLoading, limitDraftDirty]);

  const monthExpenses = transactions
    .filter((item) => item.type === 'expense' && isSameMonth(item.date, now))
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = useMemo(() =>
    transactions
      .filter((item) => item.type === 'expense')
      .filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase())),
  [transactions, search]);

  return (
    <main className="page-pad has-fab-content">
      <PageHeading title="Pengeluaran" subtitle="UANG KELUAR" />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}

      {loading ? <SummarySkeleton /> : <section className="card motion-enter overflow-hidden p-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="caption">Total pengeluaran bulan ini</p>
            <p className="money mt-2 text-[27px] font-bold tracking-tight text-[#24332C]"><AnimatedCurrency amount={monthExpenses} /></p>
            <p className="caption mt-1">
              {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now)}
            </p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FEE2E2] text-[#DC2626]"><TrendingDown size={21} /></span>
        </div>
      </section>}

      <section className="card mt-4 overflow-hidden">
        <button
          type="button"
          aria-expanded={limitsOpen}
          onClick={() => setLimitsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-card py-4 text-left"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F0F2ED] text-[#526458]"><SlidersHorizontal size={18} /></span>
            <span>
              <span className="block text-sm font-semibold text-[#24332C]">Limit per kategori</span>
              <span className="caption mt-1 block">Atur batas nominal setiap transaksi</span>
            </span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-[#858A85] transition-transform ${limitsOpen ? 'rotate-180' : ''}`} />
        </button>
        {limitsOpen && <div className="border-t border-[#F1F1EF] px-card pb-5 pt-4">
          <p className="mb-4 text-xs leading-5 text-[#858A85]">Peringatan muncul saat nominal transaksi mencapai 80% dari limit. Kosongkan kolom jika kategori tidak perlu dibatasi.</p>
          {limitsError && <p role="alert" className="mb-3 rounded-xl bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">{limitsError}</p>}
          {limitsFormError && <p role="alert" className="mb-3 rounded-xl bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">{limitsFormError}</p>}
          {limitsLoading ? <p className="py-3 text-xs text-[#858A85]">Memuat limit kategori...</p> : (
            <div className="space-y-3">
              {expenseCategories.map((category) => (
                <label key={category} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#46534A]">{category}</span>
                  <span className="flex w-40 items-center rounded-xl border border-[#E8E9E6] bg-white px-3 focus-within:border-[#24332C] focus-within:ring-2 focus-within:ring-[#24332C]/10">
                    <span className="mr-2 text-xs font-semibold text-[#858A85]">Rp</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={limitDraft[category] ?? ''}
                      onChange={(event) => {
                        setLimitDraftDirty(true);
                        setLimitsSaved(false);
                        setLimitsFormError('');
                        setLimitDraft((draft) => ({ ...draft, [category]: event.target.value }));
                      }}
                      placeholder="Tidak dibatasi"
                      aria-label={`Limit transaksi kategori ${category}`}
                      className="w-full min-w-0 bg-transparent py-2.5 text-right text-sm outline-none placeholder:text-[10px] placeholder:text-[#A0A5A0]"
                    />
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            {limitsSaved || syncPending
              ? <p role="status" className="text-xs font-medium text-[#52745A]">{syncPending ? 'Limit tersimpan di perangkat, menunggu sinkronisasi.' : 'Limit berhasil disimpan.'}</p>
              : <span />}
            <button
              type="button"
              disabled={limitsLoading || limitsSaving || Boolean(limitsError)}
              onClick={async () => {
                const nextLimits = {};
                for (const category of expenseCategories) {
                  const rawValue = String(limitDraft[category] ?? '').trim();
                  if (!rawValue) continue;
                  const amount = Number(rawValue);
                  if (!Number.isInteger(amount) || amount <= 0) {
                    setLimitsFormError(`Masukkan nominal limit kategori ${category} berupa bilangan bulat lebih dari 0.`);
                    return;
                  }
                  nextLimits[category] = amount;
                }
                setLimitsFormError('');
                setLimitsSaved(false);
                setLimitsSaving(true);
                try {
                  const saved = await saveLimits(nextLimits);
                  setLimitDraft(Object.fromEntries(expenseCategories.map((category) => [
                    category,
                    saved.limits[category] ? String(saved.limits[category]) : '',
                  ])));
                  setLimitDraftDirty(false);
                  setLimitsSaved(true);
                } catch {
                  // Error is displayed from the limits hook.
                } finally {
                  setLimitsSaving(false);
                }
              }}
              className="rounded-xl bg-[#24332C] px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {limitsSaving ? 'Menyimpan...' : 'Simpan limit'}
            </button>
          </div>
        </div>}
      </section>

      <section className="mt-section">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow">Aktivitas</p>
            <h2 className="section-title mt-1.5">Daftar Pengeluaran</h2>
          </div>
          <span className="caption tabular-nums">{expenses.length} transaksi</span>
        </div>
        <LiquidSegmentedControl options={periods} value={period} onChange={setPeriod} className="mb-4 w-full" />
        <label className="mb-3 flex items-center gap-2.5 rounded-2xl border border-[#EFEFED] bg-white px-4">
          <Search size={16} className="text-[#9A9F9A]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari pengeluaran..."
            className="w-full bg-transparent py-3 text-xs outline-none placeholder:text-[#6B7280]"
          />
        </label>
        {loading ? <ListSkeleton /> : search && !expenses.length ? (
          <EmptyState title="Tidak ditemukan" description="Coba kata kunci lain." actionLabel="Catat Pengeluaran" actionType="expense" />
        ) : (
          <TransactionGroupList
            period={period}
            transactions={expenses}
            type="expense"
            title="Daftar Pengeluaran"
            emptyDescription="Tekan tombol + di bawah untuk mulai mencatat."
            actionLabel="Catat Pengeluaran"
          />
        )}
      </section>
    </main>
  );
}
