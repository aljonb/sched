# Booking System Database Implementation

## Overview
Complete database schema with automated validation, conflict prevention, and security policies for a robust booking/scheduling system.

## Migrations Applied

### 1. `20251125125028_create_booking_system.sql` - Core Schema
Creates the foundational tables for the booking system:

#### Tables Created:
- **`businesses`** - Stores business profiles and availability settings
- **`appointments`** - Stores all booking/appointment data
- **`blocked_slots`** - Stores time periods unavailable for booking

#### Features:
- ✅ Primary keys (UUID)
- ✅ Foreign key relationships with CASCADE behavior
- ✅ NOT NULL constraints where appropriate
- ✅ CHECK constraints for data validation
- ✅ UNIQUE constraints (booking_token)
- ✅ Indexes for performance
- ✅ Comments for documentation
- ✅ `handle_updated_at()` function with triggers for auto-updating timestamps

### 2. `20251125125703_add_public_appointments_view_policy.sql` - Availability Policy
Adds RLS policy allowing public to view confirmed/pending appointments for availability checking.

### 3. `20251125125933_add_triggers_for_validation.sql` - Automated Validation
Adds three critical trigger functions:

#### Functions & Triggers:
1. **`generate_booking_token()`** 
   - Automatically generates unique 32-character hex tokens
   - Trigger: `BEFORE INSERT` on appointments

2. **`prevent_appointment_conflicts()`**
   - Prevents overlapping appointments
   - Validates against blocked_slots
   - Raises descriptive errors on conflicts
   - Trigger: `BEFORE INSERT OR UPDATE` on appointments

3. **`set_cancelled_at()`**
   - Auto-sets cancelled_at timestamp when status changes to 'cancelled'
   - Auto-clears cancelled_at if status changes back
   - Trigger: `BEFORE INSERT OR UPDATE` on appointments

### 4. `20251125130058_fix_booking_token_trigger.sql` - Trigger Optimization
Ensures booking token trigger always fires correctly.

---

## Row Level Security (RLS)

All tables have RLS **enabled** with comprehensive policies:

### Businesses Table
| Policy | Who | Action | Condition |
|--------|-----|--------|-----------|
| Public read | Anyone | SELECT | `is_active = true` |
| Owner full access | Business owners | ALL | `owner_id = auth.uid()` |

### Appointments Table
| Policy | Who | Action | Condition |
|--------|-----|--------|-----------|
| Public availability | Anyone | SELECT | `status IN ('confirmed', 'pending')` |
| Public booking | Anyone | INSERT | Always allowed |
| Owner read/update | Business owners | SELECT, UPDATE | Via business ownership |
| Customer read | Customers | SELECT | `customer_id = auth.uid()` |
| Customer cancel | Customers | UPDATE | Only to cancelled status |

### Blocked Slots Table
| Policy | Who | Action | Condition |
|--------|-----|--------|-----------|
| Owner full access | Business owners | ALL | Via business ownership |

---

## Data Validation (Automated)

### Database-Level Constraints
- ✅ Valid email format (regex)
- ✅ Valid status values (pending, confirmed, cancelled, completed, no_show)
- ✅ Valid timezone format
- ✅ Time range validation (end_time > start_time)
- ✅ Duration limits (1-1440 minutes)
- ✅ Cancelled_at synced with status
- ✅ No overlapping appointments (unique index + trigger)

### Trigger-Based Validation
- ✅ Automatic conflict detection (appointments + blocked slots)
- ✅ Automatic booking token generation
- ✅ Automatic timestamp management
- ✅ Automatic cancellation timestamp handling

---

## Key Features

### 🔒 Security
- Row-level security on all tables
- Granular access control
- Owner-based permissions
- Public booking support with restrictions

### 🎯 Data Integrity
- Foreign key constraints with proper CASCADE/SET NULL
- CHECK constraints prevent invalid data
- Triggers prevent overlapping bookings
- Unique indexes prevent duplicates

### ⚡ Performance
- Strategic indexes on frequently queried columns
- Composite indexes for date range queries
- Partial indexes for optimization

### 🛠️ Developer Experience
- Automatic token generation (no manual handling)
- Automatic conflict detection (no application-layer checks needed)
- Automatic timestamp updates
- Clear error messages on conflicts
- Comprehensive comments/documentation

---

## Helper Functions

### `check_appointment_conflict(business_id, start_time, end_time, exclude_id)`
Returns BOOLEAN indicating if a time slot conflicts with existing appointments or blocked slots.

**Usage:** Can be called from application code for pre-validation before showing UI.

```sql
SELECT check_appointment_conflict(
  'business-uuid'::uuid,
  '2025-12-01 10:00:00+00'::timestamptz,
  '2025-12-01 10:30:00+00'::timestamptz,
  NULL
);
```

---

## Testing

See `supabase/TEST_TRIGGERS.sql` for comprehensive test queries.

### Quick Verification
```sql
-- Verify all triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('businesses', 'appointments', 'blocked_slots');
```

Expected triggers:
- `generate_booking_token_on_insert`
- `prevent_appointment_conflicts_on_change`
- `set_businesses_updated_at`
- `set_appointments_updated_at`
- `set_cancelled_at_on_status_change`

---

## What's Next?

### Application Layer (Still Needed)
1. **Availability calculation** - Query available slots based on business hours
2. **Booking API** - Create endpoints/server actions for CRUD operations
3. **Notifications** - Email/SMS confirmations and reminders
4. **UI Components** - Calendar views, booking forms, admin dashboards
5. **Payment integration** - If required for your use case

### Example Application Logic
```typescript
// You'll need to build functions like:
async function getAvailableSlots(businessId: string, date: Date) {
  // 1. Fetch business hours and breaks
  // 2. Generate time slots based on slot_duration_minutes
  // 3. Query existing appointments (use public policy)
  // 4. Query blocked_slots
  // 5. Return available slots
}

async function createBooking(data: BookingData) {
  // Simply INSERT - triggers handle:
  // - Token generation
  // - Conflict detection
  // - Timestamp management
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert(data)
    .select()
    .single();
  
  if (error?.code === 'P0001') {
    // Handle overlap with appointment
  } else if (error?.code === 'P0002') {
    // Handle overlap with blocked slot
  }
  
  return appointment;
}
```

---

## Status: ✅ Complete

All database infrastructure is in place and tested. The system is:
- ✅ **Reliable** - Automated validation prevents data corruption
- ✅ **Robust** - Multiple layers of constraints and triggers
- ✅ **Secure** - Comprehensive RLS policies
- ✅ **Concise** - Minimal application-layer validation needed
- ✅ **Simple** - Clear structure and well-documented

Ready for application development!






