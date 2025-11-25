import type { Locale } from 'date-fns';

export interface CalendarDate {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}

export interface CalendarView {
  month: number;
  year: number;
}

export interface CalendarConfig {
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  locale?: Locale;
  minDate?: Date;
  maxDate?: Date;
}

export interface CalendarProps {
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
  config?: Partial<CalendarConfig>;
  disabledDates?: Date[];
  highlightedDates?: Date[];
}









