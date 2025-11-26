/**
 * Appointments API Route
 * 
 * Handles appointment creation (booking) and fetching booked slots
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAppointment, getBookedSlotsForBusiness } from '@/lib/booking/db';
import { CreateAppointmentInput } from '@/lib/booking/types';

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
 * Creates a new appointment
 * 
 * Request body: CreateAppointmentInput
 * Response: { success: true, data: Appointment } | { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'business_id',
      'start_time',
      'end_time',
      'duration_minutes',
      'customer_email',
      'customer_name',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Missing required field: ${field}` 
          },
          { status: 400 }
        );
      }
    }

    // Create the appointment
    const input: CreateAppointmentInput = {
      business_id: body.business_id,
      customer_id: body.customer_id || null,
      start_time: body.start_time,
      end_time: body.end_time,
      duration_minutes: body.duration_minutes,
      customer_email: body.customer_email,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone || null,
      notes: body.notes || null,
    };

    const result = await createAppointment(input);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}


