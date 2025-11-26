'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { Appointment } from '@/lib/booking/types';
import { AppointmentStatus } from '@/lib/booking/types';

export default function AppointmentConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.id as string;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [businessName, setBusinessName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch appointment details
        const response = await fetch(`/api/appointments/${appointmentId}`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to load appointment');
        }

        setAppointment(result.data.appointment);
        setBusinessName(result.data.businessName);
      } catch (err) {
        console.error('Error fetching appointment:', err);
        setError(err instanceof Error ? err.message : 'Failed to load appointment');
      } finally {
        setIsLoading(false);
      }
    };

    if (appointmentId) {
      fetchAppointment();
    }
  }, [appointmentId]);

  const getStatusBadgeClasses = (status: AppointmentStatus) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium';
    
    switch (status) {
      case AppointmentStatus.CONFIRMED:
        return `${baseClasses} bg-green-100 text-green-800`;
      case AppointmentStatus.PENDING:
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case AppointmentStatus.CANCELLED:
        return `${baseClasses} bg-red-100 text-red-800`;
      case AppointmentStatus.COMPLETED:
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case AppointmentStatus.NO_SHOW:
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusLabel = (status: AppointmentStatus) => {
    return status.replace('_', ' ').toUpperCase();
  };

  const handleCancelClick = () => {
    if (appointment?.booking_token) {
      router.push(`/appointments/${appointmentId}/cancel?token=${appointment.booking_token}`);
    }
  };

  const handleDownloadCalendar = () => {
    // Future implementation: Generate ICS file
    alert('Calendar download feature coming soon!');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading appointment...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Appointment Not Found</h1>
          <p className="text-gray-600 mb-6">
            {error || 'The appointment you are looking for does not exist or has been removed.'}
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Book New Appointment
          </a>
        </div>
      </div>
    );
  }

  const startDate = new Date(appointment.start_time);
  const endDate = new Date(appointment.end_time);
  const canCancel = appointment.status === AppointmentStatus.CONFIRMED || 
                    appointment.status === AppointmentStatus.PENDING;

  return (
    <div className="flex min-h-screen bg-gray-50 p-8">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Appointment Confirmation</h1>
          <p className="text-gray-600">Your appointment details</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Status Banner */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm opacity-90">Booking Reference</p>
                <p className="text-white font-mono text-lg">{appointment.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div className={getStatusBadgeClasses(appointment.status)}>
                {getStatusLabel(appointment.status)}
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="p-6 space-y-6">
            {/* Date and Time */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Date & Time
              </h2>
              <div className="ml-7 space-y-1">
                <p className="text-2xl font-bold text-gray-900">
                  {format(startDate, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-lg text-gray-600">
                  {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                </p>
                <p className="text-sm text-gray-500">
                  Duration: {appointment.duration_minutes} minutes
                </p>
              </div>
            </div>

            {/* Business Information */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Business
              </h2>
              <div className="ml-7">
                <p className="text-xl font-medium text-gray-900">{businessName}</p>
              </div>
            </div>

            {/* Customer Information */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Customer Details
              </h2>
              <div className="ml-7 space-y-2">
                <p className="text-gray-900">
                  <span className="font-medium">Name:</span> {appointment.customer_name}
                </p>
                <p className="text-gray-900">
                  <span className="font-medium">Email:</span> {appointment.customer_email}
                </p>
                {appointment.customer_phone && (
                  <p className="text-gray-900">
                    <span className="font-medium">Phone:</span> {appointment.customer_phone}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            {appointment.notes && (
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Notes
                </h2>
                <div className="ml-7">
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{appointment.notes}</p>
                </div>
              </div>
            )}

            {/* Booking Token */}
            {appointment.booking_token && (
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-3">Booking Token</h2>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-mono text-sm text-gray-700 break-all">{appointment.booking_token}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Save this token to manage your appointment
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadCalendar}
              className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Calendar Invite
            </button>
            {canCancel && (
              <button
                onClick={handleCancelClick}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel Appointment
              </button>
            )}
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 transition-colors"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

