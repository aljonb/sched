'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { TimeSlot } from '@/lib/availability/types';

interface CalendarTimeSlotsProps {
  /** Selected date to show time slots for */
  selectedDate: Date | null;
  /** Business ID to fetch slots for */
  businessId: string;
  /** Callback when a time slot is selected */
  onSelectSlot?: (slot: TimeSlot) => void;
  /** Currently selected slot */
  selectedSlot?: TimeSlot | null;
}

/**
 * Component to display and select time slots for a given date.
 * Fetches available slots from the API based on business configuration.
 */
export const CalendarTimeSlots = ({
  selectedDate,
  businessId,
  onSelectSlot,
  selectedSlot,
}: CalendarTimeSlotsProps) => {
  const [internalSelected, setInternalSelected] = useState<TimeSlot | null>(
    selectedSlot ?? null
  );
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch slots when date or businessId changes
  useEffect(() => {
    // Reset state when no date is selected
    if (!selectedDate) {
      setTimeSlots([]);
      setError(null);
      return;
    }

    // Reset state when businessId is missing
    if (!businessId) {
      setTimeSlots([]);
      setError('Business ID is required');
      return;
    }

    const fetchSlots = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Format date as ISO string (YYYY-MM-DD)
        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        const response = await fetch(
          `/api/slots?business_id=${businessId}&date=${dateStr}`
        );

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch available slots');
        }

        // Convert API response to TimeSlot format
        const slots: TimeSlot[] = result.data.slots.map((slot: { start: string; end: string }) => ({
          start: new Date(slot.start),
          end: new Date(slot.end),
          isAvailable: true,
        }));

        setTimeSlots(slots);
      } catch (err) {
        console.error('Error fetching slots:', err);
        setError(err instanceof Error ? err.message : 'Failed to load time slots');
        setTimeSlots([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlots();
  }, [selectedDate, businessId]);

  // Sync internal selected state with prop
  useEffect(() => {
    setInternalSelected(selectedSlot ?? null);
  }, [selectedSlot]);

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

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {format(selectedDate, 'EEEE, MMM d')}
          </h3>
        </div>
        <div className="text-center text-gray-500 py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-sm">Loading available slots...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {format(selectedDate, 'EEEE, MMM d')}
          </h3>
        </div>
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  // Show empty state (no slots available on this date)
  if (timeSlots.length === 0) {
    return (
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {format(selectedDate, 'EEEE, MMM d')}
          </h3>
        </div>
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No available time slots</p>
          <p className="text-xs mt-2">
            This day may be unavailable or fully booked
          </p>
        </div>
      </div>
    );
  }

  // Render available slots
  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {format(selectedDate, 'EEEE, MMM d')}
        </h3>
        <span className="text-sm text-gray-600">
          {timeSlots.length} available
        </span>
      </div>

      {/* Time slots grid */}
      <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
        {timeSlots.map((slot) => {
          const selected = isSlotSelected(slot);
          return (
            <button
              key={`${slot.start.getTime()}-${slot.end.getTime()}`}
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












