/**
 * Supabase Client with Clerk Authentication
 * 
 * This module provides Supabase client instances that are authenticated
 * using Clerk session tokens. This allows Clerk-authenticated users to
 * access Supabase data while respecting Row Level Security (RLS) policies.
 * 
 * The Clerk session token is automatically included in requests to Supabase,
 * and Supabase validates it using the Clerk third-party auth integration.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client for client-side use with Clerk session token
 * 
 * This function creates a Supabase client that automatically includes
 * the Clerk session token in all requests. Use this in client components.
 * 
 * @param getToken - Function that returns the current Clerk session token
 * @returns Authenticated Supabase client
 * 
 * @example
 * import { useSession } from '@clerk/nextjs';
 * 
 * function MyComponent() {
 *   const { session } = useSession();
 *   const supabase = createClerkSupabaseClient(() => session?.getToken());
 *   
 *   // Use supabase client...
 * }
 */
export function createClerkSupabaseClient(
  getToken: () => Promise<string | null> | string | null
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: async () => {
        const token = await getToken();
        if (!token) {
          return {};
        }
        return {
          Authorization: `Bearer ${token}`,
        };
      },
    },
    auth: {
      persistSession: false, // Don't persist Supabase sessions, we use Clerk
    },
  });
}

/**
 * Create a Supabase client using the accessToken callback pattern
 * This is the recommended approach from Clerk's documentation
 * 
 * @param getToken - Async function that returns the Clerk session token
 * @returns Authenticated Supabase client
 * 
 * @example
 * import { useSession } from '@clerk/nextjs';
 * 
 * function MyComponent() {
 *   const { session } = useSession();
 *   const supabase = createClerkSupabaseClientV2(async () => {
 *     return session?.getToken() ?? null;
 *   });
 * }
 */
export function createClerkSupabaseClientV2(
  getToken: () => Promise<string | null>
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      return await getToken();
    },
  });
}

/**
 * Get an anonymous Supabase client (no authentication)
 * 
 * Use this for public access that doesn't require authentication,
 * such as viewing available appointment slots or business information.
 * 
 * @returns Unauthenticated Supabase client
 */
export function getAnonSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}

