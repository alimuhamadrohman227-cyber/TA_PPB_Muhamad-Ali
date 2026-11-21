import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeading from '../components/PageHeading.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import { createTransaction } from '../services/api.js';

export default function TambahTransaksi() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const requestedType = location.state?.type ?? searchParams.get('type');
  const initialType = requestedType === 'income' ? 'income' : 'expense';
  const save = async (data) => {
    try {
      await createTransaction(data);
      navigate(data.type === 'income' ? '/pemasukan' : '/', { replace: true });
    } catch (cause) {
      setError(cause.message || 'Transaksi gagal disimpan.');
    }
  };
  return (
    <main className="page-pad">
      <PageHeading title="Catat Transaksi" subtitle="CATATAN BARU" />
      <section className="card p-5">
        <p className="mb-5 text-xs leading-5 text-[#858A85]">Lengkapi detail transaksi untuk menjaga catatan keuanganmu tetap rapi.</p>
        {error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
        <TransactionForm key={initialType} initial={{ type: initialType }} onSubmit={save} />
      </section>
    </main>
  );
}
