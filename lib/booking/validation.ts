/**
 * Zod Validation Schemas for Booking System
 * 
 * This module provides runtime validation schemas for all booking-related inputs.
 * All schemas enforce strict type safety and business rules.
 */

import { z } from 'zod';
import { AppointmentStatus } from './types';

// ============================================
// REUSABLE VALIDATION HELPERS
// ============================================

/**
 * UUID v4 format validation
 */
const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

/**
 * Email validation with strict RFC compliance
 */
const emailSchema = z
  .string()
  .email({ message: 'Must be a valid email address' })
  .max(255, 'Email must not exceed 255 characters')
  .toLowerCase()
  .trim();

/**
 * Phone number validation (international format)
 * Allows +, digits, spaces, parentheses, and hyphens
 */
const phoneSchema = z
  .string()
  .regex(
    /^\+?[\d\s\-()]{7,20}$/,
    'Phone number must be 7-20 characters and contain only digits, spaces, +, -, or ()'
  )
  .trim()
  .nullable()
  .optional();

/**
 * ISO 8601 datetime string or Date object
 * Converts to ISO string for consistency
 */
const datetimeSchema = z.union([
  z.string().datetime({ message: 'Must be a valid ISO 8601 datetime string' }),
  z.date().transform((date) => date.toISOString()),
]);

/**
 * Time format validation (HH:mm, 24-hour format)
 */
const timeFormatSchema = z
  .string()
  .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Must be in HH:mm format (e.g., 09:00, 17:30)');

/**
 * IANA timezone validation
 */
const timezoneSchema = z
  .string()
  .min(1, 'Timezone is required')
  .max(100, 'Timezone must not exceed 100 characters')
  .refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid IANA timezone (e.g., America/New_York, Europe/London)' }
  );

/**
 * Day of week validation
 */
const dayOfWeekSchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

/**
 * Appointment status enum validation
 */
const appointmentStatusSchema = z.nativeEnum(AppointmentStatus);

// ============================================
// APPOINTMENT SCHEMAS
// ============================================

/**
 * Schema for creating a new appointment (customer booking)
 * 
 * Validates all required customer input for booking an appointment.
 * Includes business rules like time ordering and duration constraints.
 */
export const createAppointmentSchema = z
  .object({
    // Business reference
    business_id: uuidSchema,

    // Customer identification (optional for guest bookings)
    customer_id: uuidSchema.nullable().optional(),

    // Appointment timing
    start_time: datetimeSchema,
    end_time: datetimeSchema,
    duration_minutes: z
      .number()
      .int('Duration must be a whole number')
      .min(1, 'Duration must be at least 1 minute')
      .max(1440, 'Duration must not exceed 24 hours (1440 minutes)'),

    // Customer information
    customer_email: emailSchema,
    customer_name: z
      .string()
      .min(1, 'Customer name is required')
      .max(255, 'Customer name must not exceed 255 characters')
      .trim(),
    customer_phone: phoneSchema,

    // Optional fields
    notes: z
      .string()
      .max(2000, 'Notes must not exceed 2000 characters')
      .trim()
      .nullable()
      .optional(),
    status: appointmentStatusSchema.optional().default(AppointmentStatus.PENDING),
  })
  .strict() // Reject unknown properties for security
  .refine(
    (data) => {
      // Ensure end_time is after start_time
      const start = typeof data.start_time === 'string' 
        ? new Date(data.start_time) 
        : data.start_time;
      const end = typeof data.end_time === 'string' 
        ? new Date(data.end_time) 
        : data.end_time;
      return end > start;
    },
    {
      message: 'End time must be after start time',
      path: ['end_time'],
    }
  )
  .refine(
    (data) => {
      // Validate that duration matches the time difference
      const start = typeof data.start_time === 'string' 
        ? new Date(data.start_time) 
        : data.start_time;
      const end = typeof data.end_time === 'string' 
        ? new Date(data.end_time) 
        : data.end_time;
      const actualDuration = Math.round((end.getTime() - start.getTime()) / 60000);
      return Math.abs(actualDuration - data.duration_minutes) <= 1; // Allow 1 minute tolerance
    },
    {
      message: 'Duration must match the difference between start and end times',
      path: ['duration_minutes'],
    }
  )
  .refine(
    (data) => {
      // Prevent booking in the past (with 1 minute tolerance for clock skew)
      const start = typeof data.start_time === 'string' 
        ? new Date(data.start_time) 
        : data.start_time;
      return start.getTime() >= Date.now() - 60000;
    },
    {
      message: 'Cannot book appointments in the past',
      path: ['start_time'],
    }
  );

/**
 * Schema for updating an existing appointment
 * 
 * Primarily used for status changes and minor customer detail updates.
 * All fields except id are optional.
 */
export const updateAppointmentSchema = z
  .object({
    // Required identifier
    id: uuidSchema,

    // Status update (most common use case)
    status: appointmentStatusSchema.optional(),

    // Customer detail updates
    customer_email: emailSchema.optional(),
    customer_name: z
      .string()
      .min(1, 'Customer name cannot be empty')
      .max(255, 'Customer name must not exceed 255 characters')
      .trim()
      .optional(),
    customer_phone: phoneSchema,

    // Notes update
    notes: z
      .string()
      .max(2000, 'Notes must not exceed 2000 characters')
      .trim()
      .nullable()
      .optional(),
  })
  .strict() // Reject unknown properties for security
  .refine(
    (data) => {
      // Ensure at least one field to update is provided (besides id)
      const keys = Object.keys(data).filter(key => key !== 'id');
      return keys.length > 0;
    },
    {
      message: 'At least one field must be provided for update',
    }
  );

// ============================================
// BUSINESS SCHEMAS
// ============================================

/**
 * Time range schema for available hours and break times
 */
const timeRangeSchema = z
  .object({
    start: timeFormatSchema,
    end: timeFormatSchema,
  })
  .refine(
    (data) => {
      // Ensure end time is after start time
      const [startHour, startMin] = data.start.split(':').map(Number);
      const [endHour, endMin] = data.end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return endMinutes > startMinutes;
    },
    {
      message: 'End time must be after start time',
      path: ['end'],
    }
  );

/**
 * Schema for creating or updating a business
 * 
 * Validates all business configuration including availability,
 * timezone, and operational settings.
 */
export const createBusinessSchema = z
  .object({
    // Business identification
    business_name: z
      .string()
      .min(1, 'Business name is required')
      .max(255, 'Business name must not exceed 255 characters')
      .trim(),

    // Timezone configuration
    timezone: timezoneSchema,

    // Availability settings
    available_days: z
      .array(dayOfWeekSchema)
      .min(1, 'At least one available day is required')
      .max(7, 'Cannot have more than 7 days')
      .refine(
        (days) => {
          // Ensure no duplicate days
          const uniqueDays = new Set(days);
          return uniqueDays.size === days.length;
        },
        {
          message: 'Available days must be unique',
        }
      ),

    available_hours: timeRangeSchema,

    break_times: z
      .array(timeRangeSchema)
      .max(10, 'Cannot have more than 10 break periods')
      .default([]),

    // Slot configuration
    slot_duration_minutes: z
      .number()
      .int('Slot duration must be a whole number')
      .min(5, 'Slot duration must be at least 5 minutes')
      .max(480, 'Slot duration must not exceed 8 hours (480 minutes)')
      .refine(
        (duration) => {
          // Ensure slot duration divides evenly into common intervals
          return [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 480].includes(duration);
        },
        {
          message: 'Slot duration must be a standard interval (5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, or 480 minutes)',
        }
      ),

    // Status flag
    is_active: z.boolean().default(true),
  })
  .strict() // Reject unknown properties for security
  .refine(
    (data) => {
      // Ensure break times fall within available hours
      const [availStartHour, availStartMin] = data.available_hours.start.split(':').map(Number);
      const [availEndHour, availEndMin] = data.available_hours.end.split(':').map(Number);
      const availStartMinutes = availStartHour * 60 + availStartMin;
      const availEndMinutes = availEndHour * 60 + availEndMin;

      for (const breakTime of data.break_times) {
        const [breakStartHour, breakStartMin] = breakTime.start.split(':').map(Number);
        const [breakEndHour, breakEndMin] = breakTime.end.split(':').map(Number);
        const breakStartMinutes = breakStartHour * 60 + breakStartMin;
        const breakEndMinutes = breakEndHour * 60 + breakEndMin;

        if (breakStartMinutes < availStartMinutes || breakEndMinutes > availEndMinutes) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'All break times must fall within available hours',
      path: ['break_times'],
    }
  )
  .refine(
    (data) => {
      // Ensure break times don't overlap
      const breaks = data.break_times.map((b) => {
        const [startHour, startMin] = b.start.split(':').map(Number);
        const [endHour, endMin] = b.end.split(':').map(Number);
        return {
          start: startHour * 60 + startMin,
          end: endHour * 60 + endMin,
        };
      });

      for (let i = 0; i < breaks.length; i++) {
        for (let j = i + 1; j < breaks.length; j++) {
          const a = breaks[i];
          const b = breaks[j];
          // Check if intervals overlap
          if (a.start < b.end && b.start < a.end) {
            return false;
          }
        }
      }
      return true;
    },
    {
      message: 'Break times must not overlap',
      path: ['break_times'],
    }
  );

// ============================================
// TYPE EXPORTS
// ============================================

/**
 * Inferred TypeScript types from Zod schemas
 * Use these for type-safe function parameters and returns
 */
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse and validate appointment creation input
 * @throws ZodError if validation fails
 */
export function validateCreateAppointment(input: unknown): CreateAppointmentInput {
  return createAppointmentSchema.parse(input);
}

/**
 * Safely parse appointment creation input
 * @returns Success object with data or error object with issues
 */
export function safeValidateCreateAppointment(input: unknown) {
  return createAppointmentSchema.safeParse(input);
}

/**
 * Parse and validate appointment update input
 * @throws ZodError if validation fails
 */
export function validateUpdateAppointment(input: unknown): UpdateAppointmentInput {
  return updateAppointmentSchema.parse(input);
}

/**
 * Safely parse appointment update input
 * @returns Success object with data or error object with issues
 */
export function safeValidateUpdateAppointment(input: unknown) {
  return updateAppointmentSchema.safeParse(input);
}

/**
 * Parse and validate business creation input
 * @throws ZodError if validation fails
 */
export function validateCreateBusiness(input: unknown): CreateBusinessInput {
  return createBusinessSchema.parse(input);
}

/**
 * Safely parse business creation input
 * @returns Success object with data or error object with issues
 */
export function safeValidateCreateBusiness(input: unknown) {
  return createBusinessSchema.safeParse(input);
}