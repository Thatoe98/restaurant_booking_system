import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Generate unique booking code
export function generateBookingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'BKD'
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Format date for display
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Format time for display
export function formatTime(time) {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

// Get available time slots
export function getTimeSlots() {
  const slots = []
  for (let hour = 11; hour <= 22; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    slots.push(`${hour.toString().padStart(2, '0')}:30`)
  }
  return slots
}

// Subscribe to table updates
export function subscribeToTables(callback) {
  return supabase
    .channel('tables-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tables'
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()
}

// Subscribe to booking updates
export function subscribeToBookings(callback) {
  return supabase
    .channel('bookings-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings'
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()
}

// Fetch all tables
export async function fetchTables() {
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .order('id')
  
  if (error) throw error
  return data
}

// Fetch bookings for a specific date
export async function fetchBookingsForDate(date) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('booking_date', date)
    .not('status', 'eq', 'cancelled')
  
  if (error) throw error
  return data
}

// Fetch all bookings for today
export async function fetchTodayBookings() {
  const today = new Date().toISOString().split('T')[0]
  return fetchBookingsForDate(today)
}

// Create a new booking
export async function createBooking(bookingData) {
  const { data, error } = await supabase
    .from('bookings')
    .insert([bookingData])
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Update table status - NO LONGER NEEDED
// Table status is now computed dynamically from bookings
export async function updateTableStatus(tableId, status, bookingId = null) {
  // This function is now a no-op
  // Status is computed in the frontend based on active bookings
  console.log('updateTableStatus is deprecated - status computed from bookings')
  return { id: tableId }
}

// Update booking status
export async function updateBookingStatus(bookingId, status) {
  const updateData = { status }
  
  if (status === 'checked_in') {
    updateData.checked_in_at = new Date().toISOString()
  } else if (status === 'completed') {
    updateData.completed_at = new Date().toISOString()
  } else if (status === 'cancelled') {
    updateData.cancelled_at = new Date().toISOString()
  }
  
  const { data, error } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', bookingId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Add audit log entry
export async function addAuditLog(logData) {
  const { data, error } = await supabase
    .from('audit_log')
    .insert([logData])
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Get booking by code
export async function getBookingByCode(code) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, tables(*)')
    .eq('booking_code', code)
    .single()
  
  if (error) throw error
  return data
}

// Check table availability for a specific date and time
export async function checkTableAvailability(tableId, date, time, duration = 120) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('table_id', tableId)
    .eq('booking_date', date)
    .not('status', 'in', '("cancelled")')
  
  if (error) throw error
  
  // Check if any existing booking overlaps with requested time
  const requestedStart = timeToMinutes(time)
  const requestedEnd = requestedStart + duration
  
  for (const booking of bookings) {
    const bookingStart = timeToMinutes(booking.booking_time)
    const bookingEnd = bookingStart + (booking.duration_minutes || 120)
    
    // Check for overlap
    if (requestedStart < bookingEnd && requestedEnd > bookingStart) {
      return false
    }
  }
  
  return true
}

// Helper: convert time string to minutes
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
