import {
  eachDayOfInterval,
  addDays,
  addMinutes,
  setHours,
  setMinutes,
  getDay,
  isAfter,
  isBefore,
  startOfDay,
} from 'date-fns';
import type {
  BusinessAvailability,
  AvailabilityConfig,
  TimeSlot,
  TimeOfDay,
} from './types';

/**
 * Calculate disabled dates based on availability rules.
 * Returns an array of Date objects that should be disabled in the calendar.
 *
 * @param availability - Business availability configuration
 * @param startDate - Start date of the range to check
 * @param endDate - End date of the range to check
 * @returns Array of disabled dates
 *
 * @example
 * // If only Mon/Wed/Fri (1,3,5) are available
 * const availability = {
 *   businessName: 'My Business',
 *   availableDays: [1, 3, 5],
 *   availableHours: { start: { hour: 9, minute: 0 }, end: { hour: 17, minute: 0 } }
 * };
 * const disabled = getDisabledDates(availability, startDate, endDate);
 * // Returns all Sundays, Tuesdays, Thursdays, and Saturdays in range
 */
export const getDisabledDates = (
  availability: BusinessAvailability,
  startDate: Date,
  endDate: Date
): Date[] => {
  const allDates = eachDayOfInterval({ start: startDate, end: endDate });
  
  return allDates.filter((date) => {
    const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
    return !availability.availableDays.includes(dayOfWeek);
  });
};

/**
 * Calculate disabled dates considering both availability rules and booking constraints.
 * Respects minAdvanceBooking and maxAdvanceBooking from config.
 *
 * @param availability - Business availability configuration
 * @param startDate - Start date of the range to check
 * @param endDate - End date of the range to check
 * @param config - Optional availability configuration
 * @param now - Optional current date/time (defaults to now, useful for testing)
 * @returns Array of disabled dates
 */
export const getDisabledDatesWithConfig = (
  availability: BusinessAvailability,
  startDate: Date,
  endDate: Date,
  config?: AvailabilityConfig,
  now: Date = new Date()
): Date[] => {
  const allDates = eachDayOfInterval({ start: startDate, end: endDate });
  const disabledDates: Date[] = [];

  for (const date of allDates) {
    const dayOfWeek = getDay(date);
    const dateStart = startOfDay(date);

    // Check if day of week is not available
    if (!availability.availableDays.includes(dayOfWeek)) {
      disabledDates.push(date);
      continue;
    }

    // Check minimum advance booking (in minutes)
    if (config?.minAdvanceBooking) {
      const minBookingDate = addMinutes(now, config.minAdvanceBooking);
      if (isBefore(dateStart, startOfDay(minBookingDate))) {
        disabledDates.push(date);
        continue;
      }
    }

    // Check maximum advance booking (in days)
    if (config?.maxAdvanceBooking) {
      const maxBookingDate = addDays(startOfDay(now), config.maxAdvanceBooking);
      if (isAfter(dateStart, maxBookingDate)) {
        disabledDates.push(date);
        continue;
      }
    }
  }

  return disabledDates;
};

/**
 * Generate time slots for a specific date based on availability rules.
 *
 * @param date - The date to generate slots for
 * @param availability - Business availability configuration
 * @param config - Optional availability configuration for slot duration and buffer
 * @param bookedSlots - Optional array of already booked time slots
 * @returns Array of time slots
 *
 * @example
 * const slots = generateTimeSlots(
 *   new Date('2025-01-15'),
 *   { availableHours: { start: { hour: 9, minute: 0 }, end: { hour: 17, minute: 0 } } },
 *   { slotDuration: 60, bufferTime: 15 }
 * );
 * // Returns slots: 9:00-10:00, 10:15-11:15, 11:30-12:30, etc.
 */
export const generateTimeSlots = (
  date: Date,
  availability: BusinessAvailability,
  config?: AvailabilityConfig,
  bookedSlots: TimeSlot[] = []
): TimeSlot[] => {
  const dayOfWeek = getDay(date);
  
  // Return empty array if date is not available
  if (!availability.availableDays.includes(dayOfWeek)) {
    return [];
  }

  const slotDuration = config?.slotDuration ?? 60; // Default 60 minutes
  const bufferTime = config?.bufferTime ?? 0; // Default 0 minutes
  const { start, end } = availability.availableHours;

  // Create start and end times for the day
  let currentTime = setMinutes(setHours(date, start.hour), start.minute);
  const endTime = setMinutes(setHours(date, end.hour), end.minute);

  const slots: TimeSlot[] = [];

  while (isBefore(currentTime, endTime)) {
    const slotEnd = addMinutes(currentTime, slotDuration);
    
    // Only add slot if it fits within available hours
    if (isBefore(slotEnd, endTime) || slotEnd.getTime() === endTime.getTime()) {
      const isBooked = isSlotBooked(currentTime, slotEnd, bookedSlots);
      const isDuringBreak = isSlotDuringBreak(currentTime, slotEnd, availability.breakTimes);
      const isAvailable = !isBooked && !isDuringBreak;
      
      slots.push({
        start: new Date(currentTime),
        end: new Date(slotEnd),
        isAvailable,
        id: `${date.toISOString()}-${currentTime.getTime()}`,
      });
    }

    // Move to next slot (add duration + buffer)
    currentTime = addMinutes(currentTime, slotDuration + bufferTime);
  }

  return slots;
};

/**
 * Check if a time slot overlaps with any break times.
 * Pure function - no side effects.
 *
 * @param slotStart - Start time of the slot
 * @param slotEnd - End time of the slot
 * @param breakTimes - Array of break time ranges
 * @returns True if the slot overlaps with a break, false otherwise
 */
const isSlotDuringBreak = (
  slotStart: Date,
  slotEnd: Date,
  breakTimes?: Array<{ start: TimeOfDay; end: TimeOfDay }>
): boolean => {
  if (!breakTimes || breakTimes.length === 0) return false;

  return breakTimes.some((breakTime) => {
    const breakStart = setMinutes(
      setHours(slotStart, breakTime.start.hour),
      breakTime.start.minute
    );
    const breakEnd = setMinutes(
      setHours(slotStart, breakTime.end.hour),
      breakTime.end.minute
    );

    // Check for any overlap
    return (
      (isAfter(slotStart, breakStart) && isBefore(slotStart, breakEnd)) ||
      (isAfter(slotEnd, breakStart) && isBefore(slotEnd, breakEnd)) ||
      (isBefore(slotStart, breakStart) && isAfter(slotEnd, breakEnd)) ||
      slotStart.getTime() === breakStart.getTime()
    );
  });
};

/**
 * Check if a time slot overlaps with any booked slots.
 *
 * @param slotStart - Start time of the slot to check
 * @param slotEnd - End time of the slot to check
 * @param bookedSlots - Array of booked time slots
 * @returns True if the slot is booked (overlaps), false otherwise
 */
const isSlotBooked = (
  slotStart: Date,
  slotEnd: Date,
  bookedSlots: TimeSlot[]
): boolean => {
  return bookedSlots.some((booked) => {
    // Check for any overlap
    return (
      (isAfter(slotStart, booked.start) && isBefore(slotStart, booked.end)) ||
      (isAfter(slotEnd, booked.start) && isBefore(slotEnd, booked.end)) ||
      (isBefore(slotStart, booked.start) && isAfter(slotEnd, booked.end)) ||
      slotStart.getTime() === booked.start.getTime()
    );
  });
};

/**
 * Validate availability configuration values.
 *
 * @param config - Availability configuration to validate
 * @returns Object with isValid flag and array of error messages
 *
 * @example
 * const result = validateAvailabilityConfig({ slotDuration: -30 });
 * // Returns: { isValid: false, errors: ['Slot duration must be positive'] }
 */
export const validateAvailabilityConfig = (
  config: AvailabilityConfig
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (config.minAdvanceBooking !== undefined) {
    if (config.minAdvanceBooking < 0) {
      errors.push('Minimum advance booking must be non-negative');
    }
  }

  if (config.maxAdvanceBooking !== undefined) {
    if (config.maxAdvanceBooking <= 0) {
      errors.push('Maximum advance booking must be positive');
    }
  }

  if (config.slotDuration !== undefined) {
    if (config.slotDuration <= 0) {
      errors.push('Slot duration must be positive');
    }
  }

  if (config.bufferTime !== undefined) {
    if (config.bufferTime < 0) {
      errors.push('Buffer time must be non-negative');
    }
  }

  if (
    config.minAdvanceBooking !== undefined &&
    config.maxAdvanceBooking !== undefined
  ) {
    // Convert to same units (days) for comparison
    const minInDays = config.minAdvanceBooking / (24 * 60);
    if (minInDays > config.maxAdvanceBooking) {
      errors.push(
        'Minimum advance booking cannot exceed maximum advance booking'
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate business availability configuration.
 *
 * @param availability - Business availability to validate
 * @returns Object with isValid flag and array of error messages
 */
export const validateBusinessAvailability = (
  availability: BusinessAvailability
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!availability.businessName || availability.businessName.trim() === '') {
    errors.push('Business name is required');
  }

  if (!availability.availableDays || availability.availableDays.length === 0) {
    errors.push('At least one available day is required');
  } else {
    const invalidDays = availability.availableDays.filter(
      (day) => day < 0 || day > 6
    );
    if (invalidDays.length > 0) {
      errors.push('Available days must be between 0 (Sunday) and 6 (Saturday)');
    }
  }

  const { start, end } = availability.availableHours;
  
  if (!isValidTimeOfDay(start)) {
    errors.push('Invalid start time');
  }
  
  if (!isValidTimeOfDay(end)) {
    errors.push('Invalid end time');
  }

  if (isValidTimeOfDay(start) && isValidTimeOfDay(end)) {
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;
    
    if (startMinutes >= endMinutes) {
      errors.push('End time must be after start time');
    }
  }

  // Validate break times
  if (availability.breakTimes) {
    availability.breakTimes.forEach((breakTime, idx) => {
      if (!isValidTimeOfDay(breakTime.start)) {
        errors.push(`Break time ${idx + 1}: Invalid start time`);
      }
      if (!isValidTimeOfDay(breakTime.end)) {
        errors.push(`Break time ${idx + 1}: Invalid end time`);
      }
      
      if (isValidTimeOfDay(breakTime.start) && isValidTimeOfDay(breakTime.end)) {
        const breakStartMinutes = breakTime.start.hour * 60 + breakTime.start.minute;
        const breakEndMinutes = breakTime.end.hour * 60 + breakTime.end.minute;
        
        if (breakStartMinutes >= breakEndMinutes) {
          errors.push(`Break time ${idx + 1}: End time must be after start time`);
        }
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate TimeOfDay object.
 *
 * @param time - Time to validate
 * @returns True if valid, false otherwise
 */
const isValidTimeOfDay = (time: TimeOfDay): boolean => {
  return (
    time.hour >= 0 &&
    time.hour <= 23 &&
    time.minute >= 0 &&
    time.minute <= 59
  );
};

/**
 * Convert availability rules to array of available date ranges.
 * Useful for visualization or complex date calculations.
 *
 * @param availability - Business availability configuration
 * @param startDate - Start date of the range
 * @param endDate - End date of the range
 * @returns Array of objects with start and end dates for available periods
 *
 * @example
 * // Returns ranges for all Mondays, Wednesdays, and Fridays
 * const ranges = getAvailableDateRanges(availability, startDate, endDate);
 * // [{ start: Mon Jan 1, end: Mon Jan 1 }, { start: Wed Jan 3, end: Wed Jan 3 }, ...]
 */
export const getAvailableDateRanges = (
  availability: BusinessAvailability,
  startDate: Date,
  endDate: Date
): Array<{ start: Date; end: Date }> => {
  const allDates = eachDayOfInterval({ start: startDate, end: endDate });
  const ranges: Array<{ start: Date; end: Date }> = [];

  for (const date of allDates) {
    const dayOfWeek = getDay(date);
    
    if (availability.availableDays.includes(dayOfWeek)) {
      const { start, end } = availability.availableHours;
      
      const rangeStart = setMinutes(setHours(date, start.hour), start.minute);
      const rangeEnd = setMinutes(setHours(date, end.hour), end.minute);
      
      ranges.push({
        start: rangeStart,
        end: rangeEnd,
      });
    }
  }

  return ranges;
};

/**
 * Check if a specific date is available based on availability rules.
 *
 * @param date - Date to check
 * @param availability - Business availability configuration
 * @returns True if the date is available, false otherwise
 */
export const isDateAvailable = (
  date: Date,
  availability: BusinessAvailability
): boolean => {
  const dayOfWeek = getDay(date);
  return availability.availableDays.includes(dayOfWeek);
};

/**
 * Format TimeOfDay to string (HH:MM format).
 *
 * @param time - Time to format
 * @returns Formatted time string
 *
 * @example
 * formatTimeOfDay({ hour: 9, minute: 30 }) // "09:30"
 */
export const formatTimeOfDay = (time: TimeOfDay): string => {
  const hour = time.hour.toString().padStart(2, '0');
  const minute = time.minute.toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

/**
 * Parse time string to TimeOfDay object.
 *
 * @param timeString - Time string in HH:MM format
 * @returns TimeOfDay object or null if invalid
 *
 * @example
 * parseTimeString("09:30") // { hour: 9, minute: 30 }
 */
export const parseTimeString = (timeString: string): TimeOfDay | null => {
  const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  
  if (!match) return null;
  
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  
  return { hour, minute };
};

