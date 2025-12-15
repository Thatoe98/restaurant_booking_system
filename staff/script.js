import {
  supabase,
  generateBookingCode,
  formatDate,
  formatTime,
  getTimeSlots,
  fetchTables,
  fetchBookingsForDate,
  createBooking,
  updateBookingStatus,
  addAuditLog,
  subscribeToTables,
  subscribeToBookings
} from '../src/supabase.js'

// State
let currentView = 'menu' // menu, tables, bookings, checkin
let tables = []
let bookings = []
let selectedDate = new Date().toISOString().split('T')[0]
let selectedTableFilter = 'all'
let selectedTableId = null

// DOM Elements
const actionMenu = document.getElementById('action-menu')
const tablesView = document.getElementById('tables-view')
const bookingsView = document.getElementById('bookings-view')
const checkinView = document.getElementById('checkin-view')
const backBtn = document.getElementById('back-btn')
const loading = document.getElementById('loading')
const toast = document.getElementById('toast')

// Initialize
document.addEventListener('DOMContentLoaded', init)

async function init() {
  await loadTables()
  setupActionCards()
  setupBackButton()
  setupTablesView()
  setupBookingsView()
  setupCheckinView()
  setupModals()
  setupRealtimeSubscription()
  
  // Start clock after everything is set up
  setTimeout(() => {
    startClock()
  }, 100)
}

// Clock
function startClock() {
  console.log('Clock started')
  updateClock()
  setInterval(updateClock, 1000)
}

function updateClock() {
  const now = new Date()
  
  // Simple time formatting
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const timeStr = `${hours}:${minutes}:${seconds}`
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`
  
  const timeElement = document.getElementById('current-time')
  const dateElement = document.getElementById('current-date')
  
  console.log('Updating clock:', timeStr, '| Elements found:', !!timeElement, !!dateElement)
  
  if (timeElement) {
    timeElement.textContent = timeStr
    console.log('Time element updated to:', timeElement.textContent)
  } else {
    console.error('Time element not found!')
  }
  if (dateElement) {
    dateElement.textContent = dateStr
  } else {
    console.error('Date element not found!')
  }
}

// Navigation
function setupActionCards() {
  const cards = document.querySelectorAll('.action-card')
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action
      navigateTo(action)
    })
  })
}

function setupBackButton() {
  backBtn.addEventListener('click', () => {
    navigateTo('menu')
  })
}

function navigateTo(view) {
  // Hide all views
  actionMenu.style.display = 'none'
  tablesView.style.display = 'none'
  bookingsView.style.display = 'none'
  checkinView.style.display = 'none'
  
  // Show selected view
  if (view === 'menu') {
    actionMenu.style.display = 'flex'
    backBtn.style.display = 'none'
    currentView = 'menu'
  } else if (view === 'tables') {
    tablesView.style.display = 'block'
    backBtn.style.display = 'block'
    currentView = 'tables'
    loadTablesData()
  } else if (view === 'bookings') {
    bookingsView.style.display = 'block'
    backBtn.style.display = 'block'
    currentView = 'bookings'
    loadBookingsData()
  } else if (view === 'checkin') {
    checkinView.style.display = 'block'
    backBtn.style.display = 'block'
    currentView = 'checkin'
    document.getElementById('checkin-code').value = ''
    document.getElementById('booking-details-card').style.display = 'none'
  }
}

// Tables View
function setupTablesView() {
  const dateInput = document.getElementById('tables-date-input')
  dateInput.value = selectedDate
  updateTablesDateDisplay()
  
  dateInput.addEventListener('change', (e) => {
    selectedDate = e.target.value
    updateTablesDateDisplay()
    loadTablesData()
  })
  
  document.getElementById('tables-prev-day').addEventListener('click', () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() - 1)
    selectedDate = date.toISOString().split('T')[0]
    dateInput.value = selectedDate
    updateTablesDateDisplay()
    loadTablesData()
  })
  
  document.getElementById('tables-next-day').addEventListener('click', () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + 1)
    selectedDate = date.toISOString().split('T')[0]
    dateInput.value = selectedDate
    updateTablesDateDisplay()
    loadTablesData()
  })
}

function updateTablesDateDisplay() {
  document.getElementById('tables-date').textContent = formatDate(selectedDate)
}

async function loadTablesData() {
  loading.style.display = 'flex'
  try {
    bookings = await fetchBookingsForDate(selectedDate)
    renderTablesGrid()
    updateStats()
  } catch (error) {
    console.error('Error loading tables data:', error)
    showToast('Failed to load data', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

function renderTablesGrid() {
  const grid = document.getElementById('tables-grid')
  const today = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === today
  const now = new Date()
  
  grid.innerHTML = tables.map(table => {
    // Find active booking for this table
    const tableBooking = bookings.find(b => 
      b.table_id === table.id && 
      b.status !== 'cancelled' && 
      b.status !== 'completed'
    )
    
    // Compute status
    let computedStatus = 'available'
    let timeDisplay = ''
    let isOverdue = false
    let minutesLateText = ''
    
    if (tableBooking) {
      if (tableBooking.status === 'checked_in') {
        computedStatus = 'checked-in'
        timeDisplay = 'Checked In'
      } else if (tableBooking.status === 'confirmed') {
        computedStatus = 'booked'
        timeDisplay = formatTime(tableBooking.booking_time)
        
        // Check if overdue (15+ minutes late)
        if (isToday) {
          const bookingDateTime = new Date(`${tableBooking.booking_date}T${tableBooking.booking_time}`)
          const minutesLate = Math.floor((now - bookingDateTime) / (1000 * 60))
          if (minutesLate >= 15) {
            isOverdue = true
            computedStatus = 'overdue'
            timeDisplay = formatTime(tableBooking.booking_time)
            minutesLateText = `${minutesLate} min late`
          }
        }
      }
    }
    
    return `
      <div class="table-item ${computedStatus}" 
           data-id="${table.id}"
           data-number="${table.table_number}"
           data-booking="${tableBooking ? tableBooking.id : ''}">
        <span class="table-number">${table.table_number}</span>
        <span class="table-capacity">${table.capacity} guests</span>
        ${timeDisplay ? `<span class="table-time">${timeDisplay}</span>` : ''}
        ${minutesLateText ? `<span class="table-late">⚠️ ${minutesLateText}</span>` : ''}
      </div>
    `
  }).join('')
  
  // Add click handlers
  grid.querySelectorAll('.table-item').forEach(item => {
    item.addEventListener('click', () => {
      showTableActions(item)
    })
  })
}

function showTableActions(tableElement) {
  const tableId = parseInt(tableElement.dataset.id)
  const tableNumber = tableElement.dataset.number
  const bookingId = tableElement.dataset.booking
  const status = tableElement.classList.contains('checked-in') ? 'checked-in' : 
                 tableElement.classList.contains('overdue') ? 'overdue' :
                 tableElement.classList.contains('booked') ? 'booked' : 'available'
  
  if (status === 'available') {
    // Show walk-in modal
    document.getElementById('walkin-table-number').textContent = tableNumber
    selectedTableId = tableId
    document.getElementById('walkin-modal').style.display = 'flex'
  } else if (status === 'checked-in') {
    // Show free table modal
    const booking = bookings.find(b => b.id === bookingId)
    if (booking) {
      const table = tables.find(t => t.id === tableId)
      document.getElementById('free-table-details').innerHTML = `
        <p><strong>Table:</strong> ${tableNumber}</p>
        <p><strong>Customer:</strong> ${booking.customer_name}</p>
        <p><strong>Party Size:</strong> ${booking.party_size} guests</p>
        <p><strong>Time:</strong> ${formatTime(booking.booking_time)}</p>
        <p style="margin-top: 16px; color: var(--text-muted);">This will mark the booking as completed and free up the table.</p>
      `
      selectedTableId = tableId
      const confirmBtn = document.getElementById('free-table-confirm')
      confirmBtn.onclick = () => freeTable(bookingId, tableId)
      document.getElementById('free-table-modal').style.display = 'flex'
    }
  } else if (status === 'overdue') {
    // Show overdue booking details with cancel option
    const booking = bookings.find(b => b.id === bookingId)
    if (booking) {
      showOverdueBookingModal(booking, tableNumber)
    }
  } else if (status === 'booked') {
    // Show quick check-in modal
    const booking = bookings.find(b => b.id === bookingId)
    if (booking) {
      const table = tables.find(t => t.id === tableId)
      document.getElementById('quick-checkin-details').innerHTML = `
        <p><strong>Table:</strong> ${tableNumber}</p>
        <p><strong>Customer:</strong> ${booking.customer_name}</p>
        <p><strong>Phone:</strong> ${booking.customer_phone}</p>
        <p><strong>Time:</strong> ${formatTime(booking.booking_time)}</p>
        <p><strong>Party Size:</strong> ${booking.party_size} guests</p>
        <p><strong>Booking Code:</strong> <span style="font-family: monospace; color: var(--primary);">${booking.booking_code}</span></p>
      `
      const confirmBtn = document.getElementById('quick-checkin-confirm')
      confirmBtn.onclick = () => checkInBooking(bookingId)
      document.getElementById('quick-checkin-modal').style.display = 'flex'
    }
  }
}

async function freeTable(bookingId, tableId) {
  document.getElementById('free-table-modal').style.display = 'none'
  loading.style.display = 'flex'
  try {
    await updateBookingStatus(bookingId, 'completed')
    await addAuditLog({
      table_id: tableId,
      booking_id: bookingId,
      action_type: 'completed',
      action_by: 'Staff',
      notes: 'Table freed - customer finished'
    })
    showToast('Table freed successfully', 'success')
    loadTablesData()
  } catch (error) {
    console.error('Error freeing table:', error)
    showToast('Failed to free table', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

async function checkInBooking(bookingId) {
  document.getElementById('quick-checkin-modal').style.display = 'none'
  loading.style.display = 'flex'
  try {
    await updateBookingStatus(bookingId, 'checked_in')
    showToast('Customer checked in', 'success')
    loadTablesData()
  } catch (error) {
    console.error('Error checking in:', error)
    showToast('Failed to check in', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

function showOverdueBookingModal(booking, tableNumber) {
  const now = new Date()
  const bookingTime = new Date(`${booking.booking_date}T${booking.booking_time}`)
  const minutesLate = Math.floor((now - bookingTime) / (1000 * 60))
  
  document.getElementById('overdue-booking-details').innerHTML = `
    <div style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
      <p style="color: var(--occupied); font-weight: 600;">⚠️ ${minutesLate} minutes late</p>
    </div>
    <p><strong>Table:</strong> ${tableNumber}</p>
    <p><strong>Booking Code:</strong> <span style="font-family: monospace; color: var(--primary);">${booking.booking_code}</span></p>
    <p><strong>Customer Name:</strong> ${booking.customer_name}</p>
    <p><strong>Phone:</strong> <a href="tel:${booking.customer_phone}" style="color: var(--primary);">${booking.customer_phone}</a></p>
    <p><strong>Email:</strong> <a href="mailto:${booking.customer_email}" style="color: var(--primary);">${booking.customer_email || 'N/A'}</a></p>
    <p><strong>Scheduled Time:</strong> ${formatTime(booking.booking_time)}</p>
    <p><strong>Party Size:</strong> ${booking.party_size} guests</p>
    ${booking.special_requests ? `<p><strong>Special Requests:</strong> ${booking.special_requests}</p>` : ''}
    <p style="margin-top: 16px; color: var(--text-muted); font-size: 0.9rem;">
      💡 Contact the customer to confirm if they're still coming, or cancel the booking to free up the table.
    </p>
  `
  
  const cancelBtn = document.getElementById('overdue-cancel-booking')
  cancelBtn.onclick = () => cancelOverdueBooking(booking.id)
  
  document.getElementById('overdue-booking-modal').style.display = 'flex'
}

async function cancelOverdueBooking(bookingId) {
  document.getElementById('overdue-booking-modal').style.display = 'none'
  loading.style.display = 'flex'
  
  try {
    await updateBookingStatus(bookingId, 'cancelled')
    await addAuditLog({
      booking_id: bookingId,
      action_type: 'cancelled',
      action_by: 'Staff',
      notes: 'Booking cancelled - customer overdue/no-show'
    })
    showToast('Booking cancelled successfully', 'success')
    loadTablesData()
  } catch (error) {
    console.error('Error cancelling booking:', error)
    showToast('Failed to cancel booking', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

function updateStats() {
  const today = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === today
  const now = new Date()
  
  let available = 0
  let booked = 0
  let occupied = 0
  
  tables.forEach(table => {
    const tableBooking = bookings.find(b => 
      b.table_id === table.id && 
      b.status !== 'cancelled' && 
      b.status !== 'completed'
    )
    
    if (!tableBooking) {
      available++
    } else if (tableBooking.status === 'checked_in') {
      occupied++
    } else if (tableBooking.status === 'confirmed') {
      booked++
    }
  })
  
  const total = tables.length
  const occupancy = total > 0 ? Math.round(((occupied + booked) / total) * 100) : 0
  
  document.getElementById('stat-available').textContent = available
  document.getElementById('stat-booked').textContent = booked
  document.getElementById('stat-occupied').textContent = occupied
  document.getElementById('stat-occupancy').textContent = `${occupancy}%`
}

// Bookings View
function setupBookingsView() {
  document.getElementById('add-booking-btn').addEventListener('click', () => {
    openPhoneBookingModal()
  })
  
  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    document.getElementById('booking-filter-date').value = ''
    document.getElementById('booking-filter-name').value = ''
    document.getElementById('booking-filter-code').value = ''
    loadBookingsData()
  })
  
  // Filter on input
  document.getElementById('booking-filter-date').addEventListener('change', loadBookingsData)
  document.getElementById('booking-filter-name').addEventListener('input', loadBookingsData)
  document.getElementById('booking-filter-code').addEventListener('input', loadBookingsData)
}

async function loadBookingsData() {
  loading.style.display = 'flex'
  try {
    // Get filters
    const filterDate = document.getElementById('booking-filter-date').value
    const filterName = document.getElementById('booking-filter-name').value.toLowerCase()
    const filterCode = document.getElementById('booking-filter-code').value.toUpperCase()
    
    // Load bookings (if date filter, use it, otherwise load today's)
    const dateToLoad = filterDate || selectedDate
    let allBookings = await fetchBookingsForDate(dateToLoad)
    
    // Apply filters
    let filtered = allBookings.filter(b => b.status !== 'completed')
    
    if (filterName) {
      filtered = filtered.filter(b => b.customer_name.toLowerCase().includes(filterName))
    }
    
    if (filterCode) {
      filtered = filtered.filter(b => b.booking_code.includes(filterCode))
    }
    
    renderBookingsList(filtered)
  } catch (error) {
    console.error('Error loading bookings:', error)
    showToast('Failed to load bookings', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

function renderBookingsList(bookingsList) {
  const container = document.getElementById('bookings-list')
  
  if (bookingsList.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">No bookings found</p>'
    return
  }
  
  container.innerHTML = bookingsList.map(booking => {
    const table = tables.find(t => t.id === booking.table_id)
    const statusBadge = `<span class="status-badge ${booking.status}">${booking.status}</span>`
    
    return `
      <div class="booking-item">
        <div class="booking-item-info">
          <h4>${booking.customer_name} - ${booking.booking_code}</h4>
          <p>📅 ${formatDate(booking.booking_date)} at ${formatTime(booking.booking_time)}</p>
          <p>🪑 Table ${table ? table.table_number : 'N/A'} • 👥 ${booking.party_size} guests</p>
          <p>📞 ${booking.customer_phone}</p>
          ${statusBadge}
        </div>
        <div class="booking-item-actions">
          ${booking.status === 'confirmed' ? `<button class="btn btn-success btn-sm" onclick="checkInBookingById('${booking.id}')">Check In</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="cancelBookingById('${booking.id}')">Cancel</button>
        </div>
      </div>
    `
  }).join('')
}

window.checkInBookingById = async function(bookingId) {
  loading.style.display = 'flex'
  try {
    await updateBookingStatus(bookingId, 'checked_in')
    showToast('Checked in successfully', 'success')
    loadBookingsData()
  } catch (error) {
    console.error('Error:', error)
    showToast('Failed to check in', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

window.cancelBookingById = async function(bookingId) {
  if (!confirm('Cancel this booking?')) return
  
  loading.style.display = 'flex'
  try {
    await updateBookingStatus(bookingId, 'cancelled')
    showToast('Booking cancelled', 'success')
    loadBookingsData()
  } catch (error) {
    console.error('Error:', error)
    showToast('Failed to cancel booking', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

// Check-in View
function setupCheckinView() {
  document.getElementById('verify-code-btn').addEventListener('click', verifyBookingCode)
  document.getElementById('checkin-code').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyBookingCode()
  })
}

async function verifyBookingCode() {
  const code = document.getElementById('checkin-code').value.trim().toUpperCase()
  if (!code) return
  
  loading.style.display = 'flex'
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_code', code)
      .single()
    
    if (error || !data) {
      showToast('Booking not found', 'error')
      return
    }
    
    const table = tables.find(t => t.id === data.table_id)
    const card = document.getElementById('booking-details-card')
    
    card.innerHTML = `
      <h3>✅ Booking Found</h3>
      <p><strong>Name:</strong> <span>${data.customer_name}</span></p>
      <p><strong>Phone:</strong> <span>${data.customer_phone}</span></p>
      <p><strong>Date:</strong> <span>${formatDate(data.booking_date)}</span></p>
      <p><strong>Time:</strong> <span>${formatTime(data.booking_time)}</span></p>
      <p><strong>Table:</strong> <span>${table ? table.table_number : 'N/A'}</span></p>
      <p><strong>Guests:</strong> <span>${data.party_size}</span></p>
      <p><strong>Status:</strong> <span class="status-badge ${data.status}">${data.status}</span></p>
      ${data.status === 'confirmed' ? `
        <button class="btn btn-primary btn-lg" onclick="confirmCheckin('${data.id}')">
          ✅ Confirm Check-in
        </button>
      ` : data.status === 'checked_in' ? `
        <p style="color: var(--available); text-align: center; margin-top: 20px;">Already checked in!</p>
      ` : `
        <p style="color: var(--text-muted); text-align: center; margin-top: 20px;">Booking is ${data.status}</p>
      `}
    `
    
    card.style.display = 'block'
  } catch (error) {
    console.error('Error:', error)
    showToast('Error verifying code', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

window.confirmCheckin = async function(bookingId) {
  loading.style.display = 'flex'
  try {
    await updateBookingStatus(bookingId, 'checked_in')
    showToast('Customer checked in successfully!', 'success')
    document.getElementById('checkin-code').value = ''
    document.getElementById('booking-details-card').style.display = 'none'
  } catch (error) {
    console.error('Error:', error)
    showToast('Failed to check in', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

// Modals
function setupModals() {
  // Walk-in modal
  document.getElementById('walkin-cancel').addEventListener('click', () => {
    document.getElementById('walkin-modal').style.display = 'none'
  })
  
  document.getElementById('walkin-form').addEventListener('submit', handleWalkin)
  
  // Quick check-in modal
  document.getElementById('quick-checkin-cancel').addEventListener('click', () => {
    document.getElementById('quick-checkin-modal').style.display = 'none'
  })
  
  // Free table modal
  document.getElementById('free-table-cancel').addEventListener('click', () => {
    document.getElementById('free-table-modal').style.display = 'none'
  })
  
  // Overdue booking modal
  document.getElementById('overdue-cancel').addEventListener('click', () => {
    document.getElementById('overdue-booking-modal').style.display = 'none'
  })
  
  // Phone booking modal
  document.getElementById('phone-booking-cancel').addEventListener('click', () => {
    document.getElementById('phone-booking-modal').style.display = 'none'
  })
  
  document.getElementById('phone-booking-form').addEventListener('submit', handlePhoneBooking)
  
  // Setup phone booking date/time watchers
  document.getElementById('phone-booking-date').addEventListener('change', loadPhoneTables)
  document.getElementById('phone-booking-time').addEventListener('change', loadPhoneTables)
  document.getElementById('phone-party-size').addEventListener('change', loadPhoneTables)
  
  // Setup filter buttons
  document.querySelectorAll('.preference-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preference-filters .filter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      selectedTableFilter = btn.dataset.filter
      loadPhoneTables()
    })
  })
}

async function handleWalkin(e) {
  e.preventDefault()
  
  const walkinModal = document.getElementById('walkin-modal')
  walkinModal.style.display = 'none'
  loading.style.display = 'flex'
  
  try {
    const customerName = document.getElementById('walkin-name').value || 'Walk-in'
    const partySize = parseInt(document.getElementById('walkin-party').value) || 2
    const now = new Date()
    const bookingTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    
    const booking = await createBooking({
      booking_code: generateBookingCode(),
      table_id: selectedTableId,
      customer_name: customerName,
      customer_email: 'walkin@restaurant.local',
      customer_phone: 'Walk-in',
      booking_date: selectedDate,
      booking_time: bookingTime,
      duration_minutes: 120,
      party_size: partySize,
      special_requests: 'Walk-in customer',
      status: 'confirmed'
    })
    
    // Check in immediately
    if (booking && booking.id) {
      await updateBookingStatus(booking.id, 'checked_in')
    }
    
    showToast('Walk-in checked in successfully', 'success')
    document.getElementById('walkin-form').reset()
    await loadTablesData()
  } catch (error) {
    console.error('Error adding walk-in:', error)
    showToast('Failed to add walk-in', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

function openPhoneBookingModal() {
  const modal = document.getElementById('phone-booking-modal')
  const dateInput = document.getElementById('phone-booking-date')
  const timeSelect = document.getElementById('phone-booking-time')
  
  // Set default date to today
  dateInput.value = new Date().toISOString().split('T')[0]
  dateInput.min = new Date().toISOString().split('T')[0]
  
  // Populate time slots
  const slots = getTimeSlots()
  timeSelect.innerHTML = slots.map(slot => `<option value="${slot}">${formatTime(slot)}</option>`).join('')
  
  selectedTableFilter = 'all'
  document.querySelectorAll('.preference-filters .filter-btn').forEach(b => b.classList.remove('active'))
  document.querySelector('.preference-filters .filter-btn[data-filter="all"]').classList.add('active')
  
  modal.style.display = 'flex'
  loadPhoneTables()
}

async function loadPhoneTables() {
  const date = document.getElementById('phone-booking-date').value
  const time = document.getElementById('phone-booking-time').value
  const partySize = parseInt(document.getElementById('phone-party-size').value) || 2
  
  if (!date || !time) return
  
  try {
    const dayBookings = await fetchBookingsForDate(date)
    const grid = document.getElementById('phone-tables-grid')
    
    // Filter tables
    let filteredTables = tables
    if (selectedTableFilter !== 'all') {
      filteredTables = tables.filter(table => {
        const properties = table.properties || []
        return properties.some(prop => prop.includes(selectedTableFilter))
      })
    }
    
    grid.innerHTML = filteredTables.map(table => {
      const isBooked = dayBookings.some(b => 
        b.table_id === table.id && 
        b.status !== 'cancelled' && 
        b.status !== 'completed' &&
        b.booking_time === time
      )
      
      const isTooSmall = table.capacity < partySize
      const available = !isBooked && !isTooSmall
      
      return `
        <div class="phone-table-item ${available ? 'available' : 'booked'}" 
             data-id="${table.id}"
             ${available ? '' : 'disabled'}>
          <div>${table.table_number}</div>
          <div style="font-size: 0.8rem;">${table.capacity}p</div>
        </div>
      `
    }).join('')
    
    // Add click handlers
    grid.querySelectorAll('.phone-table-item.available').forEach(item => {
      item.addEventListener('click', () => {
        grid.querySelectorAll('.phone-table-item').forEach(t => t.classList.remove('selected'))
        item.classList.add('selected')
        selectedTableId = parseInt(item.dataset.id)
      })
    })
  } catch (error) {
    console.error('Error loading tables:', error)
  }
}

async function handlePhoneBooking(e) {
  e.preventDefault()
  
  if (!selectedTableId) {
    showToast('Please select a table', 'error')
    return
  }
  
  loading.style.display = 'flex'
  document.getElementById('phone-booking-modal').style.display = 'none'
  
  try {
    const bookingCode = generateBookingCode()
    const date = document.getElementById('phone-booking-date').value
    const time = document.getElementById('phone-booking-time').value
    const partySize = parseInt(document.getElementById('phone-party-size').value)
    const name = document.getElementById('phone-booking-name').value
    const phone = document.getElementById('phone-booking-phone').value
    const requests = document.getElementById('phone-booking-requests').value
    
    await createBooking({
      booking_code: bookingCode,
      table_id: selectedTableId,
      customer_name: name,
      customer_email: 'phone@restaurant.local',
      customer_phone: phone,
      booking_date: date,
      booking_time: time,
      duration_minutes: 120,
      party_size: partySize,
      special_requests: requests || 'Phone booking',
      status: 'confirmed'
    })
    
    showToast(`Booking created! Code: ${bookingCode}`, 'success')
    document.getElementById('phone-booking-form').reset()
    selectedTableId = null
    
    if (currentView === 'bookings') {
      loadBookingsData()
    }
  } catch (error) {
    console.error('Error:', error)
    showToast('Failed to create booking', 'error')
  } finally {
    loading.style.display = 'none'
  }
}

// Utilities
async function loadTables() {
  try {
    tables = await fetchTables()
  } catch (error) {
    console.error('Error loading tables:', error)
  }
}

function setupRealtimeSubscription() {
  subscribeToTables((payload) => {
    const index = tables.findIndex(t => t.id === payload.new.id)
    if (index !== -1) {
      tables[index] = payload.new
    }
    if (currentView === 'tables') {
      renderTablesGrid()
      updateStats()
    }
  })
  
  subscribeToBookings(async (payload) => {
    if (currentView === 'tables') {
      await loadTablesData()
    } else if (currentView === 'bookings') {
      await loadBookingsData()
    }
  })
}

function showToast(message, type = 'info') {
  toast.textContent = message
  toast.className = `toast ${type}`
  toast.style.display = 'block'
  
  setTimeout(() => {
    toast.style.display = 'none'
  }, 3000)
}
