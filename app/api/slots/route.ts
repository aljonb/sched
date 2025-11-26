/**
 * Available Slots API Route
 * 
 * Generates and returns available time slots for a business on a specific date
 * This endpoint considers:
 * - Business hours and available days
 * - Break times
 * - Existing appointments
 * - Blocked slots
 * - Min/max advance booking rules
 * - Only returns future slots
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getBusinessById, 
  getAppointmentsForBusiness, 
  getBlockedSlotsForBusiness 
} from '@/lib/booking/db';
import { generateAvailableSlots } from '@/lib/booking/slots';
import { startOfDay, endOfDay } from 'date-fns';

/**
 * GET /api/slots
 * 
 * Fetches available time slots for a business on a specific date
 * 
 * Query params:
 * - business_id (required): Business UUID
 * - date (required): ISO date string (e.g., "2025-11-27")
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     slots: Array<{ start: string, end: string }>,
 *     count: number
 *   }
 * }
 * 
 * @example
 * GET /api/slots?business_id=123&date=2025-11-27
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id');
    const dateParam = searchParams.get('date');

    // Validate required parameters
    if (!businessId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: business_id' 
        },
        { status: 400 }
      );
    }

    if (!dateParam) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: date (ISO format, e.g., "2025-11-27")' 
        },
        { status: 400 }
      );
    }

    // Parse and validate date
    const date = new Date(dateParam);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid date format. Use ISO format, e.g., "2025-11-27"' 
        },
        { status: 400 }
      );
    }

    // Fetch business configuration
    const businessResult = await getBusinessById(businessId);
    if (!businessResult.success) {
      return NextResponse.json(
        { success: false, error: businessResult.error },
        { status: 500 }
      );
    }

    if (!businessResult.data) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    const business = businessResult.data;

    // Fetch appointments for the date (with some buffer)
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const [appointmentsResult, blockedSlotsResult] = await Promise.all([
      getAppointmentsForBusiness(businessId, dayStart, dayEnd),
      getBlockedSlotsForBusiness(businessId, dayStart, dayEnd),
    ]);

    if (!appointmentsResult.success) {
      return NextResponse.json(
        { success: false, error: appointmentsResult.error },
        { status: 500 }
      );
    }

    if (!blockedSlotsResult.success) {
      return NextResponse.json(
        { success: false, error: blockedSlotsResult.error },
        { status: 500 }
      );
    }

    // Filter only active appointments (pending/confirmed)
    const activeAppointments = appointmentsResult.data.filter(
      (apt) => apt.status === 'pending' || apt.status === 'confirmed'
    );

    // Generate available slots
    const availableSlots = generateAvailableSlots(
      business,
      date,
      activeAppointments,
      blockedSlotsResult.data
    );

    // Convert Date objects to ISO strings for JSON serialization
    const slotsData = availableSlots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    }));

    return NextResponse.json(
      { 
        success: true, 
        data: {
          slots: slotsData,
          count: slotsData.length,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating available slots:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

