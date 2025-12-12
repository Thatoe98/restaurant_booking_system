-- ============================================
-- DATABASE CLEANUP: Remove redundant columns
-- ============================================
-- The table status is now computed dynamically from bookings.
-- These columns are no longer needed.
-- ============================================

-- STEP 1: Remove the status and current_booking_id columns from tables
-- (These are now computed dynamically in the frontend)

ALTER TABLE public.tables 
DROP COLUMN IF EXISTS status;

ALTER TABLE public.tables 
DROP COLUMN IF EXISTS current_booking_id;

-- STEP 2: Drop the table_status enum type if no longer used
-- (Check if any other tables use it first)
DROP TYPE IF EXISTS table_status;

-- STEP 3: Reset all tables to a clean state
-- (The columns are removed, so tables only contain: id, table_number, capacity, properties, created_at, updated_at)

-- ============================================
-- OPTIONAL: View your cleaned up schema
-- ============================================
-- Run this to see the new structure:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tables';

-- ============================================
-- NEW DESIGN EXPLANATION
-- ============================================
-- 
-- OLD DESIGN (problematic):
--   - tables.status stored 'available', 'booked', 'occupied'
--   - tables.current_booking_id linked to active booking
--   - Problem: These got stale and out of sync!
--
-- NEW DESIGN (better):
--   - Table status is COMPUTED from bookings in real-time
--   - Frontend queries bookings for the selected date
--   - Logic:
--     * No booking → Available
--     * Booking with status='confirmed' within 1 hour → Booked
--     * Booking with status='confirmed' more than 1 hour away → Available (for walk-ins)
--     * Booking with status='confirmed' 30+ mins overdue → Available (no-show)
--     * Booking with status='checked_in' → Occupied/Checked In
--
-- This eliminates stale data issues entirely!
-- ============================================
