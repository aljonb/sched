'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useSession } from '@clerk/nextjs';
import { addMonths } from 'date-fns';
import type { BusinessAvailability, AvailabilityConfig } from '@/lib/availability/types';
import { 
  getDisabledDatesWithConfig,
  validateBusinessAvailability,
  validateAvailabilityConfig,
} from '@/lib/availability/utils';
import { createClerkSupabaseClientV2 } from '@/utils/supabase/clerk-client';
import {
  fetchUserBusiness,
  createBusiness,
  updateBusiness,
  type BusinessWithConfig,
} from '@/lib/booking/business-service';

const STORAGE_KEY = 'business-availability';
const CONFIG_STORAGE_KEY = 'availability-config';

interface UseAvailabilityReturn {
  /** Whether availability has been configured */
  configured: boolean;
  /** Current business availability configuration */
  availability: BusinessAvailability | null;
  /** Current availability config (slot duration, booking windows, etc.) */
  config: AvailabilityConfig | null;
  /** Database business ID (null if not saved to database yet) */
  businessId: string | null;
  /** Save availability configuration to database and localStorage */
  saveAvailability: (availability: BusinessAvailability, config?: AvailabilityConfig) => Promise<void>;
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
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Custom hook for managing business availability configuration.
 * 
 * This hook now integrates with the database:
 * 1. Checks database first for authenticated users
 * 2. Falls back to localStorage for backwards compatibility
 * 3. Automatically syncs changes to both database and localStorage
 *
 * @param autoLoad - Whether to automatically load on mount (default: true)
 * @returns Object containing availability state and methods
 *
 * @example
 * const { 
 *   configured, 
 *   availability, 
 *   saveAvailability, 
 *   getDisabledDates,
 *   isLoading 
 * } = useAvailability();
 *
 * // Save availability (async now!)
 * await saveAvailability({
 *   businessName: 'My Business',
 *   availableDays: [1, 3, 5],
 *   availableHours: { start: { hour: 9, minute: 0 }, end: { hour: 17, minute: 0 } }
 * }, { slotDuration: 60 });
 */
export const useAvailability = (autoLoad: boolean = true): UseAvailabilityReturn => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { session } = useSession();
  const [availability, setAvailability] = useState<BusinessAvailability | null>(null);
  const [config, setConfig] = useState<AvailabilityConfig | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from database or localStorage on mount
  useEffect(() => {
    if (!autoLoad) {
      setIsLoading(false);
      return;
    }

    if (!isUserLoaded) {
      // Wait for Clerk to load user data
      return;
    }

    const loadAvailability = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // If user is logged in, try database first
        if (user && session) {
          try {
            const supabase = createClerkSupabaseClientV2(async () => {
              return (await session.getToken()) ?? null;
            });

            const businessData = await fetchUserBusiness(supabase, user.id);

            if (businessData) {
              setAvailability(businessData.availability);
              setConfig(businessData.config);
              setBusinessId(businessData.businessId);
              
              // Sync to localStorage for offline access
              localStorage.setItem(STORAGE_KEY, JSON.stringify(businessData.availability));
              localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(businessData.config));
              
              setIsLoading(false);
              return;
            }
          } catch (dbError) {
            console.error('Failed to load from database, falling back to localStorage:', dbError);
            // Fall through to localStorage
          }
        }

        // Fallback to localStorage (for backwards compatibility or logged-out users)
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

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load availability:', err);
        setError(err instanceof Error ? err.message : 'Failed to load availability');
        setIsLoading(false);
      }
    };

    loadAvailability();
  }, [autoLoad, isUserLoaded, user, session]);

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
   * Save availability configuration to database and localStorage.
   * Now async - waits for database save to complete.
   */
  const saveAvailability = useCallback(
    async (newAvailability: BusinessAvailability, newConfig?: AvailabilityConfig) => {
      try {
        setError(null);

        // Validate before saving
        const availabilityValidation = validateBusinessAvailability(newAvailability);
        if (!availabilityValidation.isValid) {
          setValidationErrors(availabilityValidation.errors);
          throw new Error('Invalid availability configuration');
        }

        if (newConfig) {
          const configValidation = validateAvailabilityConfig(newConfig);
          if (!configValidation.isValid) {
            setValidationErrors(configValidation.errors);
            throw new Error('Invalid availability config');
          }
        }

        // Merge with existing config
        const finalConfig: AvailabilityConfig = {
          slotDuration: 60,
          timezone: 'UTC',
          ...config,
          ...newConfig,
        };

        // Save to database if user is logged in
        if (user && session) {
          try {
            const supabase = createClerkSupabaseClientV2(async () => {
              return (await session.getToken()) ?? null;
            });

            if (businessId) {
              // Update existing business
              await updateBusiness(supabase, businessId, user.id, newAvailability, finalConfig);
            } else {
              // Create new business
              const newBusiness = await createBusiness(supabase, user.id, newAvailability, finalConfig);
              setBusinessId(newBusiness.id);
            }
          } catch (dbError) {
            console.error('Failed to save to database:', dbError);
            // Continue to save to localStorage even if database fails
            setError('Failed to save to database, but saved locally');
          }
        }

        // Save to state
        setAvailability(newAvailability);
        setConfig(finalConfig);

        // Save to localStorage (backup/offline)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newAvailability));
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(finalConfig));

        setValidationErrors([]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save availability';
        setError(errorMessage);
        console.error('Failed to save availability:', err);
        throw err;
      }
    },
    [user, session, businessId, config]
  );

  /**
   * Clear availability configuration from state and localStorage.
   * Note: Does not delete from database, just clears local state.
   * To deactivate a business in the database, use the business service directly.
   */
  const clearAvailability = useCallback(() => {
    try {
      setAvailability(null);
      setConfig(null);
      setBusinessId(null);
      setValidationErrors([]);
      setError(null);
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
    businessId,
    saveAvailability,
    clearAvailability,
    getDisabledDates,
    updateConfig,
    validationErrors,
    isValid,
    isLoading,
    error,
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











