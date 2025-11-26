/**
 * Server-Side Supabase Client with Clerk Authentication
 * 
 * This module provides server-side Supabase client creation using Clerk's
 * auth() function to get the session token.
 */

import { auth } from '@clerk/nextjs/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client for server-side use with Clerk authentication
 * 
 * This function is designed to be used in:
 * - Server Components
 * - Server Actions
 * - API Routes
 * - Route Handlers
 * 
 * @returns Promise<Authenticated Supabase client>
 * 
 * @example
 * // In a Server Component
 * import { createServerClerkSupabaseClient } from '@/utils/supabase/clerk-server';
 * 
 * export default async function MyServerComponent() {
 *   const supabase = await createServerClerkSupabaseClient();
 *   const { data } = await supabase.from('businesses').select('*');
 *   return <div>{JSON.stringify(data)}</div>;
 * }
 * 
 * @example
 * // In a Server Action
 * 'use server'
 * import { createServerClerkSupabaseClient } from '@/utils/supabase/clerk-server';
 * 
 * export async function myAction() {
 *   const supabase = await createServerClerkSupabaseClient();
 *   // Use supabase...
 * }
 */
export async function createServerClerkSupabaseClient(): Promise<SupabaseClient> {
  const { getToken } = await auth();
  const token = await getToken();

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    },
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Alternative server-side client using accessToken callback
 * This matches the pattern from Clerk's documentation
 */
export function createServerClerkSupabaseClientV2(): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      const { getToken } = await auth();
      return await getToken();
    },
  });
}






