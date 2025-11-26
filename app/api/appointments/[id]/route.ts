import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

/**
 * GET /api/appointments/[id]
 * 
 * Fetches a single appointment by ID (public access)
 * Also fetches the business name for display
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const appointmentId = params.id;

    if (!appointmentId) {
      return NextResponse.json(
        { success: false, error: 'Appointment ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient(cookies());

    // Fetch appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (appointmentError) {
      if (appointmentError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Appointment not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: appointmentError.message },
        { status: 400 }
      );
    }

    // Fetch business name
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('id', appointment.business_id)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          appointment,
          businessName: business?.business_name || 'Unknown Business',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

