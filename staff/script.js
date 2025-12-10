import {
  supabase,
  generateBookingCode,
  formatDate,
  formatTime,
  fetchTables,
  fetchBookingsForDate,
  createBooking,
  updateTableStatus,
  updateBookingStatus,
  addAuditLog,
  subscribeToTables,
  subscribeToBookings
} from '../src/supabase.js'

// State
let tables = []
let bookings = []
let selectedTable = null
let selectedDate = new Date().toISOString().split('T')[0]

// DOM Elements
const dateInput = document.getElementById('dashboard-date')
const tablesGrid = document.getElementById('tables-grid')
const bookingsList = document.getElementById('bookings-list')
const detailsPanel = document.getElementById('details-panel')
const loading = document.getElementById('loading')
const toast = document.getElementById('toast')

// Initialize
document.addEventListener('DOMContentLoaded', init)

async function init() {
  setupDateSelector()
  setupRefreshButton()
  setupModals()
  await loadData()
  setupRealtimeSubscription()
}

// Date Selector
function setupDateSelector() {
  dateInput.value = selectedDate
  
  dateInput.addEventListener('change', async (e) => {
    selectedDate = e.target.value
    await loadData()
  })
  
  document.getElementById('prev-day').addEventListener('click', async () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() - 1)
    selectedDate = date.toISOString().split('T')[0]
    dateInput.value = selectedDate
    await loadData()
  })
  
  document.getElementById('next-day').addEventListener('click', async () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + 1)
    selectedDate = date.toISOString().split('T')[0]
    dateInput.value = selectedDate
    await loadData()
  })
}

// Refresh Button
function setupRefreshButton() {
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await loadData()
    showToast('Data refreshed', 'success')
  })
}

// Load Data
async function loadData() {
  loading.style.display = 'flex'
  
  try {
    tables = await fetchTables()
    bookings = await fetchBookingsForDate(selectedDate)
    
    renderTables()
    renderBookings()
    updateStats()
    
    // Update bookings date display
    document.getElementById('bookings-date').textContent = formatDate(selectedDate)
    
    // Clear selection
    selectedTable = null
    showPanelPlaceholder()
    
  } catch (error) {
    console.error('Error loading data:', error)
    showToast('Failed to load data', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

// Real-time subscriptions
function setupRealtimeSubscription() {
  subscribeToTables((payload) => {
    console.log('Table update:', payload)
    const index = tables.findIndex(t => t.id === payload.new.id)
    if (index !== -1) {
      tables[index] = payload.new
    }
    renderTables()
    updateStats()
    
    // Update panel if this table is selected
    if (selectedTable && selectedTable.id === payload.new.id) {
      selectedTable = payload.new
      showTableDetails(selectedTable)
    }
  })
  
  subscribeToBookings(async (payload) => {
    console.log('Booking update:', payload)
    // Reload bookings for current date
    bookings = await fetchBookingsForDate(selectedDate)
    renderBookings()
    renderTables()
    updateStats()
  })
}

// Render Tables
function renderTables() {
  const today = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === today
  
  tablesGrid.innerHTML = tables.map(table => {
    // Find booking for this table today
    const tableBooking = bookings.find(b => 
      b.table_id === table.id && 
      b.status !== 'cancelled' && 
      b.status !== 'completed'
    )
    
    let statusClass = table.status
    let timeDisplay = ''
    
    // If there's a confirmed booking, show as booked with time
    if (tableBooking && tableBooking.status === 'confirmed') {
      statusClass = 'booked'
      timeDisplay = formatTime(tableBooking.booking_time)
    } else if (tableBooking && tableBooking.status === 'checked_in') {
      statusClass = 'checked-in'
      timeDisplay = 'Checked In'
    }
    
    const selected = selectedTable && selectedTable.id === table.id ? 'selected' : ''
    
    return `
      <div class="table-item ${statusClass} ${selected}" data-id="${table.id}">
        <span class="table-number">${table.table_number}</span>
        <span class="table-capacity">${table.capacity} guests</span>
        ${timeDisplay ? `<span class="table-time">${timeDisplay}</span>` : ''}
      </div>
    `
  }).join('')
  
  // Add click handlers
  tablesGrid.querySelectorAll('.table-item').forEach(item => {
    item.addEventListener('click', () => {
      const tableId = parseInt(item.dataset.id)
      const table = tables.find(t => t.id === tableId)
      selectTable(table)
    })
  })
}

// Select Table
function selectTable(table) {
  selectedTable = table
  
  // Update visual selection
  tablesGrid.querySelectorAll('.table-item').forEach(item => {
    item.classList.toggle('selected', parseInt(item.dataset.id) === table.id)
  })
  
  showTableDetails(table)
}

// Show Table Details
function showTableDetails(table) {
  document.getElementById('panel-placeholder').style.display = 'none'
  document.getElementById('panel-content').style.display = 'block'
  
  // Basic info
  document.getElementById('panel-table-number').textContent = table.table_number
  document.getElementById('panel-capacity').textContent = table.capacity
  document.getElementById('panel-properties').textContent = 
    (table.properties && table.properties.length > 0) ? table.properties.join(', ') : 'Standard'
  
  // Find booking for this table
  const tableBooking = bookings.find(b => 
    b.table_id === table.id && 
    b.status !== 'cancelled' && 
    b.status !== 'completed'
  )
  
  // Status badge
  const statusBadge = document.getElementById('panel-status')
  let displayStatus = table.status
  
  if (tableBooking) {
    if (tableBooking.status === 'checked_in') {
      displayStatus = 'checked-in'
    } else if (tableBooking.status === 'confirmed') {
      displayStatus = 'booked'
    }
  }
  
  statusBadge.textContent = displayStatus.replace('-', ' ')
  statusBadge.className = `status-badge ${displayStatus}`
  
  // Booking details
  const bookingDetails = document.getElementById('booking-details')
  if (tableBooking) {
    bookingDetails.style.display = 'block'
    document.getElementById('booking-code').textContent = tableBooking.booking_code
    document.getElementById('booking-name').textContent = tableBooking.customer_name
    document.getElementById('booking-phone').textContent = tableBooking.customer_phone
    document.getElementById('booking-email').textContent = tableBooking.customer_email || 'N/A'
    document.getElementById('booking-time').textContent = formatTime(tableBooking.booking_time)
    document.getElementById('booking-party').textContent = `${tableBooking.party_size} guests`
    document.getElementById('booking-status').textContent = tableBooking.status
    
    if (tableBooking.special_requests) {
      document.getElementById('booking-requests-row').style.display = 'block'
      document.getElementById('booking-requests').textContent = tableBooking.special_requests
    } else {
      document.getElementById('booking-requests-row').style.display = 'none'
    }
  } else {
    bookingDetails.style.display = 'none'
  }
  
  // Action buttons
  renderActionButtons(table, tableBooking)
}

// Render Action Buttons
function renderActionButtons(table, booking) {
  const actionsContainer = document.getElementById('panel-actions')
  let buttons = ''
  
  if (table.status === 'available' && !booking) {
    // Available table - can mark as walk-in or create phone booking
    buttons = `
      <button class="btn btn-warning" onclick="openWalkinModal()">👤 Walk-in</button>
      <button class="btn btn-info" onclick="openPhoneBookingModal()">📞 Phone Booking</button>
    `
  } else if (booking && booking.status === 'confirmed') {
    // Booked table - can check in or cancel
    buttons = `
      <button class="btn btn-success" onclick="checkInBooking('${booking.id}')">✅ Check In</button>
      <button class="btn btn-danger" onclick="cancelBooking('${booking.id}')">❌ Cancel Booking</button>
    `
  } else if (booking && booking.status === 'checked_in') {
    // Checked in - can complete
    buttons = `
      <button class="btn btn-primary" onclick="completeBooking('${booking.id}')">🏁 Complete & Free Table</button>
    `
  } else if (table.status === 'occupied' && !booking) {
    // Occupied (walk-in) - can free
    buttons = `
      <button class="btn btn-primary" onclick="freeTable(${table.id})">🔓 Free Up Table</button>
    `
  }
  
  actionsContainer.innerHTML = buttons
}

// Show panel placeholder
function showPanelPlaceholder() {
  document.getElementById('panel-placeholder').style.display = 'block'
  document.getElementById('panel-content').style.display = 'none'
}

// Render Bookings List
function renderBookings() {
  const sortedBookings = [...bookings]
    .filter(b => b.status !== 'cancelled' && b.status !== 'completed')
    .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
  
  if (sortedBookings.length === 0) {
    bookingsList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">No bookings for this date</p>'
    return
  }
  
  bookingsList.innerHTML = sortedBookings.map(booking => {
    const table = tables.find(t => t.id === booking.table_id)
    return `
      <div class="booking-card ${booking.status}">
        <div class="booking-card-header">
          <span class="booking-card-time">${formatTime(booking.booking_time)}</span>
          <span class="booking-card-table">Table ${table ? table.table_number : '?'}</span>
        </div>
        <div class="booking-card-body">
          <p><strong>${booking.customer_name}</strong></p>
          <p>📱 ${booking.customer_phone}</p>
          <p>👥 ${booking.party_size} guests</p>
          <p>🔖 ${booking.booking_code}</p>
        </div>
      </div>
    `
  }).join('')
}

// Update Stats
function updateStats() {
  const available = tables.filter(t => t.status === 'available').length
  const occupied = tables.filter(t => t.status === 'occupied').length
  
  // Count booked based on bookings for today
  const bookedTableIds = new Set(
    bookings
      .filter(b => b.status === 'confirmed' || b.status === 'checked_in')
      .map(b => b.table_id)
  )
  const booked = bookedTableIds.size
  
  const total = tables.length
  const occupancy = total > 0 ? Math.round(((occupied + booked) / total) * 100) : 0
  
  document.getElementById('stat-available').textContent = available
  document.getElementById('stat-booked').textContent = booked
  document.getElementById('stat-occupied').textContent = occupied
  document.getElementById('stat-occupancy').textContent = `${occupancy}%`
}

// Modal Setup
function setupModals() {
  // Walk-in modal
  document.getElementById('walkin-cancel').addEventListener('click', () => {
    document.getElementById('walkin-modal').style.display = 'none'
  })
  
  document.getElementById('walkin-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    await handleWalkin()
  })
  
  // Phone booking modal
  document.getElementById('phone-cancel').addEventListener('click', () => {
    document.getElementById('phone-booking-modal').style.display = 'none'
  })
  
  document.getElementById('phone-booking-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    await handlePhoneBooking()
  })
}

// Global functions for button onclick
window.openWalkinModal = function() {
  if (!selectedTable) return
  document.getElementById('walkin-table-number').textContent = selectedTable.table_number
  document.getElementById('walkin-modal').style.display = 'flex'
}

window.openPhoneBookingModal = function() {
  if (!selectedTable) return
  document.getElementById('phone-table-number').textContent = selectedTable.table_number
  
  // Set default time to now
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = Math.floor(now.getMinutes() / 30) * 30
  document.getElementById('phone-booking-time').value = `${hours}:${minutes.toString().padStart(2, '0')}`
  
  document.getElementById('phone-booking-modal').style.display = 'flex'
}

window.checkInBooking = async function(bookingId) {
  loading.style.display = 'flex'
  
  try {
    await updateBookingStatus(bookingId, 'checked_in')
    
    // Add audit log
    const booking = bookings.find(b => b.id === bookingId)
    await addAuditLog({
      table_id: selectedTable.id,
      booking_id: bookingId,
      action_type: 'checked_in',
      action_by: 'Staff',
      notes: `Customer ${booking.customer_name} checked in`,
      previous_status: 'confirmed',
      new_status: 'checked_in'
    })
    
    showToast('Customer checked in successfully', 'success')
    await loadData()
    
  } catch (error) {
    console.error('Check-in error:', error)
    showToast('Failed to check in', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

window.cancelBooking = async function(bookingId) {
  if (!confirm('Are you sure you want to cancel this booking?')) return
  
  loading.style.display = 'flex'
  
  try {
    await updateBookingStatus(bookingId, 'cancelled')
    await updateTableStatus(selectedTable.id, 'available', null)
    
    // Add audit log
    const booking = bookings.find(b => b.id === bookingId)
    await addAuditLog({
      table_id: selectedTable.id,
      booking_id: bookingId,
      action_type: 'cancelled',
      action_by: 'Staff',
      notes: `Booking ${booking.booking_code} cancelled`,
      previous_status: booking.status,
      new_status: 'cancelled'
    })
    
    showToast('Booking cancelled', 'success')
    await loadData()
    
  } catch (error) {
    console.error('Cancel error:', error)
    showToast('Failed to cancel booking', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

window.completeBooking = async function(bookingId) {
  loading.style.display = 'flex'
  
  try {
    await updateBookingStatus(bookingId, 'completed')
    await updateTableStatus(selectedTable.id, 'available', null)
    
    // Add audit log
    await addAuditLog({
      table_id: selectedTable.id,
      booking_id: bookingId,
      action_type: 'completed',
      action_by: 'Staff',
      notes: 'Booking completed, table freed',
      previous_status: 'checked_in',
      new_status: 'completed'
    })
    
    showToast('Table freed successfully', 'success')
    await loadData()
    
  } catch (error) {
    console.error('Complete error:', error)
    showToast('Failed to complete booking', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

window.freeTable = async function(tableId) {
  if (!confirm('Are you sure you want to free this table?')) return
  
  loading.style.display = 'flex'
  
  try {
    await updateTableStatus(tableId, 'available', null)
    
    // Add audit log
    await addAuditLog({
      table_id: tableId,
      action_type: 'freed',
      action_by: 'Staff',
      notes: 'Table manually freed',
      previous_status: 'occupied',
      new_status: 'available'
    })
    
    showToast('Table freed successfully', 'success')
    await loadData()
    
  } catch (error) {
    console.error('Free table error:', error)
    showToast('Failed to free table', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

// Handle Walk-in
async function handleWalkin() {
  loading.style.display = 'flex'
  document.getElementById('walkin-modal').style.display = 'none'
  
  try {
    const customerName = document.getElementById('walkin-name').value || 'Walk-in'
    const partySize = document.getElementById('walkin-party').value
    
    await updateTableStatus(selectedTable.id, 'occupied', null)
    
    // Add audit log
    await addAuditLog({
      table_id: selectedTable.id,
      action_type: 'occupied',
      action_by: 'Staff',
      notes: `Walk-in: ${customerName} (${partySize} guests)`,
      previous_status: 'available',
      new_status: 'occupied'
    })
    
    showToast('Table marked as occupied', 'success')
    await loadData()
    
    // Clear form
    document.getElementById('walkin-form').reset()
    
  } catch (error) {
    console.error('Walk-in error:', error)
    showToast('Failed to mark walk-in', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

// Handle Phone Booking
async function handlePhoneBooking() {
  loading.style.display = 'flex'
  document.getElementById('phone-booking-modal').style.display = 'none'
  
  try {
    const customerName = document.getElementById('phone-customer-name').value
    const customerPhone = document.getElementById('phone-customer-phone').value
    const customerEmail = document.getElementById('phone-customer-email').value || `${customerPhone}@phone.booking`
    const bookingTime = document.getElementById('phone-booking-time').value
    const partySize = parseInt(document.getElementById('phone-party-size').value)
    
    const bookingCode = generateBookingCode()
    
    // Create booking
    const booking = await createBooking({
      booking_code: bookingCode,
      table_id: selectedTable.id,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      booking_date: selectedDate,
      booking_time: bookingTime,
      duration_minutes: 120,
      party_size: partySize,
      special_requests: 'Phone booking',
      status: 'confirmed'
    })
    
    // Update table status
    await updateTableStatus(selectedTable.id, 'booked', booking.id)
    
    // Add audit log
    await addAuditLog({
      table_id: selectedTable.id,
      booking_id: booking.id,
      action_type: 'booked',
      action_by: 'Staff',
      notes: `Phone booking: ${customerName} (${bookingCode})`,
      previous_status: 'available',
      new_status: 'booked'
    })
    
    showToast(`Booking created: ${bookingCode}`, 'success')
    await loadData()
    
    // Clear form
    document.getElementById('phone-booking-form').reset()
    
  } catch (error) {
    console.error('Phone booking error:', error)
    showToast('Failed to create booking', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

// Toast Notification
function showToast(message, type = 'success') {
  toast.textContent = message
  toast.className = `toast ${type} show`
  
  setTimeout(() => {
    toast.classList.remove('show')
  }, 3000)
}
