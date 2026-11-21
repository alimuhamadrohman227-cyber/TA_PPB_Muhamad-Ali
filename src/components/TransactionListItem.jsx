import { ArrowDownLeft, ArrowUpRight, BusFront, CircleEllipsis, ReceiptText, ShoppingBag, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';
import { currency, formatDate, transactionIcon } from '../utils/format.js';

const icons = { food: Utensils, shopping: ShoppingBag, transport: BusFront, bill: ReceiptText, other: CircleEllipsis };

export default function TransactionListItem({ transaction }) {
  const income = transaction.type === 'income';
  const Icon = income ? ArrowDownLeft : icons[transactionIcon(transaction.category)];
  const detailPath = `${income ? '/pemasukan' : '/pengeluaran'}/${transaction.id}`;
  return (
    <Link to={detailPath} className="flex items-center gap-3.5 border-b border-[#F1F1EF] py-4 last:border-b-0">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${income ? 'bg-[#EAF5E9] text-[#278347]' : 'bg-[#F4F2ED] text-[#626D65]'}`}><Icon size={19} strokeWidth={1.8} /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#303A34]">{transaction.title}</p>
        <p className="mt-1 truncate text-[11px] text-[#8A8F8A]">{transaction.category} <span className="px-1">·</span> {formatDate(transaction.date, { day: 'numeric', month: 'short' })}</p>
      </div>
      <p className={`shrink-0 text-sm font-bold ${income ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{income ? '+' : '-'}{currency(transaction.amount)}</p>
    </Link>
  );
}
