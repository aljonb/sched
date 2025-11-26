# Slot Generation System

Comprehensive slot generation for the booking system that respects all business rules, constraints, and existing bookings.

## Overview

The slot generation system (`/lib/booking/slots.ts`) provides a robust, server-side solution for determining which time slots are available for booking. It considers:

1. ✅ Business hours and available days
2. ✅ Break times (lunch breaks, etc.)
3. ✅ Existing appointments (pending/confirmed)
4. ✅ Blocked slots (manually blocked time periods)
5. ✅ Min/max advance booking rules
6. ✅ Only returns future slots (not in the past)

## Database Schema

### New Fields Added to `businesses` Table

```sql
min_advance_booking_minutes INTEGER NOT NULL DEFAULT 0
  -- Minimum minutes in advance required to book (0-43200)
  -- 0 = immediate booking allowed
  -- Example: 60 = must book at least 1 hour in advance

max_advance_booking_days INTEGER NOT NULL DEFAULT 90
  -- Maximum days in advance allowed to book (1-365)
  -- Example: 90 = can book up to 90 days in the future
```

Migration file: `supabase/migrations/20251126130000_add_advance_booking_constraints.sql`

## Core Function

### `generateAvailableSlots()`

```typescript
function generateAvailableSlots(
  business: Business,
  date: Date,
  existingAppointments: Appointment[],
  blockedSlots: BlockedSlot[],
  now?: Date
): AvailableSlot[]
```

**Parameters:**
- `business` - Business configuration from database
- `date` - Target date to generate slots for
- `existingAppointments` - Active appointments (filter to pending/confirmed only)
- `blockedSlots` - Manually blocked time periods
- `now` - (Optional) Current time, defaults to `new Date()`

**Returns:**
- Array of `AvailableSlot` objects: `{ start: Date, end: Date }`

## Usage Examples

### Example 1: API Route (Recommended)

```typescript
// app/api/slots/route.ts
import { 
  getBusinessById, 
  getAppointmentsForBusiness, 
  getBlockedSlotsForBusiness 
} from '@/lib/booking/db';
import { generateAvailableSlots } from '@/lib/booking/slots';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  const businessId = searchParams.get('business_id');
  const date = new Date(searchParams.get('date'));

  // Fetch business config
  const businessResult = await getBusinessById(businessId);
  const business = businessResult.data;

  // Fetch appointments and blocked slots for the date
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [appointmentsResult, blockedSlotsResult] = await Promise.all([
    getAppointmentsForBusiness(businessId, dayStart, dayEnd),
    getBlockedSlotsForBusiness(businessId, dayStart, dayEnd),
  ]);

  // Filter to active appointments only
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

  return NextResponse.json({ slots: availableSlots });
}
```

### Example 2: Server Component

```typescript
// app/booking/[businessId]/page.tsx
import { generateAvailableSlots } from '@/lib/booking/slots';
import { 
  getBusinessById, 
  getAppointmentsForBusiness, 
  getBlockedSlotsForBusiness 
} from '@/lib/booking/db';

export default async function BookingPage({ 
  params 
}: { 
  params: { businessId: string } 
}) {
  const businessResult = await getBusinessById(params.businessId);
  const business = businessResult.data;

  const today = new Date();
  const [appointmentsResult, blockedSlotsResult] = await Promise.all([
    getAppointmentsForBusiness(params.businessId, today, today),
    getBlockedSlotsForBusiness(params.businessId, today, today),
  ]);

  const slots = generateAvailableSlots(
    business,
    today,
    appointmentsResult.data,
    blockedSlotsResult.data
  );

  return (
    <div>
      <h1>{business.business_name} - Available Slots</h1>
      <ul>
        {slots.map((slot, idx) => (
          <li key={idx}>
            {slot.start.toLocaleTimeString()} - {slot.end.toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 3: Testing with Custom Time

```typescript
import { generateAvailableSlots } from '@/lib/booking/slots';

// Test what slots would be available "as of" a specific time
const testDate = new Date('2025-11-27T09:00:00Z');
const currentTime = new Date('2025-11-26T14:00:00Z'); // Simulate current time

const slots = generateAvailableSlots(
  business,
  testDate,
  appointments,
  blockedSlots,
  currentTime // Override "now"
);

console.log(`${slots.length} slots available as of ${currentTime}`);
```

## API Endpoint

### `GET /api/slots`

Fetch available slots for a business on a specific date.

**Query Parameters:**
- `business_id` (required) - Business UUID
- `date` (required) - ISO date string (e.g., "2025-11-27")

**Example Request:**
```bash
curl "http://localhost:3000/api/slots?business_id=123e4567-e89b-12d3-a456-426614174000&date=2025-11-27"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "slots": [
      {
        "start": "2025-11-27T09:00:00.000Z",
        "end": "2025-11-27T10:00:00.000Z"
      },
      {
        "start": "2025-11-27T10:00:00.000Z",
        "end": "2025-11-27T11:00:00.000Z"
      },
      {
        "start": "2025-11-27T14:00:00.000Z",
        "end": "2025-11-27T15:00:00.000Z"
      }
    ],
    "count": 3
  }
}
```

## Business Configuration

Configure advance booking rules when creating or updating a business:

```typescript
import { createBusiness } from '@/lib/booking/business-service';

const business = await createBusiness(
  supabase,
  userId,
  {
    businessName: "My Salon",
    availableDays: [1, 2, 3, 4, 5], // Mon-Fri
    availableHours: {
      start: { hour: 9, minute: 0 },
      end: { hour: 17, minute: 0 }
    },
    breakTimes: [
      {
        start: { hour: 12, minute: 0 },
        end: { hour: 13, minute: 0 }
      }
    ]
  },
  {
    slotDuration: 60, // 1-hour appointments
    timezone: 'America/New_York',
    minAdvanceBooking: 120, // Must book at least 2 hours in advance
    maxAdvanceBooking: 60,  // Can book up to 60 days in advance
  }
);
```

## Algorithm Details

The slot generation algorithm follows this process:

1. **Day Check**: Verify the date is an available day of the week
2. **Slot Generation**: Create all possible slots based on business hours and slot duration
3. **Past Filter**: Remove slots that have already ended
4. **Min Advance Filter**: Remove slots that don't meet minimum advance booking time
5. **Max Advance Filter**: Remove slots that exceed maximum advance booking time
6. **Break Filter**: Remove slots that overlap with break times
7. **Appointment Filter**: Remove slots that conflict with existing appointments
8. **Blocked Filter**: Remove slots that are manually blocked

## Performance Considerations

- **Efficient**: Single-pass algorithm, O(n) time complexity
- **Database Queries**: Fetch appointments and blocked slots in parallel
- **Caching**: Consider caching slot results for frequently accessed dates
- **Pagination**: For businesses with many small slots, consider paginating results

## Type Safety

All functions are fully typed with TypeScript:

```typescript
interface AvailableSlot {
  start: Date;
  end: Date;
}

interface Business {
  // ... includes min_advance_booking_minutes, max_advance_booking_days
}

interface Appointment {
  // ... includes status, start_time, end_time
}

interface BlockedSlot {
  // ... includes start_time, end_time, reason
}
```

## Testing

```typescript
import { generateAvailableSlots } from '@/lib/booking/slots';

describe('generateAvailableSlots', () => {
  it('respects business hours', () => {
    const business = {
      available_hours: { start: '09:00', end: '17:00' },
      // ...
    };
    
    const slots = generateAvailableSlots(business, date, [], []);
    
    expect(slots[0].start.getHours()).toBe(9);
    expect(slots[slots.length - 1].end.getHours()).toBeLessThanOrEqual(17);
  });

  it('excludes past slots', () => {
    const now = new Date('2025-11-27T14:00:00Z');
    const date = new Date('2025-11-27');
    
    const slots = generateAvailableSlots(business, date, [], [], now);
    
    slots.forEach(slot => {
      expect(slot.end.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
```

## Related Files

- `/lib/booking/slots.ts` - Core slot generation logic
- `/lib/booking/types.ts` - TypeScript type definitions
- `/lib/booking/db.ts` - Database query functions
- `/app/api/slots/route.ts` - API endpoint for fetching slots
- `/supabase/migrations/20251126130000_add_advance_booking_constraints.sql` - Database migration

## Migration Instructions

To apply the database changes:

```bash
# Using Supabase CLI
supabase db push

# Or apply the migration file directly in your database
psql -U postgres -d your_database -f supabase/migrations/20251126130000_add_advance_booking_constraints.sql
```

After migration, update your business records to set appropriate values:

```sql
-- Example: Set defaults for existing businesses
UPDATE public.businesses
SET 
  min_advance_booking_minutes = 60,  -- 1 hour minimum
  max_advance_booking_days = 90      -- 90 days maximum
WHERE min_advance_booking_minutes IS NULL;
```

