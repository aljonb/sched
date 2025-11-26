/**
 * Appointments API Route
 * 
 * Handles appointment creation (booking) and fetching booked slots
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAppointment, getBookedSlotsForBusiness } from '@/lib/booking/db';
import { CreateAppointmentInput, AppointmentStatus } from '@/lib/booking/types';
import { safeValidateCreateAppointment } from '@/lib/booking/validation';

/**
 * GET /api/appointments
 * 
 * Fetches booked time slots for a business within a date range (public access)
 * Query params: business_id, start_date, end_date
 * Response: { success: true, data: Array<{ start_time, end_time }> } | { success: false, error: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!businessId || !startDate || !endDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameters: business_id, start_date, end_date' 
        },
        { status: 400 }
      );
    }

    const result = await getBookedSlotsForBusiness(businessId, startDate, endDate);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching booked slots:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/appointments
 * 
 * Creates a new appointment with validation and conflict prevention
 * 
 * Features:
 * - Comprehensive Zod validation (business rules, data types)
 * - Race condition protection via database triggers
 * - Graceful conflict handling with specific error messages
 * - Support for unauthenticated bookings (customer_id nullable)
 * 
 * Request body: CreateAppointmentInput
 * Response: { success: true, data: Appointment } | { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Step 1: Validate request body using Zod schema
    const validation = safeValidateCreateAppointment(body);
    
    if (!validation.success) {
      // Return validation errors with details
      const errorMessage = validation.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Validation failed: ${errorMessage}`,
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    // Step 2: Create appointment with 'confirmed' status
    // The database trigger will automatically:
    // - Check for race conditions (overlapping appointments)
    // - Verify slot is not blocked
    // - Generate booking token
    const input: CreateAppointmentInput = {
      ...validation.data,
      status: AppointmentStatus.CONFIRMED, // Set to confirmed per requirements
    };

    const result = await createAppointment(input);

    // Step 3: Handle conflicts gracefully
    if (!result.success) {
      // Check if this is a conflict error from the database trigger
      const isConflictError = 
        result.error.includes('conflict') || 
        result.error.includes('overlaps') ||
        result.error.includes('blocked');
      
      if (isConflictError) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'This time slot is no longer available. Please choose another time.',
            type: 'SLOT_UNAVAILABLE'
          },
          { status: 409 } // 409 Conflict
        );
      }

      // Other database errors
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          type: 'DATABASE_ERROR'
        },
        { status: 400 }
      );
    }

    // Step 4: Return created appointment with booking token
    return NextResponse.json(
      { 
        success: true, 
        data: result.data,
        message: 'Appointment successfully booked!'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        type: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}


