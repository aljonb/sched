'use client';

import { format } from 'date-fns';
import type { CalendarDate } from '@/lib/calendar/types';

interface CalendarDayProps {
  day: CalendarDate;
  onSelect?: (date: Date) => void;
}

export const CalendarDay = ({ day, onSelect }: CalendarDayProps) => {
  const handleClick = () => {
    if (!day.isDisabled && onSelect) {
      onSelect(day.date);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={day.isDisabled}
      className={`
        aspect-square p-2 text-sm rounded-lg transition-colors
        ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
        ${day.isToday ? 'ring-2 ring-blue-500' : ''}
        ${day.isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}
        ${day.isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {format(day.date, 'd')}
    </button>
  );
};




