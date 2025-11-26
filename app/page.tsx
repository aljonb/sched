'use client';

import { Calendar, CalendarTimeSlots } from '@/components/calendar';
import { useAvailability } from '@/hooks/useAvailability';
import { useState, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import type { TimeSlot } from '@/lib/availability/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Home() {
  const {
    configured,
    availability,
    businessId,
    clearAvailability,
    getDisabledDates,
    isLoading,
    error,
  } = useAvailability();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Customer info form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Booking state
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingToken, setBookingToken] = useState<string | null>(null);

  // Calculate disabled dates for the next 3 months
  const disabledDates = useMemo(() => {
    if (!availability) return [];
    const now = new Date();
    const endDate = addMonths(now, 3);
    return getDisabledDates(now, endDate);
  }, [availability, getDisabledDates]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null); // Reset slot selection when date changes
  };

  const handleClearAvailability = () => {
    if (confirm('Are you sure you want to clear your availability settings?')) {
      clearAvailability();
      setSelectedDate(undefined);
      setSelectedSlot(null);
    }
  };

  const handleBookAppointment = async () => {
    console.log('Book appointment clicked', { selectedSlot, businessId, customerName, customerEmail });
    
    if (!selectedSlot) {
      setBookingError('Please select a time slot');
      return;
    }
    
    if (!businessId) {
      setBookingError('Business not found. Please re-configure your availability by clicking "Edit" above, then save it again to enable bookings.');
      return;
    }

    // Validate customer info
    if (!customerName.trim() || !customerEmail.trim()) {
      setBookingError('Please provide your name and email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      setBookingError('Please provide a valid email address');
      return;
    }

    try {
      setIsBooking(true);
      setBookingError(null);

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

      // Reset form and selected slot to trigger refresh of available slots
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setNotes('');
      
      // Clear selected slot and trigger a date re-selection to refresh slots
      const currentDate = selectedDate;
      setSelectedDate(undefined);
      setSelectedSlot(null);
      
      // Re-select the date to trigger slot refresh in CalendarTimeSlots
      setTimeout(() => {
        setSelectedDate(currentDate);
      }, 0);
    } catch (error) {
      console.error('Booking error:', error);
      setBookingError(
        error instanceof Error ? error.message : 'Failed to book appointment'
      );
    } finally {
      setIsBooking(false);
    }
  };

  const handleCloseSuccess = () => {
    setBookingSuccess(false);
    setBookingToken(null);
  };

  // Show "Create Business" prompt if not configured
  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Scheduling Engine</h1>
          <p className="text-gray-600 mb-8">
            {isLoading 
              ? 'Loading your business...' 
              : 'Welcome! To start accepting appointments, you need to set up your business first.'}
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {!isLoading && (
            <a
              href="/onboarding"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Business
            </a>
          )}
        </div>
      </div>
    );
  }

  // Main calendar view with availability
  return (
    <div className="flex min-h-screen bg-gray-50 p-8">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Scheduling Engine</h1>
          <p className="text-gray-600">
            Book appointments with {availability?.businessName}
          </p>
        </div>

        {/* Success Modal */}
        {bookingSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
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
                <h3 className="text-lg font-semibold mb-2">Appointment Booked!</h3>
                <p className="text-gray-600 mb-4">
                  Your appointment has been successfully booked. A confirmation has been sent to your email.
                </p>
                {bookingToken && (
                  <div className="bg-gray-50 p-3 rounded-lg mb-4">
                    <p className="text-xs text-gray-600 mb-1">Booking Token:</p>
                    <p className="font-mono text-sm break-all">{bookingToken}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Save this token to manage your appointment
                    </p>
                  </div>
                )}
                <button
                  onClick={handleCloseSuccess}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Availability info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Availability</h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Business</p>
                  <p className="font-medium">{availability?.businessName}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">Available Days</p>
                  <div className="flex flex-wrap gap-2">
                    {availability?.availableDays.map((day) => (
                      <span
                        key={day}
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                      >
                        {DAY_NAMES[day]}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">Hours</p>
                  <p className="font-medium">
                    {availability?.availableHours.start.hour
                      .toString()
                      .padStart(2, '0')}
                    :
                    {availability?.availableHours.start.minute
                      .toString()
                      .padStart(2, '0')}{' '}
                    -{' '}
                    {availability?.availableHours.end.hour
                      .toString()
                      .padStart(2, '0')}
                    :
                    {availability?.availableHours.end.minute
                      .toString()
                      .padStart(2, '0')}
                  </p>
                </div>
              </div>

              <button
                onClick={handleClearAvailability}
                className="w-full mt-6 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear Availability
              </button>
            </div>

            {/* Selected date/time info and booking form */}
            {selectedDate && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-3">Book Appointment</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-medium">
                      {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                    </p>
                  </div>
                  {selectedSlot && (
                    <div>
                      <p className="text-sm text-gray-600">Time</p>
                      <p className="font-medium">
                        {format(selectedSlot.start, 'h:mm a')} -{' '}
                        {format(selectedSlot.end, 'h:mm a')}
                      </p>
                    </div>
                  )}

                  {selectedSlot && (
                    <>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3">Your Information</h4>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="customerName" className="block text-sm text-gray-600 mb-1">
                              Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="customerName"
                              type="text"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="John Doe"
                              required
                            />
                          </div>

                          <div>
                            <label htmlFor="customerEmail" className="block text-sm text-gray-600 mb-1">
                              Email <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="customerEmail"
                              type="email"
                              value={customerEmail}
                              onChange={(e) => setCustomerEmail(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="john@example.com"
                              required
                            />
                          </div>

                          <div>
                            <label htmlFor="customerPhone" className="block text-sm text-gray-600 mb-1">
                              Phone (optional)
                            </label>
                            <input
                              id="customerPhone"
                              type="tel"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="+1 (555) 123-4567"
                            />
                          </div>

                          <div>
                            <label htmlFor="notes" className="block text-sm text-gray-600 mb-1">
                              Notes (optional)
                            </label>
                            <textarea
                              id="notes"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              placeholder="Any special requests or information..."
                              rows={3}
                            />
                          </div>
                        </div>
                      </div>

                      {bookingError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-600">{bookingError}</p>
                        </div>
                      )}

                      <button
                        onClick={handleBookAppointment}
                        disabled={isBooking}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isBooking ? 'Booking...' : 'Book Appointment'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Calendar and time slots */}
          <div className="lg:col-span-2">
            <div className="flex flex-col gap-6">
              <Calendar
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
                config={{ weekStartsOn: 0 }}
                disabledDates={disabledDates}
              />

              {businessId && (
                <CalendarTimeSlots
                  selectedDate={selectedDate ?? null}
                  businessId={businessId}
                  onSelectSlot={setSelectedSlot}
                  selectedSlot={selectedSlot}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
