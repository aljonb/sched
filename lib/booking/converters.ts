/**
 * Type Converters for Business Data
 * Handles conversion between client-side BusinessAvailability format
 * and database Business schema format
 */

import type { BusinessAvailability, TimeOfDay, AvailabilityConfig } from '@/lib/availability/types';
import type { Business } from './types';

// ============================================
// DAY CONVERSION MAPS
// ============================================

/**
 * Map from day number (0=Sunday, 6=Saturday) to day name
 */
const DAY_NUMBER_TO_NAME: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * Map from day name to day number (0=Sunday, 6=Saturday)
 */
const DAY_NAME_TO_NUMBER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// ============================================
// TIME CONVERSION FUNCTIONS
// ============================================

/**
 * Convert TimeOfDay object to HH:mm string format
 * @param time - TimeOfDay object with hour and minute
 * @returns String in HH:mm format (e.g., "09:00", "17:30")
 * 
 * @example
 * timeOfDayToString({ hour: 9, minute: 0 }) // "09:00"
 * timeOfDayToString({ hour: 17, minute: 30 }) // "17:30"
 */
export function timeOfDayToString(time: TimeOfDay): string {
  const hour = time.hour.toString().padStart(2, '0');
  const minute = time.minute.toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

/**
 * Convert HH:mm string to TimeOfDay object
 * @param time - String in HH:mm format
 * @returns TimeOfDay object with hour and minute
 * @throws Error if time format is invalid
 * 
 * @example
 * stringToTimeOfDay("09:00") // { hour: 9, minute: 0 }
 * stringToTimeOfDay("17:30") // { hour: 17, minute: 30 }
 */
export function stringToTimeOfDay(time: string): TimeOfDay {
  const parts = time.split(':');
  
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${time}. Expected HH:mm format.`);
  }
  
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  
  if (isNaN(hour) || isNaN(minute)) {
    throw new Error(`Invalid time format: ${time}. Hour and minute must be numbers.`);
  }
  
  if (hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${hour}. Must be between 0 and 23.`);
  }
  
  if (minute < 0 || minute > 59) {
    throw new Error(`Invalid minute: ${minute}. Must be between 0 and 59.`);
  }
  
  return { hour, minute };
}

// ============================================
// BUSINESS DATA CONVERTERS
// ============================================

/**
 * Convert client BusinessAvailability to database Business format
 * 
 * This function transforms the client-side representation of business availability
 * into the format expected by the database schema.
 * 
 * @param availability - Client-side BusinessAvailability object
 * @param config - Availability configuration (slot duration, timezone, etc.)
 * @param ownerId - Clerk user ID of the business owner
 * @returns Database Business object (without auto-generated fields)
 * 
 * @example
 * const dbBusiness = businessAvailabilityToDb(
 *   {
 *     businessName: "My Business",
 *     availableDays: [1, 2, 3, 4, 5], // Mon-Fri
 *     availableHours: {
 *       start: { hour: 9, minute: 0 },
 *       end: { hour: 17, minute: 0 }
 *     }
 *   },
 *   { slotDuration: 60, timezone: 'America/New_York' },
 *   'user_123'
 * );
 */
export function businessAvailabilityToDb(
  availability: BusinessAvailability,
  config: AvailabilityConfig,
  ownerId: string
): Omit<Business, 'id' | 'created_at' | 'updated_at'> {
  // Convert day numbers to day names
  const availableDays = availability.availableDays
    .map((dayNum) => DAY_NUMBER_TO_NAME[dayNum])
    .filter((dayName) => dayName !== undefined);

  // Validate that we have at least one available day
  if (availableDays.length === 0) {
    throw new Error('At least one available day is required');
  }

  // Convert TimeOfDay objects to HH:mm strings
  const availableHours = {
    start: timeOfDayToString(availability.availableHours.start),
    end: timeOfDayToString(availability.availableHours.end),
  };

  // Convert break times if present
  const breakTimes = availability.breakTimes
    ? availability.breakTimes.map((bt) => ({
        start: timeOfDayToString(bt.start),
        end: timeOfDayToString(bt.end),
      }))
    : [];

  return {
    owner_id: ownerId,
    business_name: availability.businessName.trim(),
    timezone: config.timezone ?? 'UTC',
    available_days: availableDays,
    available_hours: availableHours,
    break_times: breakTimes,
    slot_duration_minutes: config.slotDuration ?? 60,
    min_advance_booking_minutes: config.minAdvanceBooking ?? 0,
    max_advance_booking_days: config.maxAdvanceBooking ?? 90,
    is_active: true,
  };
}

/**
 * Convert database Business to client BusinessAvailability format
 * 
 * This function transforms the database representation of a business
 * into the client-side format used throughout the application.
 * 
 * @param business - Database Business object
 * @returns Client-side BusinessAvailability object
 * 
 * @example
 * const availability = dbToBusinessAvailability(dbBusiness);
 * // Returns:
 * // {
 * //   businessName: "My Business",
 * //   availableDays: [1, 2, 3, 4, 5],
 * //   availableHours: {
 * //     start: { hour: 9, minute: 0 },
 * //     end: { hour: 17, minute: 0 }
 * //   }
 * // }
 */
export function dbToBusinessAvailability(business: Business): BusinessAvailability {
  // Convert day names to day numbers
  const availableDays = business.available_days
    .map((dayName) => DAY_NAME_TO_NUMBER[dayName.toLowerCase()])
    .filter((num) => num !== undefined)
    .sort((a, b) => a - b); // Sort to maintain consistent order

  // Convert HH:mm strings to TimeOfDay objects
  const availableHours = {
    start: stringToTimeOfDay(business.available_hours.start),
    end: stringToTimeOfDay(business.available_hours.end),
  };

  // Convert break times if present
  const breakTimes =
    business.break_times && business.break_times.length > 0
      ? business.break_times.map((bt) => ({
          start: stringToTimeOfDay(bt.start),
          end: stringToTimeOfDay(bt.end),
          label: 'Break', // Default label
        }))
      : undefined;

  return {
    businessName: business.business_name,
    availableDays,
    availableHours,
    breakTimes,
  };
}

/**
 * Extract AvailabilityConfig from database Business object
 * 
 * @param business - Database Business object
 * @returns AvailabilityConfig object
 */
export function dbToAvailabilityConfig(business: Business): AvailabilityConfig {
  return {
    slotDuration: business.slot_duration_minutes,
    timezone: business.timezone,
    minAdvanceBooking: business.min_advance_booking_minutes,
    maxAdvanceBooking: business.max_advance_booking_days,
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate that a day name is valid
 */
export function isValidDayName(dayName: string): boolean {
  return dayName.toLowerCase() in DAY_NAME_TO_NUMBER;
}

/**
 * Validate that a day number is valid
 */
export function isValidDayNumber(dayNumber: number): boolean {
  return dayNumber in DAY_NUMBER_TO_NAME;
}






