'use client';

import { CalendarDay } from './CalendarDay';
import type { CalendarDate } from '@/lib/calendar/types';
import { WEEKDAY_LABELS } from '@/constants/calendar';

interface CalendarGridProps {
  days: CalendarDate[];
  onSelectDate?: (date: Date) => void;
}

export const CalendarGrid = ({ days, onSelectDate }: CalendarGridProps) => {
  return (
    <div className="w-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-gray-600 py-2"
          >
            {label}
          </div>
        ))}
      </div>
      
      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => (
          <CalendarDay
            key={idx}
            day={day}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
};












