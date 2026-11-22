import { useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from './EmptyState.jsx';
import SectionHeader from './SectionHeader.jsx';
import TransactionListItem from './TransactionListItem.jsx';
import { formatDayLabel, formatMonthLabel } from '../utils/helpers.js';
import { groupByDay, groupByMonth, groupByWeek } from '../utils/groupTransactions.js';

const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

function Items({ items }) {
  return (
    <div className="px-4">
      {items.map((item) => <TransactionListItem key={item.id} transaction={item} />)}
    </div>
  );
}

export default function TransactionGroupList({
  period,
  transactions,
  type,
  title,
  emptyDescription,
  actionLabel,
}) {
  const tone = type;
  const dayGroups = useMemo(() => groupByDay(transactions), [transactions]);
  const weekGroups = useMemo(() => groupByWeek(transactions), [transactions]);
  const monthGroups = useMemo(() => groupByMonth(transactions), [transactions]);

  const allKeys = useMemo(() => {
    if (period === 'Harian') return dayGroups.map((group) => group.key);
    if (period === 'Mingguan') return weekGroups.flatMap((month) => month.weeks.map((week) => week.key));
    return monthGroups.flatMap((year) => year.months.map((month) => month.key));
  }, [period, dayGroups, weekGroups, monthGroups]);

  const latestKey = allKeys[0];
  const [openKeys, setOpenKeys] = useState(() => new Set(period === 'Harian' ? allKeys : latestKey ? [latestKey] : []));
  const seenKeys = useRef(new Set(allKeys));

  useEffect(() => {
    setOpenKeys((current) => {
      const next = new Set([...current].filter((key) => allKeys.includes(key)));
      allKeys.forEach((key) => {
        if (!seenKeys.current.has(key)) {
          if (period === 'Harian' || key === latestKey) next.add(key);
        }
      });
      seenKeys.current = new Set(allKeys);
      return next;
    });
  }, [allKeys, latestKey, period]);

  const toggle = (key) => setOpenKeys((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  if (!transactions.length) {
    return (
      <div className="pb-32">
        <EmptyState
          title={title === 'Daftar Pengeluaran' ? 'Belum ada catatan pengeluaran' : 'Belum ada pemasukan'}
          description={emptyDescription}
          actionLabel={actionLabel}
          actionType={type}
        />
      </div>
    );
  }

  if (period === 'Harian') {
    const distinctYears = new Set(dayGroups.map((group) => group.year)).size;
    let previousYear = null;
    return (
      <div className="space-y-3 pb-32">
        {dayGroups.map((group) => {
          const showYear = distinctYears > 1 && (previousYear !== group.year);
          previousYear = group.year;
          return (
            <div key={group.key}>
              {showYear && <p className="mb-2 mt-1 px-1 text-xs font-bold text-[#6F756F]">{group.year}</p>}
              <section className="card overflow-hidden">
                <SectionHeader
                  title={formatDayLabel(group, distinctYears > 1)}
                  total={group.total}
                  count={group.count}
                  tone={tone}
                  collapsible
                  open={openKeys.has(group.key)}
                  onToggle={() => toggle(group.key)}
                />
                {openKeys.has(group.key) && <Items items={group.items} />}
              </section>
            </div>
          );
        })}
      </div>
    );
  }

  if (period === 'Mingguan') {
    return (
      <div className="space-y-5 pb-32">
        {weekGroups.map((month) => (
          <section key={month.key}>
            <div className="mb-2 px-1">
              <SectionHeader title={formatMonthLabel(month.year, month.month)} total={month.total} count={month.count} tone={tone} />
            </div>
            <div className="space-y-3">
              {month.weeks.map((week) => (
                <section key={week.key} className="card overflow-hidden">
                  <SectionHeader
                    title={`Minggu ${week.week} · ${week.start}${week.start !== week.end ? `-${week.end}` : ''} ${monthShort[month.month - 1]}`}
                    total={week.total}
                    count={week.count}
                    tone={tone}
                    collapsible
                    open={openKeys.has(week.key)}
                    onToggle={() => toggle(week.key)}
                  />
                  {openKeys.has(week.key) && <Items items={week.items} />}
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-32">
      {monthGroups.map((year) => (
        <section key={year.key}>
          <div className="mb-2 flex items-center justify-between px-1 py-2">
            <h3 className="text-base font-bold text-[#303A34]">{year.year}</h3>
            <p className={`text-sm font-bold ${type === 'income' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
              {type === 'income' ? '+' : '-'}Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(year.total))}
            </p>
          </div>
          <div className="space-y-3">
            {year.months.map((month) => (
              <section key={month.key} className="card overflow-hidden">
                <SectionHeader
                  title={formatMonthLabel(month.year, month.month)}
                  total={month.total}
                  count={month.count}
                  tone={tone}
                  collapsible
                  open={openKeys.has(month.key)}
                  onToggle={() => toggle(month.key)}
                />
                {openKeys.has(month.key) && <Items items={month.items} />}
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
