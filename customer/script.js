import {
  supabase,
  generateBookingCode,
  formatDate,
  formatTime,
  getTimeSlots,
  fetchTables,
  fetchBookingsForDate,
  createBooking,
  subscribeToTables
} from '../src/supabase.js'
import { LanguageManager } from '../src/translations.js'

// Initialize Language Manager
const langManager = new LanguageManager()

// State
let currentStep = 1
let selectedFilter = 'all'
let bookingData = {
  date: null,
  time: null,
  partySize: 2,
  tableId: null,
  tableNumber: null,
  tableCapacity: null,
  tableProperties: [],
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  specialRequests: ''
}
let tables = []
let bookings = []

// DOM Elements
const steps = document.querySelectorAll('.step')
const formSteps = document.querySelectorAll('.form-step')
const dateInput = document.getElementById('booking-date')
const partySizeDisplay = document.getElementById('party-size-display')
const partySizeInput = document.getElementById('party-size')
const timeSlotsContainer = document.getElementById('time-slots')
const tablesGrid = document.getElementById('tables-grid')
const loading = document.getElementById('loading')

// Initialize
document.addEventListener('DOMContentLoaded', init)

async function init() {
  // Apply translations
  langManager.applyTranslations()
  
  // Setup language toggle
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === langManager.getCurrentLanguage()) {
      btn.classList.add('active')
    } else {
      btn.classList.remove('active')
    }
    
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang
      langManager.setLanguage(lang)
      
      // Update active state
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      
      // Update copy button text if visible
      const copyBtn = document.getElementById('copy-code')
      if (copyBtn && copyBtn.textContent.includes('✅')) {
        copyBtn.setAttribute('data-i18n', 'customer.copiedCode')
      } else if (copyBtn) {
        copyBtn.setAttribute('data-i18n', 'customer.copyCode')
      }
      langManager.applyTranslations()
    })
  })
  
  setupDatePicker()
  setupPartySizeSelector()
  setupTableFilters()
  setupNavigation()
  setupFormValidation()
  await loadTables()
  setupRealtimeSubscription()
}

// Date Picker Setup
function setupDatePicker() {
  const today = new Date()
  const maxDate = new Date()
  maxDate.setMonth(maxDate.getMonth() + 2) // Allow booking up to 2 months ahead
  
  dateInput.min = today.toISOString().split('T')[0]
  dateInput.max = maxDate.toISOString().split('T')[0]
  dateInput.value = today.toISOString().split('T')[0]
  bookingData.date = dateInput.value
  
  dateInput.addEventListener('change', (e) => {
    bookingData.date = e.target.value
    updateQuickDateButtons()
  })
  
  // Quick date buttons
  const quickDateButtons = document.querySelectorAll('.quick-date-btn')
  quickDateButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const offset = parseInt(btn.dataset.offset)
      const date = new Date()
      date.setDate(date.getDate() + offset)
      const dateString = date.toISOString().split('T')[0]
      dateInput.value = dateString
      bookingData.date = dateString
      updateQuickDateButtons()
    })
  })
  
  updateQuickDateButtons()
}

function updateQuickDateButtons() {
  const quickDateButtons = document.querySelectorAll('.quick-date-btn')
  const selectedDate = dateInput.value
  
  quickDateButtons.forEach(btn => {
    const offset = parseInt(btn.dataset.offset)
    const date = new Date()
    date.setDate(date.getDate() + offset)
    const dateString = date.toISOString().split('T')[0]
    
    if (dateString === selectedDate) {
      btn.classList.add('active')
    } else {
      btn.classList.remove('active')
    }
  })
}

// Table Filters Setup
function setupTableFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn')
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterButtons.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      
      // Update selected filter
      selectedFilter = btn.dataset.filter
      
      // Re-render table grid with filter
      loadTableGrid()
    })
  })
}

// Party Size Selector
function setupPartySizeSelector() {
  const decreaseBtn = document.querySelector('[data-action="decrease"]')
  const increaseBtn = document.querySelector('[data-action="increase"]')
  
  decreaseBtn.addEventListener('click', () => {
    if (bookingData.partySize > 1) {
      bookingData.partySize--
      updatePartySizeDisplay()
    }
  })
  
  increaseBtn.addEventListener('click', () => {
    if (bookingData.partySize < 20) {
      bookingData.partySize++
      updatePartySizeDisplay()
    }
  })
}

function updatePartySizeDisplay() {
  partySizeDisplay.textContent = bookingData.partySize
  partySizeInput.value = bookingData.partySize
}

// Navigation
function setupNavigation() {
  document.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nextStep = parseInt(btn.dataset.next)
      if (await validateStep(currentStep)) {
        goToStep(nextStep)
      }
    })
  })
  
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
      const backStep = parseInt(btn.dataset.back)
      goToStep(backStep)
    })
  })
  
  document.getElementById('confirm-booking').addEventListener('click', confirmBooking)
  document.getElementById('copy-code').addEventListener('click', copyBookingCode)
}

function goToStep(step) {
  // Update step indicators
  steps.forEach(s => {
    const stepNum = parseInt(s.dataset.step)
    s.classList.remove('active', 'completed')
    if (stepNum < step) {
      s.classList.add('completed')
    } else if (stepNum === step) {
      s.classList.add('active')
    }
  })
  
  // Show correct form step
  formSteps.forEach(fs => fs.classList.remove('active'))
  document.getElementById(`step-${step}`).classList.add('active')
  
  currentStep = step
  
  // Load step-specific data
  if (step === 2) {
    loadTimeSlots()
    // Reset table section
    document.getElementById('table-placeholder').style.display = 'flex'
    document.getElementById('table-content').style.display = 'none'
    document.getElementById('selected-table-info').style.display = 'none'
    bookingData.time = null
    bookingData.tableId = null
  } else if (step === 4) {
    loadBookingSummary()
  }
}

async function validateStep(step) {
  switch (step) {
    case 1:
      if (!bookingData.date) {
        alert('Please select a date')
        return false
      }
      return true
    
    case 2:
      if (!bookingData.time) {
        alert('Please select a time slot')
        return false
      }
      if (!bookingData.tableId) {
        alert('Please select a table')
        return false
      }
      return true
    
    case 3:
      const name = document.getElementById('customer-name').value.trim()
      const email = document.getElementById('customer-email').value.trim()
      const phone = document.getElementById('customer-phone').value.trim()
      
      if (!name) {
        alert('Please enter your name')
        return false
      }
      if (!email || !isValidEmail(email)) {
        alert('Please enter a valid email address')
        return false
      }
      if (!phone) {
        alert('Please enter your phone number')
        return false
      }
      
      bookingData.customerName = name
      bookingData.customerEmail = email
      bookingData.customerPhone = phone
      bookingData.specialRequests = document.getElementById('special-requests').value.trim()
      return true
    
    default:
      return true
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Load Tables
async function loadTables() {
  try {
    tables = await fetchTables()
  } catch (error) {
    console.error('Error loading tables:', error)
    alert('Failed to load tables. Please refresh the page.')
  }
}

// Real-time subscription
function setupRealtimeSubscription() {
  subscribeToTables((payload) => {
    console.log('Table update:', payload)
    // Update local tables array
    const index = tables.findIndex(t => t.id === payload.new.id)
    if (index !== -1) {
      tables[index] = payload.new
    }
    // Refresh grid if on step 3
    if (currentStep === 3) {
      loadTableGrid()
    }
  })
}

// Time Slots
async function loadTimeSlots() {
  document.getElementById('selected-date-display').textContent = formatDate(bookingData.date)
  
  // Load bookings for selected date
  try {
    bookings = await fetchBookingsForDate(bookingData.date)
  } catch (error) {
    console.error('Error loading bookings:', error)
  }
  
  const slots = getTimeSlots()
  const now = new Date()
  const selectedDate = new Date(bookingData.date)
  const isToday = selectedDate.toDateString() === now.toDateString()
  
  timeSlotsContainer.innerHTML = slots.map(slot => {
    const [hours, minutes] = slot.split(':').map(Number)
    const slotTime = new Date(selectedDate)
    slotTime.setHours(hours, minutes, 0, 0)
    
    const isPast = isToday && slotTime <= now
    const disabled = isPast ? 'disabled' : ''
    const selected = bookingData.time === slot ? 'selected' : ''
    
    return `
      <div class="time-slot ${disabled} ${selected}" data-time="${slot}">
        ${formatTime(slot)}
      </div>
    `
  }).join('')
  
  // Add click handlers
  timeSlotsContainer.querySelectorAll('.time-slot:not(.disabled)').forEach(slot => {
    slot.addEventListener('click', () => {
      timeSlotsContainer.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'))
      slot.classList.add('selected')
      bookingData.time = slot.dataset.time
      
      // Show tables section and load tables
      document.getElementById('table-placeholder').style.display = 'none'
      document.getElementById('table-content').style.display = 'block'
      loadTableGrid()
    })
  })
  
  // Disable continue button until both time and table are selected
  document.querySelector('#step-2 .btn-next').disabled = true
}

// Table Grid
async function loadTableGrid() {
  // Reload bookings for the selected date and time
  try {
    bookings = await fetchBookingsForDate(bookingData.date)
  } catch (error) {
    console.error('Error loading bookings:', error)
  }
  
  // Filter tables based on selected filter
  let filteredTables = tables
  if (selectedFilter !== 'all') {
    filteredTables = tables.filter(table => {
      const properties = table.properties || []
      return properties.some(prop => prop.includes(selectedFilter))
    })
  }
  
  tablesGrid.innerHTML = filteredTables.map(table => {
    // Check if table is available for this date/time
    const isBooked = isTableBooked(table.id, bookingData.date, bookingData.time)
    const isTooSmall = table.capacity < bookingData.partySize
    
    let statusClass = 'available'
    let clickable = true
    
    if (table.status === 'occupied') {
      statusClass = 'occupied'
      clickable = false
    } else if (isBooked) {
      statusClass = 'booked'
      clickable = false
    } else if (isTooSmall) {
      statusClass = 'available unavailable'
      clickable = false
    }
    
    const selected = bookingData.tableId === table.id ? 'selected' : ''
    
    return `
      <div class="table-item ${statusClass} ${selected}" 
           data-id="${table.id}" 
           data-number="${table.table_number}"
           data-capacity="${table.capacity}"
           data-properties='${JSON.stringify(table.properties || [])}'
           ${!clickable ? 'data-disabled="true"' : ''}>
        <div class="table-icon">
          <span class="table-number">${table.table_number}</span>
          <span class="table-capacity">${table.capacity}p</span>
        </div>
      </div>
    `
  }).join('')
  
  // Add click handlers
  tablesGrid.querySelectorAll('.table-item:not([data-disabled])').forEach(item => {
    item.addEventListener('click', () => {
      tablesGrid.querySelectorAll('.table-item').forEach(t => t.classList.remove('selected'))
      item.classList.add('selected')
      
      bookingData.tableId = parseInt(item.dataset.id)
      bookingData.tableNumber = item.dataset.number
      bookingData.tableCapacity = parseInt(item.dataset.capacity)
      bookingData.tableProperties = JSON.parse(item.dataset.properties)
      
      // Show selected table info
      const infoBox = document.getElementById('selected-table-info')
      infoBox.style.display = 'flex'
      document.getElementById('selected-table-number').textContent = bookingData.tableNumber
      document.getElementById('selected-table-capacity').textContent = bookingData.tableCapacity
      document.getElementById('selected-table-properties').textContent = 
        bookingData.tableProperties.length > 0 ? bookingData.tableProperties.join(', ') : 'Standard'
      
      // Enable continue button
      document.querySelector('#step-2 .btn-next').disabled = false
    })
  })
  
  // Reset table selection when time changes
  bookingData.tableId = null
  document.getElementById('selected-table-info').style.display = 'none'
  document.querySelector('#step-2 .btn-next').disabled = true
}

function isTableBooked(tableId, date, time) {
  const requestedMinutes = timeToMinutes(time)
  const duration = 120 // 2 hours
  
  return bookings.some(booking => {
    if (booking.table_id !== tableId) return false
    if (booking.status === 'cancelled') return false
    
    const bookingMinutes = timeToMinutes(booking.booking_time)
    const bookingEnd = bookingMinutes + (booking.duration_minutes || 120)
    const requestedEnd = requestedMinutes + duration
    
    // Check for overlap
    return requestedMinutes < bookingEnd && requestedEnd > bookingMinutes
  })
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Form Validation
function setupFormValidation() {
  const form = document.getElementById('customer-form')
  const inputs = form.querySelectorAll('input[required]')
  
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      input.style.borderColor = input.value.trim() ? '#e0e0e0' : '#ef4444'
    })
  })
}

// Booking Summary
function loadBookingSummary() {
  document.getElementById('summary-date').textContent = formatDate(bookingData.date)
  document.getElementById('summary-time').textContent = formatTime(bookingData.time)
  document.getElementById('summary-party').textContent = `${bookingData.partySize} guests`
  document.getElementById('summary-table').textContent = `Table ${bookingData.tableNumber} (${bookingData.tableCapacity} seats)`
  document.getElementById('summary-name').textContent = bookingData.customerName
  document.getElementById('summary-email').textContent = bookingData.customerEmail
  document.getElementById('summary-phone').textContent = bookingData.customerPhone
  
  if (bookingData.specialRequests) {
    document.getElementById('summary-requests-container').style.display = 'flex'
    document.getElementById('summary-requests').textContent = bookingData.specialRequests
  } else {
    document.getElementById('summary-requests-container').style.display = 'none'
  }
}

// Confirm Booking
async function confirmBooking() {
  loading.style.display = 'flex'
  
  try {
    const bookingCode = generateBookingCode()
    
    // Create booking in database
    const booking = await createBooking({
      booking_code: bookingCode,
      table_id: bookingData.tableId,
      customer_name: bookingData.customerName,
      customer_email: bookingData.customerEmail,
      customer_phone: bookingData.customerPhone,
      booking_date: bookingData.date,
      booking_time: bookingData.time,
      duration_minutes: 120,
      party_size: bookingData.partySize,
      special_requests: bookingData.specialRequests || null,
      status: 'confirmed'
    })
    
    // Table status is computed dynamically from bookings - no need to update
    
    // Show success
    showBookingSuccess(bookingCode)
    
  } catch (error) {
    console.error('Booking error:', error)
    alert('Failed to create booking. Please try again.')
  } finally {
    loading.style.display = 'none'
  }
}

function showBookingSuccess(code) {
  document.getElementById('booking-review').style.display = 'none'
  document.getElementById('booking-success').style.display = 'block'
  document.getElementById('booking-code').textContent = code
  
  // Update final summary
  const finalSummary = document.getElementById('final-summary')
  finalSummary.innerHTML = `
    <divsetAttribute('data-i18n', 'customer.copiedCode')
    langManager.applyTranslations()
    setTimeout(() => {
      btn.setAttribute('data-i18n', 'customer.copyCode')
      langManager.applyTranslations()rmatDate(bookingData.date)}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">🕐 Time</span>
      <span class="summary-value">${formatTime(bookingData.time)}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">👥 Guests</span>
      <span class="summary-value">${bookingData.partySize} people</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">🪑 Table</span>
      <span class="summary-value">Table ${bookingData.tableNumber}</span>
    </div>
  `
  
  // Mark step 4 as completed
  steps.forEach(s => {
    if (parseInt(s.dataset.step) === 4) {
      s.classList.add('completed')
    }
  })
}

function copyBookingCode() {
  const code = document.getElementById('booking-code').textContent
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-code')
    btn.textContent = '✅ Copied!'
    setTimeout(() => {
      btn.textContent = '📋 Copy Code'
    }, 2000)
  })
}
