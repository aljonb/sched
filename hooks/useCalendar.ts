'use client';

import { useState, useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { getCalendarDays } from '@/lib/calendar/utils';
import type { CalendarConfig, CalendarDate, CalendarView } from '@/lib/calendar/types';
import { DEFAULT_CALENDAR_CONFIG } from '@/constants/calendar';

export const useCalendar = (
  initialDate: Date = new Date(),
  config: Partial<CalendarConfig> = {}
) => {
  const [currentView, setCurrentView] = useState<CalendarView>({
    month: initialDate.getMonth(),
    year: initialDate.getFullYear(),
  });

  const fullConfig: CalendarConfig = {
    ...DEFAULT_CALENDAR_CONFIG,
    ...config,
  };

  const viewDate = new Date(currentView.year, currentView.month, 1);

  const calendarDays = useMemo(
    () => getCalendarDays(viewDate, fullConfig),
    [viewDate, fullConfig]
  );

  const goToNextMonth = () => {
    setCurrentView((prev) => {
      const newMonth = prev.month === 11 ? 0 : prev.month + 1;
      const newYear = prev.month === 11 ? prev.year + 1 : prev.year;
      return { month: newMonth, year: newYear };
    });
  };

  const goToPrevMonth = () => {
    setCurrentView((prev) => {
      const newMonth = prev.month === 0 ? 11 : prev.month - 1;
      const newYear = prev.month === 0 ? prev.year - 1 : prev.year;
      return { month: newMonth, year: newYear };
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentView({
      month: today.getMonth(),
      year: today.getFullYear(),
    });
  };

  return {
    currentView,
    calendarDays,
    goToNextMonth,
    goToPrevMonth,
    goToToday,
    viewDate,
  };
};


