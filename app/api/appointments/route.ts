/**
 * Appointments API Route
 * 
 * Handles appointment creation (booking)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAppointment } from '@/lib/booking/db';
import { CreateAppointmentInput } from '@/lib/booking/types';

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

