/**
 * Represents the time of day in 24-hour format
 */
export interface TimeOfDay {
  /** Hour in 24-hour format (0-23) */
  hour: number;
  /** Minute (0-59) */
  minute: number;
}

/**
 * Represents a business's availability schedule
 */
export interface BusinessAvailability {
  /** Name of the business */
  businessName: string;
  /** Array of available days (0 = Sunday, 6 = Saturday) */
  availableDays: number[];
  /** Available hours for each day */
  availableHours: {
    /** Start time of availability */
    start: TimeOfDay;
    /** End time of availability */
    end: TimeOfDay;
  };
  /** Break times (e.g., lunch breaks) - optional */
  breakTimes?: Array<{
    /** Start time of break */
    start: TimeOfDay;
    /** End time of break */
    end: TimeOfDay;
    /** Optional label (e.g., "Lunch") */
    label?: string;
  }>;
}

/**
 * Configuration options for availability checking and display
 */
export interface AvailabilityConfig {
  /** Minimum advance booking time in minutes */
  minAdvanceBooking?: number;
  /** Maximum advance booking time in days */
  maxAdvanceBooking?: number;
  /** Duration of each time slot in minutes */
  slotDuration?: number;
  /** Buffer time between slots in minutes */
  bufferTime?: number;
  /** Time zone identifier (e.g., 'America/New_York') */
  timezone?: string;
}

/**
 * Represents a bookable time slot
 */
export interface TimeSlot {
  /** Start date and time of the slot */
  start: Date;
  /** End date and time of the slot */
  end: Date;
  /** Whether the slot is currently available for booking */
  isAvailable: boolean;
  /** Optional slot identifier */
  id?: string;
}

