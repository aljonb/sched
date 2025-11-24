import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
  format,
} from 'date-fns';
import type { CalendarDate, CalendarConfig } from './types';

export const getCalendarDays = (
  date: Date,
  config: CalendarConfig
): CalendarDate[] => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: config.weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: config.weekStartsOn });

  return eachDayOfInterval({ start: calendarStart, end: calendarEnd }).map((day) => ({
    date: day,
    isCurrentMonth: isSameMonth(day, date),
    isToday: isToday(day),
    isSelected: false,
    isDisabled: false,
  }));
};

export const isDateInRange = (date: Date, min?: Date, max?: Date): boolean => {
  if (min && date < min) return false;
  if (max && date > max) return false;
  return true;
};

export { format, addMonths, subMonths, isSameDay };








