'use client';

import { useMemo, useState } from 'react';
import { format, getDay } from 'date-fns';
import type { BusinessAvailability, AvailabilityConfig, TimeSlot } from '@/lib/availability/types';
import { generateTimeSlots, isDateAvailable } from '@/lib/availability/utils';

interface CalendarTimeSlotsProps {
  /** Selected date to show time slots for */
  selectedDate: Date | null;
  /** Business availability configuration */
  availability: BusinessAvailability;
  /** Optional availability config for slot settings */
  config?: AvailabilityConfig;
  /** Optional array of already booked time slots */
  bookedSlots?: TimeSlot[];
  /** Callback when a time slot is selected */
  onSelectSlot?: (slot: TimeSlot) => void;
  /** Currently selected slot */
  selectedSlot?: TimeSlot | null;
}

/**
 * Component to display and select time slots for a given date.
 * Integrates with the Calendar component to show available booking times.
 */
export const CalendarTimeSlots = ({
  selectedDate,
  availability,
  config,
  bookedSlots = [],
  onSelectSlot,
  selectedSlot,
}: CalendarTimeSlotsProps) => {
  const [internalSelected, setInternalSelected] = useState<TimeSlot | null>(
    selectedSlot ?? null
  );

  // Generate time slots for the selected date
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    return generateTimeSlots(selectedDate, availability, config, bookedSlots);
  }, [selectedDate, availability, config, bookedSlots]);

  // Check if the selected date is available
  const isAvailable = useMemo(() => {
    if (!selectedDate) return false;
    return isDateAvailable(selectedDate, availability);
  }, [selectedDate, availability]);

  const handleSlotClick = (slot: TimeSlot) => {
    if (!slot.isAvailable) return;

    setInternalSelected(slot);
    onSelectSlot?.(slot);
  };

  const isSlotSelected = (slot: TimeSlot): boolean => {
    const selected = selectedSlot ?? internalSelected;
    if (!selected) return false;
    return (
      slot.start.getTime() === selected.start.getTime() &&
      slot.end.getTime() === selected.end.getTime()
    );
  };

  // Don't render if no date is selected
  if (!selectedDate) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
        <div className="text-center text-gray-500">
          <p className="text-sm">Select a date to view available time slots</p>
        </div>
      </div>
    );
  }

  // Don't render if date is not available
  if (!isAvailable) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {format(selectedDate, 'EEEE, MMM d')}
          </h3>
        </div>
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No availability on this day</p>
          <p className="text-xs mt-2">
            {availability.businessName} is closed on{' '}
            {format(selectedDate, 'EEEE')}s
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {format(selectedDate, 'EEEE, MMM d')}
        </h3>
        <span className="text-sm text-gray-600">
          {timeSlots.filter((s) => s.isAvailable).length} available
        </span>
      </div>

      {/* Time slots grid */}
      {timeSlots.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No time slots available</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
          {timeSlots.map((slot, index) => {
            const selected = isSlotSelected(slot);
            return (
              <button
                key={slot.id ?? index}
                type="button"
                onClick={() => handleSlotClick(slot)}
                disabled={!slot.isAvailable}
                className={`
                  px-4 py-3 text-sm rounded-lg transition-all border-2
                  ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : slot.isAvailable
                      ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <div className="font-medium">
                  {format(slot.start, 'h:mm a')}
                </div>
                <div className="text-xs opacity-80 mt-0.5">
                  {format(slot.end, 'h:mm a')}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected slot info */}
      {(selectedSlot ?? internalSelected) && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Selected:</span>{' '}
            {format(
              (selectedSlot ?? internalSelected)!.start,
              'h:mm a'
            )}{' '}
            -{' '}
            {format(
              (selectedSlot ?? internalSelected)!.end,
              'h:mm a'
            )}
          </p>
        </div>
      )}
    </div>
  );
};











