'use client';

import { useState } from 'react';
import type { BusinessAvailability, AvailabilityConfig, TimeOfDay } from '@/lib/availability/types';
import { formatTimeOfDay, parseTimeString } from '@/lib/availability/utils';

interface AvailabilityWizardProps {
  /** Callback when configuration is completed */
  onComplete: (availability: BusinessAvailability, config?: AvailabilityConfig) => void;
  /** Optional initial values for editing */
  initialAvailability?: BusinessAvailability;
  initialConfig?: AvailabilityConfig;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

/**
 * Multi-step wizard for configuring business availability.
 * Guides users through:
 * 1. Business name
 * 2. Available days selection
 * 3. Available hours selection
 * 4. Appointment duration
 * 5. Break times (optional)
 */
export const AvailabilityWizard = ({
  onComplete,
  initialAvailability,
  initialConfig,
}: AvailabilityWizardProps) => {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState(initialAvailability?.businessName ?? '');
  const [selectedDays, setSelectedDays] = useState<number[]>(
    initialAvailability?.availableDays ?? [1, 2, 3, 4, 5] // Default: Mon-Fri
  );
  const [startTime, setStartTime] = useState<string>(
    initialAvailability?.availableHours.start
      ? formatTimeOfDay(initialAvailability.availableHours.start)
      : '09:00'
  );
  const [endTime, setEndTime] = useState<string>(
    initialAvailability?.availableHours.end
      ? formatTimeOfDay(initialAvailability.availableHours.end)
      : '17:00'
  );
  const [appointmentDuration, setAppointmentDuration] = useState<number>(
    initialConfig?.slotDuration ?? 60
  );
  const [breakTimes, setBreakTimes] = useState<Array<{
    start: string;
    end: string;
    label: string;
  }>>(
    initialAvailability?.breakTimes?.map(bt => ({
      start: formatTimeOfDay(bt.start),
      end: formatTimeOfDay(bt.end),
      label: bt.label || 'Break',
    })) ?? []
  );

  const [errors, setErrors] = useState<string[]>([]);

  const handleDayToggle = (dayValue: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayValue)) {
        return prev.filter((d) => d !== dayValue);
      } else {
        return [...prev, dayValue].sort((a, b) => a - b);
      }
    });
  };

  const validateStep = (): boolean => {
    const newErrors: string[] = [];

    if (step === 1) {
      if (!businessName.trim()) {
        newErrors.push('Business name is required');
      }
    } else if (step === 2) {
      if (selectedDays.length === 0) {
        newErrors.push('Please select at least one day');
      }
    } else if (step === 3) {
      const start = parseTimeString(startTime);
      const end = parseTimeString(endTime);

      if (!start) {
        newErrors.push('Invalid start time format');
      }
      if (!end) {
        newErrors.push('Invalid end time format');
      }

      if (start && end) {
        const startMinutes = start.hour * 60 + start.minute;
        const endMinutes = end.hour * 60 + end.minute;

        if (startMinutes >= endMinutes) {
          newErrors.push('End time must be after start time');
        }
      }
    } else if (step === 4) {
      if (appointmentDuration <= 0) {
        newErrors.push('Appointment duration must be positive');
      }
    } else if (step === 5) {
      breakTimes.forEach((breakTime, idx) => {
        const start = parseTimeString(breakTime.start);
        const end = parseTimeString(breakTime.end);
        
        if (!start || !end) {
          newErrors.push(`Break time ${idx + 1}: Invalid time format`);
        } else {
          const startMinutes = start.hour * 60 + start.minute;
          const endMinutes = end.hour * 60 + end.minute;
          if (startMinutes >= endMinutes) {
            newErrors.push(`Break time ${idx + 1}: End must be after start`);
          }
        }
      });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (step < 5) {
      setStep(step + 1);
      setErrors([]);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors([]);
    }
  };

  const handleComplete = () => {
    if (!validateStep()) return;

    const start = parseTimeString(startTime);
    const end = parseTimeString(endTime);

    if (!start || !end) {
      setErrors(['Invalid time format']);
      return;
    }

    const availability: BusinessAvailability = {
      businessName: businessName.trim(),
      availableDays: selectedDays,
      availableHours: {
        start,
        end,
      },
      breakTimes: breakTimes.length > 0
        ? breakTimes.map((bt) => ({
            start: parseTimeString(bt.start)!,
            end: parseTimeString(bt.end)!,
            label: bt.label || 'Break',
          }))
        : undefined,
    };

    const config: AvailabilityConfig = {
      ...initialConfig,
      slotDuration: appointmentDuration,
    };

    onComplete(availability, config);
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">
            Step {step} of 5
          </span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="mb-6 min-h-[280px]">
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Business Information</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Enter your business name to get started
            </p>

            <div>
              <label
                htmlFor="businessName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Business Name
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Acme Consulting"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Available Days</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Select the days when you are available
            </p>

            <div className="grid grid-cols-2 gap-3">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => handleDayToggle(day.value)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedDays.includes(day.value)
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="font-semibold">{day.short}</div>
                  <div className="text-xs mt-1">{day.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Available Hours</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Set your operating hours
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="startTime"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Start Time
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="endTime"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  End Time
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  You will be available from{' '}
                  <span className="font-semibold">{startTime}</span> to{' '}
                  <span className="font-semibold">{endTime}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Appointment Settings</h2>
            <p className="text-gray-600 mb-6 text-sm">
              How long does each appointment take?
            </p>

            <div>
              <label
                htmlFor="duration"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Appointment Duration (minutes)
              </label>
              <select
                id="duration"
                value={appointmentDuration}
                onChange={(e) => setAppointmentDuration(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Each appointment will be{' '}
                  <span className="font-semibold">{appointmentDuration} minutes</span> long
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Break Times (Optional)</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Set lunch breaks or unavailable times
            </p>

            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {breakTimes.map((breakTime, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">
                      Start
                    </label>
                    <input
                      type="time"
                      value={breakTime.start}
                      onChange={(e) => {
                        const updated = [...breakTimes];
                        updated[index].start = e.target.value;
                        setBreakTimes(updated);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">
                      End
                    </label>
                    <input
                      type="time"
                      value={breakTime.end}
                      onChange={(e) => {
                        const updated = [...breakTimes];
                        updated[index].end = e.target.value;
                        setBreakTimes(updated);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setBreakTimes(breakTimes.filter((_, i) => i !== index))}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => setBreakTimes([...breakTimes, { start: '12:00', end: '13:00', label: 'Lunch' }])}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors text-sm"
              >
                + Add Break Time
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          {errors.map((error, index) => (
            <p key={index} className="text-sm text-red-600">
              {error}
            </p>
          ))}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={step === 1}
          className={`px-4 py-2 rounded-lg transition-colors ${
            step === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Previous
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {step === 5 ? 'Complete' : 'Next'}
        </button>
      </div>
    </div>
  );
};

