# Business Onboarding Setup Guide

This guide will help you complete the Clerk + Supabase integration for the business onboarding flow.

## Overview

We've implemented a complete business onboarding system that:
- ✅ Uses Clerk for authentication
- ✅ Stores business data in Supabase
- ✅ Respects Row Level Security (RLS) using Clerk JWT tokens
- ✅ Provides a smooth onboarding experience
- ✅ Falls back to localStorage for backwards compatibility

## Setup Steps

### 1. Configure Clerk + Supabase Integration

#### In Clerk Dashboard:
1. Go to https://dashboard.clerk.com/setup/supabase
2. Select your configuration options
3. Click **"Activate Supabase integration"**
4. **Copy the Clerk domain** that appears (e.g., `your-app-12345.clerk.accounts.dev`)

#### In Supabase Dashboard:
1. Go to your Supabase Dashboard
2. Navigate to **Authentication → Sign In / Up → Third Party Providers**
3. Scroll down and click **"Add provider"**
4. Select **"Clerk"** from the list
5. Paste the **Clerk domain** you copied earlier
6. Click **Save**

### 2. Apply Database Migration

Run the new migration to update RLS policies for Clerk:

```bash
cd /home/aljon/Desktop/sched/sched
npx supabase db push
```

Or apply the specific migration:

```bash
psql $DATABASE_URL -f supabase/migrations/20251125_update_rls_for_clerk.sql
```

**What this migration does:**
- Drops old RLS policies that used `auth.uid()`
- Creates new RLS policies that use `auth.jwt()->>'sub'` (Clerk user ID)
- Maintains all security constraints

### 3. Verify Environment Variables

Make sure these are set in your `.env.local`:

```env
# Clerk (should already be configured)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Supabase (should already be configured)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Test the Integration

#### Test 1: User Registration and Onboarding
1. Start your dev server: `npm run dev`
2. Sign up as a new user
3. Navigate to `/onboarding`
4. Complete the AvailabilityWizard
5. Verify you're redirected to the main page
6. Check Supabase Dashboard → `businesses` table for the new record

#### Test 2: RLS Policies
1. In Supabase Dashboard, go to **SQL Editor**
2. Run this query to verify your business was created:
   ```sql
   SELECT * FROM businesses WHERE owner_id = 'YOUR_CLERK_USER_ID';
   ```
3. The `owner_id` should match your Clerk user ID (visible in Clerk Dashboard)

#### Test 3: Cross-User Security
1. Sign out and create a second user account
2. Complete onboarding for the second user
3. Verify each user can only see their own business data
4. Check the `businesses` table - both records should exist

#### Test 4: Backwards Compatibility
1. Sign out
2. Open browser DevTools → Application → Local Storage
3. You should see `business-availability` and `availability-config` keys
4. These provide offline/fallback access

### 5. Verify RLS is Working

Run this SQL in Supabase to test RLS:

```sql
-- This should return only YOUR business (when authenticated)
SELECT * FROM businesses;

-- This should show all active businesses (public policy)
SELECT * FROM businesses WHERE is_active = true;

-- This should fail (trying to access another user's business)
SELECT * FROM businesses WHERE owner_id != auth.jwt()->>'sub';
```

## Architecture Overview

### Data Flow

```
User completes onboarding
    ↓
AvailabilityWizard → onComplete callback
    ↓
saveAvailability() in useAvailability hook
    ↓
createBusiness() in business-service.ts
    ↓
Supabase client (with Clerk token)
    ↓
Database INSERT (RLS checks owner_id)
    ↓
Success → redirect to main page
```

### Type Conversion

Client-side format (used in UI):
```typescript
{
  availableDays: [1, 2, 3, 4, 5],  // numbers
  availableHours: {
    start: { hour: 9, minute: 0 },
    end: { hour: 17, minute: 0 }
  }
}
```

Database format:
```typescript
{
  available_days: ["monday", "tuesday", ...],  // strings
  available_hours: {
    start: "09:00",
    end: "17:00"
  }
}
```

Conversion handled by: `lib/booking/converters.ts`

## File Structure

### New Files Created
- `lib/booking/converters.ts` - Type conversion between client/DB formats
- `lib/booking/business-service.ts` - Database operations for businesses
- `utils/supabase/clerk-client.ts` - Client-side Supabase with Clerk auth
- `utils/supabase/clerk-server.ts` - Server-side Supabase with Clerk auth
- `app/onboarding/page.tsx` - Onboarding page component
- `supabase/migrations/20251125_update_rls_for_clerk.sql` - RLS updates

### Modified Files
- `hooks/useAvailability.ts` - Now async, integrates with database
- `app/page.tsx` - Updated to handle async saveAvailability

## Key Features

### 1. Clerk JWT Integration
- Session tokens automatically included in Supabase requests
- RLS policies validate using `auth.jwt()->>'sub'`
- No manual token management required

### 2. Security
- Row Level Security enforces data isolation
- Users can only access their own business data
- Public can view active businesses (for booking)
- Business owners can manage their appointments

### 3. Error Handling
- Graceful fallback to localStorage if DB fails
- Loading states for better UX
- Clear error messages
- Validation before saving

### 4. Backwards Compatibility
- Existing localStorage data still works
- Database takes precedence when available
- Smooth migration path

## Troubleshooting

### Issue: "Failed to create business"

**Check:**
1. Clerk integration is activated in Supabase
2. Migration has been applied
3. User is authenticated (check `useUser()` hook)
4. Environment variables are correct

**Debug:**
```typescript
// In browser console
const { session } = useSession();
const token = await session?.getToken();
console.log('Token:', token); // Should be a JWT
```

### Issue: "Permission denied" or empty results

**Check:**
1. RLS policies are correctly applied
2. Clerk domain matches in both dashboards
3. JWT token contains the `sub` claim

**Debug in Supabase SQL Editor:**
```sql
-- Check JWT contents
SELECT auth.jwt();

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'businesses';
```

### Issue: Onboarding page doesn't redirect

**Check:**
1. `configured` state in `useAvailability` hook
2. Browser console for errors
3. Network tab for failed requests

## Next Steps

After setup is complete:

1. **Add onboarding link** - Update your app navigation to include `/onboarding`
2. **Auto-redirect** - Redirect new users to `/onboarding` after signup
3. **Edit functionality** - Users can edit their business settings from main page
4. **Admin features** - Build admin dashboard to view all businesses
5. **Public booking** - Create public booking pages using business data

## Testing Checklist

- [ ] Clerk Supabase integration activated
- [ ] Migration applied successfully
- [ ] New user can complete onboarding
- [ ] Business record appears in Supabase
- [ ] User can only see their own business
- [ ] Multiple users have separate businesses
- [ ] Existing localStorage data still works
- [ ] Edit availability works
- [ ] Loading states display correctly
- [ ] Error messages are clear

## Support

If you encounter issues:

1. Check Supabase logs: Dashboard → Logs
2. Check browser console for errors
3. Verify JWT token structure
4. Test RLS policies in SQL editor
5. Review Clerk webhook logs (if using webhooks)

## Resources

- [Clerk + Supabase Integration Docs](https://clerk.com/docs/integrations/databases/supabase)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Clerk Session Tokens](https://clerk.com/docs/backend-requests/making/jwt-templates)






