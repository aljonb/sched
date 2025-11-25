'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { addMonths } from 'date-fns';
import type { BusinessAvailability, AvailabilityConfig } from '@/lib/availability/types';
import { 
  getDisabledDatesWithConfig,
  validateBusinessAvailability,
  validateAvailabilityConfig,
} from '@/lib/availability/utils';

const STORAGE_KEY = 'business-availability';
const CONFIG_STORAGE_KEY = 'availability-config';

interface UseAvailabilityReturn {
  /** Whether availability has been configured */
  configured: boolean;
  /** Current business availability configuration */
  availability: BusinessAvailability | null;
  /** Current availability config (slot duration, booking windows, etc.) */
  config: AvailabilityConfig | null;
  /** Save availability configuration to state and localStorage */
  saveAvailability: (availability: BusinessAvailability, config?: AvailabilityConfig) => void;
  /** Clear availability configuration from state and localStorage */
  clearAvailability: () => void;
  /** Get disabled dates for a date range based on current availability */
  getDisabledDates: (startDate: Date, endDate: Date) => Date[];
  /** Update only the availability config (not business availability) */
  updateConfig: (config: AvailabilityConfig) => void;
  /** Validation errors if any */
  validationErrors: string[];
  /** Whether the current configuration is valid */
  isValid: boolean;
}

/**
 * Custom hook for managing business availability configuration.
 * Handles state management, localStorage persistence, and provides
 * utility methods for working with availability data.
 *
 * @param autoLoad - Whether to automatically load from localStorage on mount (default: true)
 * @returns Object containing availability state and methods
 *
 * @example
 * const { 
 *   configured, 
 *   availability, 
 *   saveAvailability, 
 *   getDisabledDates 
 * } = useAvailability();
 *
 * // Save availability
 * saveAvailability({
 *   businessName: 'My Business',
 *   availableDays: [1, 3, 5],
 *   availableHours: { start: { hour: 9, minute: 0 }, end: { hour: 17, minute: 0 } }
 * });
 *
 * // Get disabled dates for calendar
 * const disabledDates = getDisabledDates(startDate, endDate);
 */
export const useAvailability = (autoLoad: boolean = true): UseAvailabilityReturn => {
  const [availability, setAvailability] = useState<BusinessAvailability | null>(null);
  const [config, setConfig] = useState<AvailabilityConfig | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!autoLoad) return;

    try {
      const storedAvailability = localStorage.getItem(STORAGE_KEY);
      const storedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);

      if (storedAvailability) {
        const parsed = JSON.parse(storedAvailability) as BusinessAvailability;
        setAvailability(parsed);
      }

      if (storedConfig) {
        const parsed = JSON.parse(storedConfig) as AvailabilityConfig;
        setConfig(parsed);
      }
    } catch (error) {
      console.error('Failed to load availability from localStorage:', error);
    }
  }, [autoLoad]);

  // Validate availability and config whenever they change
  useEffect(() => {
    const errors: string[] = [];

    if (availability) {
      const availabilityValidation = validateBusinessAvailability(availability);
      if (!availabilityValidation.isValid) {
        errors.push(...availabilityValidation.errors);
      }
    }

    if (config) {
      const configValidation = validateAvailabilityConfig(config);
      if (!configValidation.isValid) {
        errors.push(...configValidation.errors);
      }
    }

    setValidationErrors(errors);
  }, [availability, config]);

  /**
   * Save availability configuration to state and localStorage.
   */
  const saveAvailability = useCallback(
    (newAvailability: BusinessAvailability, newConfig?: AvailabilityConfig) => {
      try {
        // Validate before saving
        const availabilityValidation = validateBusinessAvailability(newAvailability);
        if (!availabilityValidation.isValid) {
          console.error('Invalid availability configuration:', availabilityValidation.errors);
          setValidationErrors(availabilityValidation.errors);
          return;
        }

        if (newConfig) {
          const configValidation = validateAvailabilityConfig(newConfig);
          if (!configValidation.isValid) {
            console.error('Invalid availability config:', configValidation.errors);
            setValidationErrors(configValidation.errors);
            return;
          }
        }

        // Save to state
        setAvailability(newAvailability);
        if (newConfig) {
          setConfig(newConfig);
        }

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newAvailability));
        if (newConfig) {
          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
        }

        setValidationErrors([]);
      } catch (error) {
        console.error('Failed to save availability:', error);
      }
    },
    []
  );

  /**
   * Clear availability configuration from state and localStorage.
   */
  const clearAvailability = useCallback(() => {
    try {
      setAvailability(null);
      setConfig(null);
      setValidationErrors([]);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear availability:', error);
    }
  }, []);

  /**
   * Update only the availability config (not business availability).
   */
  const updateConfig = useCallback((newConfig: AvailabilityConfig) => {
    try {
      const configValidation = validateAvailabilityConfig(newConfig);
      if (!configValidation.isValid) {
        console.error('Invalid availability config:', configValidation.errors);
        setValidationErrors(configValidation.errors);
        return;
      }

      setConfig(newConfig);
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
      setValidationErrors([]);
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  }, []);

  /**
   * Get disabled dates for a date range based on current availability.
   * Returns empty array if availability is not configured.
   */
  const getDisabledDates = useCallback(
    (startDate: Date, endDate: Date): Date[] => {
      if (!availability) {
        return [];
      }

      try {
        return getDisabledDatesWithConfig(
          availability,
          startDate,
          endDate,
          config ?? undefined
        );
      } catch (error) {
        console.error('Failed to calculate disabled dates:', error);
        return [];
      }
    },
    [availability, config]
  );

  // Memoize computed values
  const configured = useMemo(() => {
    return availability !== null;
  }, [availability]);

  const isValid = useMemo(() => {
    return validationErrors.length === 0;
  }, [validationErrors]);

  return {
    configured,
    availability,
    config,
    saveAvailability,
    clearAvailability,
    getDisabledDates,
    updateConfig,
    validationErrors,
    isValid,
  };
};

/**
 * Hook to get disabled dates for calendar integration.
 * Convenience hook that returns only the disabled dates array.
 *
 * @param monthsToLoad - Number of months ahead to calculate disabled dates for (default: 3)
 * @returns Array of disabled dates
 *
 * @example
 * const disabledDates = useAvailabilityDates();
 * <Calendar disabledDates={disabledDates} />
 */
export const useAvailabilityDates = (monthsToLoad: number = 3): Date[] => {
  const { getDisabledDates } = useAvailability();

  return useMemo(() => {
    const now = new Date();
    const endDate = addMonths(now, monthsToLoad);
    return getDisabledDates(now, endDate);
  }, [getDisabledDates, monthsToLoad]);
};










