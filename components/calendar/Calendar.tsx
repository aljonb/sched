'use client';

import { useState, useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { useCalendar } from '@/hooks/useCalendar';
import { CalendarHeader } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import type { CalendarProps } from '@/lib/calendar/types';

export const Calendar = ({
  selectedDate,
  onSelectDate,
  config,
  disabledDates = [],
  highlightedDates = [],
}: CalendarProps) => {
  const [internalSelected, setInternalSelected] = useState<Date | undefined>(selectedDate);
  
  const {
    currentView,
    calendarDays,
    goToNextMonth,
    goToPrevMonth,
    goToToday,
  } = useCalendar(selectedDate, config);

  // Enhance days with selection/disabled state
  const enhancedDays = useMemo(() => {
    return calendarDays.map((day) => ({
      ...day,
      isSelected: internalSelected ? isSameDay(day.date, internalSelected) : false,
      isDisabled: disabledDates.some((d) => isSameDay(d, day.date)),
      isHighlighted: highlightedDates.some((d) => isSameDay(d, day.date)),
    }));
  }, [calendarDays, internalSelected, disabledDates, highlightedDates]);

  const handleSelectDate = (date: Date) => {
    setInternalSelected(date);
    onSelectDate?.(date);
  };

  return (
    <div className="w-full max-w-md p-4 bg-white rounded-lg shadow">
      <CalendarHeader
        month={currentView.month}
        year={currentView.year}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
      />
      <CalendarGrid
        days={enhancedDays}
        onSelectDate={handleSelectDate}
      />
    </div>
  );
};


