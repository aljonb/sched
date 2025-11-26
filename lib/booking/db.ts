/**
 * Server-Side Database Helper Functions for Booking System
 * 
 * This module provides typed, secure database access functions using Supabase.
 * All functions respect Row Level Security (RLS) policies defined in migrations.
 * 
 * @module lib/booking/db
 */

import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import type { Business, Appointment, CreateAppointmentInput } from './types';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Result wrapper for database operations
 * Provides consistent error handling across all functions
 */
export type DbResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Date range filter for appointment queries
 */
export interface DateRange {
  startDate: Date | string;
  endDate: Date | string;
}

// ============================================
// BUSINESS QUERIES
// ============================================

/**
 * Fetches a single business by ID
 * 
 * @param id - Business UUID
 * @returns Business object if found and accessible, null otherwise
 * 
 * @security Respects RLS: Only returns businesses the user has access to
 * (public active businesses OR businesses owned by the authenticated user)
 * 
 * @example
 * ```ts
 * const result = await getBusinessById('123e4567-e89b-12d3-a456-426614174000');
 * if (result.success) {
 *   console.log(result.data.business_name);
 * }
 * ```
 */
export async function getBusinessById(
  id: string
): Promise<DbResult<Business | null>> {
  try {
    const supabase = await createClient(cookies());
    
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // Handle "not found" gracefully
      if (error.code === 'PGRST116') {
        return { success: true, data: null };
      }
      return { 
        success: false, 
        error: `Failed to fetch business: ${error.message}` 
      };
    }

    return { success: true, data };
  } catch (err) {
    return { 
      success: false, 
      error: `Unexpected error fetching business: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

// ============================================
// AVAILABILITY QUERIES
// ============================================

/**
 * Checks if a time slot is available for booking
 * 
 * Verifies:
 * - No conflicting appointments (pending/confirmed)
 * - No blocked slots in the time range
 * 
 * @param businessId - Business UUID
 * @param startTime - Start of the time slot
 * @param endTime - End of the time slot
 * @returns true if slot is available, false otherwise
 * 
 * @security Uses database function `check_appointment_conflict` which respects RLS
 * 
 * @example
 * ```ts
 * const result = await checkSlotAvailability(
 *   businessId,
 *   new Date('2025-11-25T10:00:00Z'),
 *   new Date('2025-11-25T10:30:00Z')
 * );
 * if (result.success && result.data) {
 *   console.log('Slot is available!');
 * }
 * ```
 */
export async function checkSlotAvailability(
  businessId: string,
  startTime: Date | string,
  endTime: Date | string
): Promise<DbResult<boolean>> {
  try {
    const supabase = await createClient(cookies());
    
    // Convert to ISO strings if Date objects
    const startTimeStr = startTime instanceof Date ? startTime.toISOString() : startTime;
    const endTimeStr = endTime instanceof Date ? endTime.toISOString() : endTime;

    // Use the database function for conflict checking
    const { data, error } = await supabase.rpc('check_appointment_conflict', {
      p_business_id: businessId,
      p_start_time: startTimeStr,
      p_end_time: endTimeStr,
      p_exclude_appointment_id: null,
    });

    if (error) {
      return { 
        success: false, 
        error: `Failed to check slot availability: ${error.message}` 
      };
    }

    // The function returns true if there IS a conflict, so we negate it
    return { success: true, data: !data };
  } catch (err) {
    return { 
      success: false, 
      error: `Unexpected error checking availability: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

// ============================================
// APPOINTMENT QUERIES
// ============================================

/**
 * Fetches all appointments for a business within a date range
 * 
 * @param businessId - Business UUID
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (inclusive)
 * @returns Array of appointments, sorted by start_time
 * 
 * @security Respects RLS: Only returns appointments if the user is the business owner
 * 
 * @example
 * ```ts
 * const result = await getAppointmentsForBusiness(
 *   businessId,
 *   '2025-11-25T00:00:00Z',
 *   '2025-11-30T23:59:59Z'
 * );
 * if (result.success) {
 *   console.log(`Found ${result.data.length} appointments`);
 * }
 * ```
 */
export async function getAppointmentsForBusiness(
  businessId: string,
  startDate: Date | string,
  endDate: Date | string
): Promise<DbResult<Appointment[]>> {
  try {
    const supabase = await createClient(cookies());
    
    // Convert to ISO strings if Date objects
    const startDateStr = startDate instanceof Date ? startDate.toISOString() : startDate;
    const endDateStr = endDate instanceof Date ? endDate.toISOString() : endDate;

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', businessId)
      .gte('start_time', startDateStr)
      .lte('start_time', endDateStr)
      .order('start_time', { ascending: true });

    if (error) {
      return { 
        success: false, 
        error: `Failed to fetch appointments: ${error.message}` 
      };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { 
      success: false, 
      error: `Unexpected error fetching appointments: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

/**
 * Fetches all appointments for a specific customer
 * 
 * @param customerId - Customer user UUID
 * @returns Array of customer's appointments, sorted by start_time (newest first)
 * 
 * @security Respects RLS: Only returns appointments if the user is the customer
 * 
 * @example
 * ```ts
 * const result = await getAppointmentsByCustomer(userId);
 * if (result.success) {
 *   result.data.forEach(apt => {
 *     console.log(`Appointment at ${apt.start_time}`);
 *   });
 * }
 * ```
 */
export async function getAppointmentsByCustomer(
  customerId: string
): Promise<DbResult<Appointment[]>> {
  try {
    const supabase = await createClient(cookies());

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('customer_id', customerId)
      .order('start_time', { ascending: false });

    if (error) {
      return { 
        success: false, 
        error: `Failed to fetch customer appointments: ${error.message}` 
      };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { 
      success: false, 
      error: `Unexpected error fetching customer appointments: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

/**
 * Fetches a single appointment by booking token
 * Useful for public appointment lookup/cancellation
 * 
 * @param bookingToken - 32-character hex booking token
 * @returns Appointment if found, null otherwise
 * 
 * @security Public access via booking token (like a password)
 * 
 * @example
 * ```ts
 * const result = await getAppointmentByToken('abc123...');
 * if (result.success && result.data) {
 *   console.log(`Appointment for ${result.data.customer_name}`);
 * }
 * ```
 */
export async function getAppointmentByToken(
  bookingToken: string
): Promise<DbResult<Appointment | null>> {
  try {
    const supabase = await createClient(cookies());

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('booking_token', bookingToken)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: null };
      }
      return { 
        success: false, 
        error: `Failed to fetch appointment: ${error.message}` 
      };
    }

    return { success: true, data };
  } catch (err) {
    return { 
      success: false, 
      error: `Unexpected error fetching appointment: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

// ============================================
// APPOINTMENT MUTATIONS
// ============================================

/**
 * Creates a new appointment
 * 
 * @param input - Appointment creation data
 * @returns Created Appointment object with booking token
 * 
 * @security Respects RLS: Public can create appointments for any active business
 * 
 * @example
 * ```ts
 * const result = await createAppointment({
 *   business_id: 'business-uuid',
 *   start_time: new Date('2025-11-26T14:00:00Z'),
 *   end_time: new Date('2025-11-26T15:00:00Z'),
 *   duration_minutes: 60,
 *   customer_email: 'customer@example.com',
 *   customer_name: 'John Doe',
 *   customer_phone: '+1234567890',
 *   notes: 'First appointment',
 * });
 * if (result.success) {
 *   console.log(`Booked! Token: ${result.data.booking_token}`);
 * }
 * ```
 */
export async function createAppointment(
  input: CreateAppointmentInput
): Promise<DbResult<Appointment>> {
  try {
    const supabase = await createClient(cookies());
    
    // Convert dates to ISO strings if needed
    const startTimeStr = input.start_time instanceof Date 
      ? input.start_time.toISOString() 
      : input.start_time;
    const endTimeStr = input.end_time instanceof Date 
      ? input.end_time.toISOString() 
      : input.end_time;

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        business_id: input.business_id,
        customer_id: input.customer_id ?? null,
        start_time: startTimeStr,
        end_time: endTimeStr,
        duration_minutes: input.duration_minutes,
        customer_email: input.customer_email,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone ?? null,
        notes: input.notes ?? null,
        status: input.status ?? 'pending',
      })
      .select()
      .single();

    if (error) {
      return { 
        success: false, 
        error: `Failed to create appointment: ${error.message}` 
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Failed to create appointment: No data returned'
      };
    }

    return { success: true, data };
  } catch (err) {
    return { 
      success: false, 
      error: `Unexpected error creating appointment: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

/**
 * Fetches booked time slots for a business within a date range
 * Returns only start_time and end_time (no customer info)
 * 
 * @param businessId - Business UUID
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Array of time ranges that are booked
 * 
 * @security Public access - only returns time slots, not appointment details
 * 
 * @example
 * ```ts
 * const result = await getBookedSlotsForBusiness(
 *   businessId,
 *   new Date('2025-11-25T00:00:00Z'),
 *   new Date('2025-11-25T23:59:59Z')
 * );
 * if (result.success) {
 *   console.log(`Found ${result.data.length} booked slots`);
 * }
 * ```
 */
export async function getBookedSlotsForBusiness(
  businessId: string,
  startDate: Date | string,
  endDate: Date | string
): Promise<DbResult<Array<{ start_time: string; end_time: string }>>> {
  try {
    const supabase = await createClient(cookies());
    
    // Convert to ISO strings if Date objects
    const startDateStr = startDate instanceof Date ? startDate.toISOString() : startDate;
    const endDateStr = endDate instanceof Date ? endDate.toISOString() : endDate;

    const { data, error } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('business_id', businessId)
      .in('status', ['pending', 'confirmed']) // Only active appointments
      .gte('start_time', startDateStr)
      .lte('start_time', endDateStr)
      .order('start_time', { ascending: true });

    if (error) {
      return { 
        success: false, 
        error: `Failed to fetch booked slots: ${error.message}` 
      };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { 
      success: false, 
      error: `Unexpected error fetching booked slots: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

/**
 * Fetches blocked slots for a business within a date range
 * 
 * @param businessId - Business UUID
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Array of blocked time periods
 * 
 * @security Respects RLS: Only returns blocked slots if the user is the business owner
 * 
 * @example
 * ```ts
 * const result = await getBlockedSlotsForBusiness(
 *   businessId,
 *   new Date('2025-11-25T00:00:00Z'),
 *   new Date('2025-11-30T23:59:59Z')
 * );
 * if (result.success) {
 *   console.log(`Found ${result.data.length} blocked slots`);
 * }
 * ```
 */
export async function getBlockedSlotsForBusiness(
  businessId: string,
  startDate: Date | string,
  endDate: Date | string
): Promise<DbResult<import('./types').BlockedSlot[]>> {
  try {
    const supabase = await createClient(cookies());
    
    // Convert to ISO strings if Date objects
    const startDateStr = startDate instanceof Date ? startDate.toISOString() : startDate;
    const endDateStr = endDate instanceof Date ? endDate.toISOString() : endDate;

    const { data, error } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('business_id', businessId)
      .gte('start_time', startDateStr)
      .lte('start_time', endDateStr)
      .order('start_time', { ascending: true });

    if (error) {
      return { 
        success: false, 
        error: `Failed to fetch blocked slots: ${error.message}` 
      };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { 
      success: false, 
      error: `Unexpected error fetching blocked slots: ${err instanceof Error ? err.message : 'Unknown error'}` 
    };
  }
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Re-export types for convenience
 */
export type { Business, Appointment, BlockedSlot } from './types';





