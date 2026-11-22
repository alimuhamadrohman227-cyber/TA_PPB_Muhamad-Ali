export const parseYMD = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

export const getDaysInMonth = (year, month) => {
  if (month === 2) return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

export const getWeekOfMonth = (day) => Math.min(5, Math.max(1, Math.ceil(Number(day) / 7)));

const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const dayNames = ['Sabtu', 'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

export const formatMonthLabel = (year, month) =>
  `${monthNames[Number(month) - 1] || ''}${year ? ` ${year}` : ''}`;

export const formatDayLabel = (value, includeYear = false) => {
  const parsed = typeof value === 'string' ? parseYMD(value) : value;
  if (!parsed) return '-';

  let { year, month, day } = parsed;
  let zMonth = month;
  if (zMonth < 3) {
    zMonth += 12;
    year -= 1;
  }
  const century = Math.floor(year / 100);
  const yearInCentury = year % 100;
  const zeller = (day + Math.floor((13 * (zMonth + 1)) / 5) + yearInCentury +
    Math.floor(yearInCentury / 4) + Math.floor(century / 4) + (5 * century)) % 7;
  const weekdayIndex = zeller;

  return `${dayNames[weekdayIndex]}, ${day} ${monthNames[month - 1]}${includeYear ? ` ${parsed.year}` : ''}`;
};
