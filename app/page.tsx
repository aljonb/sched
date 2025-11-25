'use client';

import { Calendar, CalendarTimeSlots } from '@/components/calendar';
import { AvailabilityWizard } from '@/components/AvailabilityWizard';
import { useAvailability } from '@/hooks/useAvailability';
import { useState, useMemo } from 'react';
import { format, addMonths, getDay } from 'date-fns';
import type { TimeSlot } from '@/lib/availability/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Home() {
  const {
    configured,
    availability,
    config,
    saveAvailability,
    clearAvailability,
    getDisabledDates,
  } = useAvailability();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [showWizard, setShowWizard] = useState(false);

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

  const handleWizardComplete = async (newAvailability: any, newConfig: any) => {
    try {
      await saveAvailability(newAvailability, newConfig);
      setShowWizard(false);
    } catch (error) {
      console.error('Failed to save availability:', error);
      alert('Failed to save availability. Please try again.');
    }
  };

  const handleEditAvailability = () => {
    setShowWizard(true);
  };

  const handleClearAvailability = () => {
    if (confirm('Are you sure you want to clear your availability settings?')) {
      clearAvailability();
      setSelectedDate(undefined);
      setSelectedSlot(null);
    }
  };

  // Show wizard if not configured or user clicked edit
  if (!configured || showWizard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="flex flex-col gap-8 items-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Scheduling Engine</h1>
            <p className="text-gray-600">
              {configured ? 'Edit your availability' : 'Set up your availability'}
            </p>
          </div>

          <AvailabilityWizard
            onComplete={handleWizardComplete}
            initialAvailability={availability ?? undefined}
            initialConfig={config ?? undefined}
          />

          {configured && (
            <button
              onClick={() => setShowWizard(false)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Availability info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Availability</h2>
                <button
                  onClick={handleEditAvailability}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
              </div>

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
                <h3 className="text-lg font-semibold mb-3">Selection</h3>
                <div className="space-y-2">
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
                </div>
                {selectedSlot && (
                  <button
                    className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Book Appointment
                  </button>
                )}
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

              {availability && (
                <CalendarTimeSlots
                  selectedDate={selectedDate ?? null}
                  availability={availability}
                  config={config ?? undefined}
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
