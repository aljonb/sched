'use client';

import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ConnectionDetails {
  message: string;
  note?: string;
  sessionStatus?: string;
  code?: string;
  details?: unknown;
  hint?: unknown;
}

export default function TestDatabase() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [error, setError] = useState<string>('');
  const [details, setDetails] = useState<ConnectionDetails | null>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        const supabase = createClient();
        
        // Test 1: Check if client was created
        if (!supabase) {
          throw new Error('Failed to create Supabase client');
        }

        // Test 2: Try to get the current session (doesn't require any tables)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Even if there's no session, if we got here without a connection error, we're good
        if (sessionError && !sessionError.message.includes('session')) {
          throw sessionError;
        }

        // Test 3: Try a simple query to verify database access
        const { error: queryError } = await supabase.from('_test').select('*').limit(1);
        
        // These error codes mean we connected successfully but the table doesn't exist (which is fine)
        const connectionSuccessCodes = ['PGRST204', 'PGRST205', '42P01'];
        
        if (queryError && (
          queryError.message.includes('relation "_test" does not exist') ||
          queryError.message.includes('Could not find the table') ||
          ('code' in queryError && connectionSuccessCodes.includes(queryError.code as string))
        )) {
          // This is good - we connected but the test table doesn't exist
          setStatus('connected');
          setDetails({ 
            message: 'Database connection successful!',
            note: 'Successfully connected to Supabase and verified database access.',
            sessionStatus: session ? 'User authenticated' : 'No active session (expected)'
          });
        } else if (queryError) {
          throw queryError;
        } else {
          setStatus('connected');
          setDetails({ 
            message: 'Database connection successful!',
            sessionStatus: session ? 'User authenticated' : 'No active session (expected)'
          });
        }
      } catch (err) {
        setStatus('error');
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setDetails(err as ConnectionDetails);
      }
    }

    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Database Connection Test</h1>
        
        <div className={`p-6 rounded-lg ${
          status === 'checking' ? 'bg-blue-100' :
          status === 'connected' ? 'bg-green-100' : 'bg-red-100'
        }`}>
          <h2 className="text-xl font-semibold mb-2">
            {status === 'checking' && '🔄 Checking connection...'}
            {status === 'connected' && '✅ Connected!'}
            {status === 'error' && '❌ Connection Failed'}
          </h2>
          
          {status === 'connected' && (
            <div className="mt-4 space-y-2">
              <p className="text-green-800 font-semibold">{details?.message}</p>
              <p className="text-green-700 text-sm">{details?.note}</p>
              <p className="text-green-700 text-sm">Session: {details?.sessionStatus}</p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="mt-4">
              <p className="text-red-800 font-semibold">Error: {error}</p>
              <pre className="mt-2 p-4 bg-red-50 rounded text-xs overflow-auto">
                {JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-white rounded-lg shadow">
          <h3 className="font-semibold mb-2">Environment Variables Check:</h3>
          <ul className="space-y-1 text-sm">
            <li>
              NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
            </li>
            <li>
              NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
            </li>
          </ul>
        </div>

        <div className="mt-6">
          <Link 
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
