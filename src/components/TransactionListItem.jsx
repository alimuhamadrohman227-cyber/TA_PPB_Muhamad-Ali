import { ArrowDownLeft, ArrowUpRight, BusFront, CircleEllipsis, Cloud, ReceiptText, ShoppingBag, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';
import { currency, formatDate, transactionIcon } from '../utils/format.js';

const icons = { food: Utensils, shopping: ShoppingBag, transport: BusFront, bill: ReceiptText, other: CircleEllipsis };

export default function TransactionListItem({ transaction, className = '', style }) {
  const income = transaction.type === 'income';
  const Icon = income ? ArrowDownLeft : icons[transactionIcon(transaction.category)];
  const detailPath = `${income ? '/pemasukan' : '/pengeluaran'}/${transaction.id}`;
  return (
    <Link to={detailPath} style={style} className={`flex items-center gap-3.5 border-b border-[#F1F1EF] py-3.5 last:border-b-0 active:scale-[0.98] ${className}`}>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${income ? 'bg-[#EAF5E9] text-[#278347]' : 'bg-[#F4F2ED] text-[#626D65]'}`}><Icon size={19} /></div>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-body font-medium text-[#303A34]">
          <span className="truncate">{transaction.title}</span>
          {transaction._syncPending && <Cloud size={13} className="shrink-0 text-[#8A918C]" aria-label="Belum tersinkron" title="Belum tersinkron" />}
        </p>
        <p className="caption mt-1 truncate">{transaction.category} <span className="px-1">·</span> {formatDate(transaction.date, { day: 'numeric', month: 'short' })}</p>
      </div>
      <p className={`money shrink-0 text-sm font-bold ${income ? 'text-[#15803D]' : 'text-[#DC2626]'}`}>{income ? '+' : '-'}{currency(transaction.amount)}</p>
    </Link>
  );
}
