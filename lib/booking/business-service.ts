/**
 * Business Service Layer
 * 
 * Handles all database operations related to businesses.
 * Provides a clean API for creating, reading, updating, and deleting
 * business records while maintaining type safety and error handling.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Business } from './types';
import type { BusinessAvailability, AvailabilityConfig } from '@/lib/availability/types';
import {
  businessAvailabilityToDb,
  dbToBusinessAvailability,
  dbToAvailabilityConfig,
} from './converters';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Combined business data with client-side types
 */
export interface BusinessWithConfig {
  /** Client-side availability format */
  availability: BusinessAvailability;
  /** Client-side config format */
  config: AvailabilityConfig;
  /** Database business ID */
  businessId: string;
  /** Full database business record */
  business: Business;
}

/**
 * Result type for operations that may fail
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// FETCH OPERATIONS
// ============================================

/**
 * Fetch the business record for a specific user
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - Clerk user ID
 * @returns BusinessWithConfig or null if no business exists
 * @throws Error if database query fails
 * 
 * @example
 * const business = await fetchUserBusiness(supabase, 'user_123');
 * if (business) {
 *   console.log(business.availability.businessName);
 * }
 */
export async function fetchUserBusiness(
  supabase: SupabaseClient,
  userId: string
): Promise<BusinessWithConfig | null> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .maybeSingle(); // Use maybeSingle() to handle 0 or 1 results gracefully

    if (error) {
      // PGRST116 means no rows returned - this is OK, user hasn't onboarded yet
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch business: ${error.message}`);
    }

    // No business found
    if (!data) {
      return null;
    }

    const business = data as Business;

    return {
      availability: dbToBusinessAvailability(business),
      config: dbToAvailabilityConfig(business),
      businessId: business.id,
      business,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch business: Unknown error');
  }
}

/**
 * Fetch a business by its ID (for public viewing)
 * 
 * @param supabase - Supabase client (can be unauthenticated)
 * @param businessId - Business ID
 * @returns BusinessWithConfig or null if not found
 */
export async function fetchBusinessById(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessWithConfig | null> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const business = data as Business;

    return {
      availability: dbToBusinessAvailability(business),
      config: dbToAvailabilityConfig(business),
      businessId: business.id,
      business,
    };
  } catch (error) {
    console.error('Failed to fetch business by ID:', error);
    return null;
  }
}

/**
 * List all active businesses (for admin/public listing)
 * 
 * @param supabase - Supabase client
 * @param limit - Maximum number of businesses to return (default: 100)
 * @returns Array of BusinessWithConfig objects
 */
export async function listActiveBusinesses(
  supabase: SupabaseClient,
  limit: number = 100
): Promise<BusinessWithConfig[]> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list businesses: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((business) => ({
      availability: dbToBusinessAvailability(business as Business),
      config: dbToAvailabilityConfig(business as Business),
      businessId: business.id,
      business: business as Business,
    }));
  } catch (error) {
    console.error('Failed to list businesses:', error);
    return [];
  }
}

// ============================================
// CREATE OPERATIONS
// ============================================

/**
 * Create a new business record
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - Clerk user ID of the business owner
 * @param availability - Business availability configuration
 * @param config - Availability config (slot duration, timezone, etc.)
 * @returns Created Business object
 * @throws Error if creation fails or user already has a business
 * 
 * @example
 * const business = await createBusiness(
 *   supabase,
 *   'user_123',
 *   {
 *     businessName: "My Business",
 *     availableDays: [1, 2, 3, 4, 5],
 *     availableHours: { start: { hour: 9, minute: 0 }, end: { hour: 17, minute: 0 } }
 *   },
 *   { slotDuration: 60, timezone: 'America/New_York' }
 * );
 */
export async function createBusiness(
  supabase: SupabaseClient,
  userId: string,
  availability: BusinessAvailability,
  config: AvailabilityConfig
): Promise<Business> {
  try {
    // Check if user already has an active business
    const existing = await fetchUserBusiness(supabase, userId);
    if (existing) {
      throw new Error('User already has an active business. Use updateBusiness instead.');
    }

    // Convert to database format
    const businessData = businessAvailabilityToDb(availability, config, userId);

    // Insert into database
    const { data, error } = await supabase
      .from('businesses')
      .insert(businessData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create business: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create business: No data returned');
    }

    return data as Business;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create business: Unknown error');
  }
}

// ============================================
// UPDATE OPERATIONS
// ============================================

/**
 * Update an existing business record
 * 
 * @param supabase - Authenticated Supabase client
 * @param businessId - ID of the business to update
 * @param userId - Clerk user ID (for security check)
 * @param availability - Updated business availability
 * @param config - Updated availability config
 * @returns Updated Business object
 * @throws Error if update fails or user doesn't own the business
 * 
 * @example
 * const updated = await updateBusiness(
 *   supabase,
 *   'business_123',
 *   'user_123',
 *   updatedAvailability,
 *   updatedConfig
 * );
 */
export async function updateBusiness(
  supabase: SupabaseClient,
  businessId: string,
  userId: string,
  availability: BusinessAvailability,
  config: AvailabilityConfig
): Promise<Business> {
  try {
    // Convert to database format
    const businessData = businessAvailabilityToDb(availability, config, userId);

    // Update in database (RLS will ensure user owns this business)
    const { data, error } = await supabase
      .from('businesses')
      .update(businessData)
      .eq('id', businessId)
      .eq('owner_id', userId) // Extra security: ensure user owns this business
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update business: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to update business: No data returned or permission denied');
    }

    return data as Business;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update business: Unknown error');
  }
}

/**
 * Deactivate a business (soft delete)
 * Sets is_active to false instead of deleting the record
 * 
 * @param supabase - Authenticated Supabase client
 * @param businessId - ID of the business to deactivate
 * @param userId - Clerk user ID (for security check)
 * @returns Success boolean
 */
export async function deactivateBusiness(
  supabase: SupabaseClient,
  businessId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ is_active: false })
      .eq('id', businessId)
      .eq('owner_id', userId);

    if (error) {
      console.error('Failed to deactivate business:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to deactivate business:', error);
    return false;
  }
}

/**
 * Reactivate a previously deactivated business
 * 
 * @param supabase - Authenticated Supabase client
 * @param businessId - ID of the business to reactivate
 * @param userId - Clerk user ID (for security check)
 * @returns Success boolean
 */
export async function reactivateBusiness(
  supabase: SupabaseClient,
  businessId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({ is_active: true })
      .eq('id', businessId)
      .eq('owner_id', userId);

    if (error) {
      console.error('Failed to reactivate business:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to reactivate business:', error);
    return false;
  }
}

// ============================================
// DELETE OPERATIONS
// ============================================

/**
 * Permanently delete a business (hard delete)
 * WARNING: This will cascade delete all appointments and blocked slots
 * 
 * @param supabase - Authenticated Supabase client
 * @param businessId - ID of the business to delete
 * @param userId - Clerk user ID (for security check)
 * @returns Success boolean
 */
export async function deleteBusiness(
  supabase: SupabaseClient,
  businessId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId)
      .eq('owner_id', userId);

    if (error) {
      console.error('Failed to delete business:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete business:', error);
    return false;
  }
}






