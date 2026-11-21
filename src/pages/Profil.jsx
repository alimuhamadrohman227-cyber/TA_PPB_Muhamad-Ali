import { useEffect, useState } from 'react';
import { Bell, Check, ChevronRight, CircleHelp, Pencil, UserRound } from 'lucide-react';
import PageHeading from '../components/PageHeading.jsx';

const NAME_KEY = 'catatan-keuangan:profile-name';
const REMINDER_KEY = 'catatan-keuangan:daily-reminder';
const DEFAULT_NAME = 'Muhamad Ali Rohman';

export default function Profil() {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || DEFAULT_NAME);
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const [reminder, setReminder] = useState(() => localStorage.getItem(REMINDER_KEY) === 'true');
  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MK';
  const saveName = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setName(draft.trim());
    setEditing(false);
  };
  const toggleReminder = () => {
    const next = !reminder;
    setReminder(next);
    localStorage.setItem(REMINDER_KEY, String(next));
  };

  return (
    <main className="page-pad">
      <PageHeading title="Profil & Tentang" subtitle="PREFERENSI APLIKASI" />
      <section className="card flex items-center gap-4 p-5">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-[#24332C] text-lg font-bold text-[#D3E5C7]">{initials}</div>
        <div className="min-w-0 flex-1">{editing ? <form onSubmit={saveName}><input autoFocus maxLength={60} value={draft} onChange={(event) => setDraft(event.target.value)} className="field py-2" /><div className="mt-2 flex gap-2"><button className="rounded-full bg-[#24332C] px-3 py-1.5 text-[10px] font-semibold text-white">Simpan</button><button type="button" onClick={() => { setEditing(false); setDraft(name); }} className="text-[10px] font-semibold text-[#7B827B]">Batal</button></div></form> : <><p className="truncate text-base font-bold">{name}</p><p className="mt-1 text-[11px] text-[#858A85]">Pengguna Catatan Keuangan</p></>}</div>
        {!editing && <button aria-label="Ubah nama" onClick={() => { setDraft(name); setEditing(true); }} className="grid h-9 w-9 place-items-center rounded-xl bg-[#F3F4F1] text-[#647168]"><Pencil size={16} /></button>}
      </section>
      <section className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Preferensi</p>
        <div className="card flex items-center gap-3.5 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F2F4F0] text-[#596A5F]"><Bell size={18} /></span>
          <div className="flex-1"><p className="text-sm font-semibold">Pengingat Harian</p><p className="mt-1 text-[10px] text-[#858A85]">Simpan preferensi pengingat di perangkat ini</p></div>
          <button type="button" role="switch" aria-checked={reminder} aria-label="Pengingat Harian" onClick={toggleReminder} className={`relative h-6 w-11 rounded-full transition ${reminder ? 'bg-[#24332C]' : 'bg-[#D9DDD8]'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${reminder ? 'left-[22px]' : 'left-0.5'}`} /></button>
        </div>
      </section>
      <section className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Tentang</p>
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3.5 p-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#24332C] text-[#D3E5C7]"><UserRound size={20} /></span><div><p className="text-sm font-bold">Catatan Keuangan</p><p className="mt-1 text-[10px] text-[#858A85]">Versi 1.0.0 PWA</p></div><Check size={17} className="ml-auto text-[#568262]" /></div>
          <p className="border-t border-[#F1F1EF] px-4 py-4 text-xs leading-5 text-[#777E78]">Aplikasi sederhana untuk membantu mencatat pemasukan, pengeluaran, dan memahami kebiasaan keuangan dengan lebih baik.</p>
          <div className="border-t border-[#F1F1EF] px-4 py-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A9F9A]">Identitas Praktikum</p>
            {[['Nama', 'Muhamad Ali Rohman'], ['NIM', '21120124130071'], ['Kelompok', '41'], ['Shift', '6']].map(([label, value]) => <div key={label} className="flex justify-between py-1.5 text-xs"><span className="text-[#858A85]">{label}</span><span className="font-semibold text-[#39443D]">{value}</span></div>)}
          </div>
          <div className="flex items-center gap-2 border-t border-[#F1F1EF] px-4 py-3 text-[10px] text-[#8A8F8A]"><CircleHelp size={14} /> Data profil tersimpan lokal di perangkat ini <ChevronRight size={14} className="ml-auto" /></div>
        </div>
      </section>
    </main>
  );
}
