'use client';

import { Calendar, CalendarTimeSlots } from '@/components/calendar';
import BookingModal from '@/components/BookingModal';
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

  const handleBookingSuccess = () => {
    // Trigger a refresh of the calendar slots
    const currentDate = selectedDate;
    setSelectedDate(undefined);
    setSelectedSlot(null);
    
    // Re-select the date to trigger slot refresh in CalendarTimeSlots
    setTimeout(() => {
      setSelectedDate(currentDate);
    }, 0);
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

        {/* Booking Modal */}
        <BookingModal
          isOpen={selectedSlot !== null}
          onClose={() => setSelectedSlot(null)}
          onSuccess={handleBookingSuccess}
          selectedSlot={selectedSlot}
          selectedDate={selectedDate ?? null}
          businessId={businessId || ''}
          businessName={availability?.businessName || ''}
        />

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

            {/* Selected date/time info */}
            {selectedDate && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-3">Selected Date</h3>
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
                  {!selectedSlot && (
                    <p className="text-sm text-gray-500 italic">
                      Select a time slot to book an appointment
                    </p>
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
