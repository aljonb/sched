'use client';

import { MONTH_LABELS } from '@/constants/calendar';

interface CalendarHeaderProps {
  month: number;
  year: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export const CalendarHeader = ({
  month,
  year,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold">
        {MONTH_LABELS[month]} {year}
      </h2>
      
      <div className="flex gap-2">
        <button
          onClick={onToday}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          Today
        </button>
        <button
          onClick={onPrevMonth}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Previous month"
        >
          ←
        </button>
        <button
          onClick={onNextMonth}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Next month"
        >
          →
        </button>
      </div>
    </div>
  );
};


