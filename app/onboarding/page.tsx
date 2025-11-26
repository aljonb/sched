'use client';

import { AvailabilityWizard } from '@/components/AvailabilityWizard';
import { useAvailability } from '@/hooks/useAvailability';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import type { BusinessAvailability, AvailabilityConfig } from '@/lib/availability/types';

/**
 * Business Onboarding Page
 * 
 * This page guides new business owners through setting up their
 * availability configuration using the AvailabilityWizard component.
 * 
 * Features:
 * - Redirects to home if already configured
 * - Redirects to sign-in if not authenticated
 * - Saves business data to database (linked to user)
 * - Provides loading and error states
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { saveAvailability, configured, isLoading: isAvailabilityLoading } = useAvailability();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already configured
  useEffect(() => {
    if (!isAvailabilityLoading && configured) {
      router.push('/');
    }
  }, [configured, isAvailabilityLoading, router]);

  // Redirect if not logged in
  useEffect(() => {
    if (isUserLoaded && !user) {
      router.push('/');
    }
  }, [isUserLoaded, user, router]);

  const handleComplete = async (availability: BusinessAvailability, config?: AvailabilityConfig) => {
    setError(null);
    setIsSaving(true);

    try {
      await saveAvailability(availability, config);
      // Redirect to main calendar after successful onboarding
      router.push('/');
    } catch (err) {
      console.error('Onboarding failed:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to save your business information. Please try again.'
      );
      setIsSaving(false);
    }
  };

  // Show loading state
  if (isAvailabilityLoading || !isUserLoaded || isSaving) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isSaving ? 'Saving your business...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Don't show wizard if not authenticated or already configured
  if (!user || configured) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="flex flex-col gap-8 items-center w-full max-w-2xl">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Welcome to Your Scheduling Engine</h1>
          <p className="text-gray-600">
            Let&apos;s set up your business availability in just a few steps
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full max-w-md p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Wizard */}
        <AvailabilityWizard onComplete={handleComplete} />

        {/* Help Text */}
        <div className="text-center text-sm text-gray-500 max-w-md">
          <p>
            Don&apos;t worry, you can change these settings anytime from your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}


