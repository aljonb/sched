/**
 * Server-Side Slot Generation for Booking System
 * 
 * Provides comprehensive slot availability checking with database integration.
 * Respects all business rules, existing appointments, blocked slots, and booking constraints.
 * 
 * @module lib/booking/slots
 */

import { addMinutes, setHours, setMinutes, getDay, isBefore, isAfter } from 'date-fns';
import type { Business, Appointment, BlockedSlot, AvailableSlot } from './types';

/**
 * Generate available time slots for a specific date
 * 
 * Algorithm:
 * 1. Check if date is an available day of week
 * 2. Generate all possible slots based on business hours
 * 3. Filter out past slots (before current time)
 * 4. Filter out slots too soon (min advance booking)
 * 5. Filter out slots too far (max advance booking)
 * 6. Filter out slots during break times
 * 7. Filter out slots with existing appointments
 * 8. Filter out blocked slots
 * 
 * @param business - Business configuration from database
 * @param date - Target date to generate slots for (time portion ignored)
 * @param existingAppointments - Active appointments (pending/confirmed only)
 * @param blockedSlots - Manually blocked time periods
 * @param now - Current time (defaults to Date.now(), useful for testing)
 * @returns Array of available slots (sorted chronologically)
 * 
 * @example
 * ```ts
 * const slots = generateAvailableSlots(
 *   business,
 *   new Date('2025-11-27'),
 *   appointments.filter(a => ['pending', 'confirmed'].includes(a.status)),
 *   blockedSlots
 * );
 * console.log(`${slots.length} available slots found`);
 * ```
 */
export function generateAvailableSlots(
  business: Business,
  date: Date,
  existingAppointments: Appointment[],
  blockedSlots: BlockedSlot[],
  now: Date = new Date()
): AvailableSlot[] {
  // 1. Check if date is an available day
  const dayOfWeek = getDayOfWeekName(date);
  if (!business.available_days.includes(dayOfWeek)) {
    return [];
  }

  // 2. Parse business hours (stored as "HH:mm" strings)
  const { start: startTime, end: endTime } = business.available_hours;
  const [startHour, startMinute] = parseTimeString(startTime);
  const [endHour, endMinute] = parseTimeString(endTime);

  // 3. Create Date objects for day boundaries
  let currentSlotStart = setMinutes(setHours(date, startHour), startMinute);
  const dayEndTime = setMinutes(setHours(date, endHour), endMinute);

  // 4. Calculate booking window boundaries
  const minBookingTime = new Date(now.getTime() + business.min_advance_booking_minutes * 60 * 1000);
  const maxBookingTime = new Date(now.getTime() + business.max_advance_booking_days * 24 * 60 * 60 * 1000);

  const slots: AvailableSlot[] = [];
  const slotDuration = business.slot_duration_minutes;

  // 5. Generate and filter slots
  while (isBefore(currentSlotStart, dayEndTime)) {
    const currentSlotEnd = addMinutes(currentSlotStart, slotDuration);

    // Only process if slot fits within business hours
    if (isBefore(currentSlotEnd, dayEndTime) || currentSlotEnd.getTime() === dayEndTime.getTime()) {
      
      // Apply all filters
      const passesAllFilters = 
        !isBefore(currentSlotEnd, now) &&                                            // Not in the past
        !isBefore(currentSlotStart, minBookingTime) &&                               // Respects min advance
        !isAfter(currentSlotStart, maxBookingTime) &&                                // Respects max advance
        !isSlotDuringBreakTime(currentSlotStart, currentSlotEnd, business.break_times) && // Not during break
        !hasConflictWithAppointments(currentSlotStart, currentSlotEnd, existingAppointments) && // No appointments
        !hasConflictWithBlockedSlots(currentSlotStart, currentSlotEnd, blockedSlots);     // Not blocked

      if (passesAllFilters) {
        slots.push({
          start: new Date(currentSlotStart),
          end: new Date(currentSlotEnd),
        });
      }
    }

    // Move to next slot
    currentSlotStart = addMinutes(currentSlotStart, slotDuration);
  }

  return slots;
}

// ============================================
// HELPER FUNCTIONS (Pure, Testable)
// ============================================

/**
 * Convert Date to lowercase day name (matches DB format)
 * @internal
 */
function getDayOfWeekName(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[getDay(date)];
}

/**
 * Parse "HH:mm" time string to [hour, minute] tuple
 * @internal
 */
function parseTimeString(timeStr: string): [number, number] {
  const [hour, minute] = timeStr.split(':').map(Number);
  return [hour, minute];
}

/**
 * Check if a slot overlaps with any break time
 * @internal
 */
function isSlotDuringBreakTime(
  slotStart: Date,
  slotEnd: Date,
  breakTimes: Array<{ start: string; end: string }>
): boolean {
  if (!breakTimes || breakTimes.length === 0) return false;

  return breakTimes.some((breakTime) => {
    const [breakStartHour, breakStartMinute] = parseTimeString(breakTime.start);
    const [breakEndHour, breakEndMinute] = parseTimeString(breakTime.end);

    // Create break time boundaries on the same day as slot
    const breakStart = setMinutes(setHours(slotStart, breakStartHour), breakStartMinute);
    const breakEnd = setMinutes(setHours(slotStart, breakEndHour), breakEndMinute);

    return hasTimeOverlap(slotStart, slotEnd, breakStart, breakEnd);
  });
}

/**
 * Check if a slot conflicts with existing appointments
 * Only considers active appointments (pending/confirmed)
 * @internal
 */
function hasConflictWithAppointments(
  slotStart: Date,
  slotEnd: Date,
  appointments: Appointment[]
): boolean {
  return appointments.some((apt) => {
    // Double-check status (should already be filtered, but be defensive)
    if (!['pending', 'confirmed'].includes(apt.status)) {
      return false;
    }

    const aptStart = new Date(apt.start_time);
    const aptEnd = new Date(apt.end_time);

    return hasTimeOverlap(slotStart, slotEnd, aptStart, aptEnd);
  });
}

/**
 * Check if a slot conflicts with blocked time periods
 * @internal
 */
function hasConflictWithBlockedSlots(
  slotStart: Date,
  slotEnd: Date,
  blockedSlots: BlockedSlot[]
): boolean {
  return blockedSlots.some((blocked) => {
    const blockedStart = new Date(blocked.start_time);
    const blockedEnd = new Date(blocked.end_time);

    return hasTimeOverlap(slotStart, slotEnd, blockedStart, blockedEnd);
  });
}

/**
 * Check if two time ranges overlap
 * 
 * Uses standard interval overlap logic:
 * Two intervals [A_start, A_end) and [B_start, B_end) overlap if:
 * A_start < B_end AND B_start < A_end
 * 
 * @internal
 */
function hasTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return isBefore(start1, end2) && isBefore(start2, end1);
}

