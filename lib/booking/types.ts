/**
 * Booking System Type Definitions
 * Matches the database schema from supabase/migrations/20251125125028_create_booking_system.sql
 */

// ============================================
// ENUMS
// ============================================

/**
 * Appointment status values
 * Enforced by database CHECK constraint
 */
export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

// ============================================
// DATABASE ENTITIES
// ============================================

/**
 * Business entity - represents a business with scheduling capabilities
 * Table: public.businesses
 */
export interface Business {
  id: string;
  owner_id: string;
  business_name: string;
  timezone: string;
  available_days: string[]; // e.g., ["monday", "tuesday", "wednesday"]
  available_hours: {
    start: string; // HH:mm format, e.g., "09:00"
    end: string;   // HH:mm format, e.g., "17:00"
  };
  break_times: Array<{
    start: string; // HH:mm format
    end: string;   // HH:mm format
  }>;
  slot_duration_minutes: number;
  is_active: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Appointment entity - represents a scheduled booking
 * Table: public.appointments
 */
export interface Appointment {
  id: string;
  business_id: string;
  customer_id: string | null; // Null for guest bookings
  start_time: string; // ISO timestamp with timezone
  end_time: string;   // ISO timestamp with timezone
  duration_minutes: number;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  status: AppointmentStatus;
  booking_token: string; // Unique 32-character hex token
  notes: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  cancelled_at: string | null; // ISO timestamp, only set when status is 'cancelled'
}

/**
 * BlockedSlot entity - represents unavailable time periods
 * Table: public.blocked_slots
 */
export interface BlockedSlot {
  id: string;
  business_id: string;
  start_time: string; // ISO timestamp with timezone
  end_time: string;   // ISO timestamp with timezone
  reason: string | null;
  created_by: string; // User ID who created the block
  created_at: string; // ISO timestamp
}

// ============================================
// INPUT TYPES
// ============================================

/**
 * Input data required to create a new appointment
 * Excludes auto-generated fields (id, timestamps, booking_token)
 */
export interface CreateAppointmentInput {
  business_id: string;
  customer_id?: string | null; // Optional - null for guest bookings
  start_time: Date | string; // Can accept Date object or ISO string
  end_time: Date | string;
  duration_minutes: number;
  customer_email: string;
  customer_name: string;
  customer_phone?: string | null;
  notes?: string | null;
  status?: AppointmentStatus; // Defaults to 'pending' if not provided
}

/**
 * Input data required to create a blocked slot
 */
export interface CreateBlockedSlotInput {
  business_id: string;
  start_time: Date | string;
  end_time: Date | string;
  reason?: string | null;
  created_by: string;
}

/**
 * Input data for updating an appointment
 * All fields are optional except id
 */
export interface UpdateAppointmentInput {
  id: string;
  status?: AppointmentStatus;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string | null;
  notes?: string | null;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Simple available time slot
 * Used for displaying available booking times
 */
export interface AvailableSlot {
  start: Date;
  end: Date;
}

/**
 * Available slot with additional metadata
 */
export interface AvailableSlotWithMetadata extends AvailableSlot {
  duration_minutes: number;
  is_available: boolean;
  slot_id?: string; // Optional identifier
}

/**
 * Type guard to check if a value is a valid AppointmentStatus
 */
export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return Object.values(AppointmentStatus).includes(value as AppointmentStatus);
}

/**
 * Helper to convert AppointmentStatus enum to string
 */
export function appointmentStatusToString(status: AppointmentStatus): string {
  return status as string;
}






