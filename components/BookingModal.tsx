'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { TimeSlot } from '@/lib/availability/types';
import { useRouter } from 'next/navigation';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedSlot: TimeSlot | null;
  selectedDate: Date | null;
  businessId: string;
  businessName: string;
}

export default function BookingModal({
  isOpen,
  onClose,
  onSuccess,
  selectedSlot,
  selectedDate,
  businessId,
  businessName,
}: BookingModalProps) {
  const router = useRouter();
  
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingToken, setBookingToken] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  if (!isOpen) return null;

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }

    // Validate required fields
    if (!customerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!customerEmail.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!validateEmail(customerEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsBooking(true);
      setError(null);

      const durationMinutes = Math.round(
        (selectedSlot.end.getTime() - selectedSlot.start.getTime()) / 60000
      );

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_id: businessId,
          start_time: selectedSlot.start.toISOString(),
          end_time: selectedSlot.end.toISOString(),
          duration_minutes: durationMinutes,
          customer_email: customerEmail.trim(),
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to book appointment');
      }

      // Success!
      setBookingSuccess(true);
      setBookingToken(result.data.booking_token);
      setAppointmentId(result.data.id);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Booking error:', err);
      setError(err instanceof Error ? err.message : 'Failed to book appointment');
    } finally {
      setIsBooking(false);
    }
  };

  const handleClose = () => {
    if (bookingSuccess) {
      // Reset form
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setNotes('');
      setBookingSuccess(false);
      setBookingToken(null);
      setAppointmentId(null);
      setError(null);
    }
    onClose();
  };

  const handleViewConfirmation = () => {
    if (appointmentId) {
      router.push(`/appointments/${appointmentId}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {bookingSuccess ? (
          // Success View
          <div className="p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              
              <h3 className="text-xl font-bold mb-2">Appointment Booked!</h3>
              
              <p className="text-gray-600 mb-4">
                Your appointment has been successfully confirmed. A confirmation email has been sent to{' '}
                <span className="font-medium">{customerEmail}</span>.
              </p>

              {/* Appointment Summary */}
              {selectedSlot && selectedDate && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Appointment Details</h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-600">Date:</span>{' '}
                      <span className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                    </p>
                    <p>
                      <span className="text-gray-600">Time:</span>{' '}
                      <span className="font-medium">
                        {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">Business:</span>{' '}
                      <span className="font-medium">{businessName}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Booking Token */}
              {bookingToken && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-600 mb-1 font-semibold">Booking Token:</p>
                  <p className="font-mono text-sm text-gray-800 break-all mb-2">{bookingToken}</p>
                  <p className="text-xs text-gray-600">
                    Save this token to manage or cancel your appointment later
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {appointmentId && (
                  <button
                    onClick={handleViewConfirmation}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Confirmation Page
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Booking Form View
          <>
            {/* Header */}
            <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Book Appointment</h2>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition-colors"
                disabled={isBooking}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              {/* Selected Date/Time Display */}
              {selectedSlot && selectedDate && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-sm text-gray-700 mb-2">Selected Time</h3>
                  <p className="text-lg font-medium text-gray-900">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-gray-600">
                    {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">with {businessName}</p>
                </div>
              )}

              {/* Customer Information */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="modal-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="modal-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                    required
                    disabled={isBooking}
                  />
                </div>

                <div>
                  <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="modal-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                    required
                    disabled={isBooking}
                  />
                </div>

                <div>
                  <label htmlFor="modal-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone (optional)
                  </label>
                  <input
                    id="modal-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 (555) 123-4567"
                    disabled={isBooking}
                  />
                </div>

                <div>
                  <label htmlFor="modal-notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    id="modal-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Any special requests or information..."
                    rows={3}
                    disabled={isBooking}
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isBooking}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBooking || !selectedSlot}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isBooking ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

