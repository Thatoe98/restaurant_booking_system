# Creator Restaurant Booking System - Build Instructions
## For GitHub Copilot Agent (Claude 4.5 Sonnet)

---

## PROJECT OVERVIEW

**Project Name:** Creator Restaurant Booking System
**Demo Restaurant:** Creator Restaurant
**Total Tables:** 20 tables with different properties
**Target Market:** Myanmar mid-to-high-end restaurants

**Architecture:**
- Frontend: HTML/CSS/JavaScript (2 separate UIs: Customer & Staff)
- Backend Database: Supabase (PostgreSQL)
- Automation: n8n (Email confirmations, Telegram notifications)
- Responsive Design: Mobile/Tablet/iPad friendly

---

## PHASE 1: SUPABASE DATABASE SETUP

### 1.1 Create Supabase Project
- Create a new Supabase project named "creator-restaurant"
- Region: Southeast Asia (closest to Thailand)
- Enable Postgres
- Store the anon key and project URL (needed for frontend)

### 1.2 Database Tables

**Table 1: `tables` (Restaurant tables)**
```
Columns:
- id: bigint (primary key, auto-increment)
- table_number: varchar (e.g., "1", "A1", "Garden-1")
- capacity: integer (2-8 for different party sizes)
- properties: text array (e.g., ["Garden View", "Smoking Area", "Near Music", "Window Seat"])
- status: enum ('available', 'occupied', 'booked') - default: 'available'
- current_booking_id: uuid (foreign key to bookings table, nullable)
- created_at: timestamp (auto)
- updated_at: timestamp (auto)

Indexes:
- status (for fast filtering)
- capacity (for availability queries)
```

**Table 2: `bookings` (Customer bookings)**
```
Columns:
- id: uuid (primary key, default: uuid())
- booking_code: varchar (unique, format: BKD + 4 random chars, e.g., BKD1234)
- table_id: bigint (foreign key to tables.id)
- customer_name: varchar
- customer_email: varchar
- customer_phone: varchar
- booking_date: date
- booking_time: time
- duration_minutes: integer (default: 120)
- party_size: integer
- special_requests: text (nullable)
- status: enum ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled') - default: 'pending'
- created_at: timestamp (auto)
- checked_in_at: timestamp (nullable)
- completed_at: timestamp (nullable)
- cancelled_at: timestamp (nullable)

Indexes:
- booking_code (unique, for code lookup)
- customer_email (for email queries)
- booking_date, booking_time (for staff dashboard)
- status (for filtering)
```

**Table 3: `audit_log` (Staff actions)**
```
Columns:
- id: bigint (primary key, auto-increment)
- table_id: bigint (foreign key to tables.id)
- booking_id: uuid (foreign key to bookings.id, nullable)
- action_type: varchar (e.g., 'occupied', 'booked', 'freed', 'checked_in', 'cancelled')
- action_by: varchar (staff name)
- notes: text (nullable, for additional info like customer name for phone bookings)
- previous_status: varchar
- new_status: varchar
- created_at: timestamp (auto)
```

### 1.3 Enable Real-Time for Tables
In Supabase Dashboard > Database > Replication:
- Enable Postgres Changes publication for `tables` table (for live availability updates)
- Enable Postgres Changes publication for `bookings` table (for staff dashboard updates)

### 1.4 Set Up Webhooks for n8n Integration
In Supabase Dashboard > Database > Webhooks:
- Create webhook trigger on `bookings` INSERT event
- Send POST request to n8n webhook URL (will create this in Phase 3)
- Include all event data in payload

---

## PHASE 2: FRONTEND APPLICATION

### 2.1 Project Structure
```
creator-restaurant/
├── customer/
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── staff/
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── .env.local (store Supabase keys)
└── README.md
```

### 2.2 CUSTOMER UI (`customer/index.html`)

**Flow:**
1. Initial view: Date picker (calendar)
2. Time picker (with availability indicator)
3. Table selection (grid/cinema-style visualization)
4. Customer details form (name, phone, email)
5. Confirmation page (booking code)

**Key Features:**
- Responsive flexbox grid layout (mobile-first)
- Real-time table availability via Supabase subscriptions
- Cinema-style table selection (color-coded: green=available, red=occupied, orange=booked)
- Smooth transitions between steps
- Form validation (email, phone)
- Booking code display (large, easy to copy)

**Design System:**
- Primary color: Teal (#208080 or similar)
- Secondary: Cream/Off-white background
- Status colors: Green (available), Red (occupied), Orange (booked)
- Font: System font stack (-apple-system, Segoe UI)
- Spacing: 8px base unit

**Mobile Optimization:**
- Min 44px touch targets for buttons
- Vertical layout for forms
- Readable font size (16px minimum)
- Hamburger menu if needed

### 2.3 STAFF UI (`staff/index.html`)

**Layout:**
- Left sidebar: Table grid (live view, 5x4 grid for 20 tables)
- Right panel: Booking details (when table selected)
- Top bar: Date/time selector, stats (occupancy %)

**Key Features:**
- Real-time table status updates via Supabase subscriptions
- Click table to see booking details OR mark as occupied
- Buttons for actions:
  - "Mark as Walk-in" → set to occupied (no booking)
  - "Mark as Booked" → open modal to enter customer name/phone
  - "Check In" → confirm customer arrival, record time
  - "Free Up" → clear table
  - "No-show?" → after 30 mins, option to mark as no-show
- Color-coded table status with icons
- Tablet/iPad optimized (landscape orientation)
- Responsive side-by-side layout

**Table Properties Display:**
- Show table capacity and properties on hover/click
- Quick visual indicators (icons for garden, smoking, music, etc.)

### 2.4 Supabase Connection Code

Both UIs need:
```javascript
// Initialize Supabase client
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(supabaseUrl, supabaseKey)

// Real-time subscription for tables status
function subscribeToTableUpdates() {
  supabase
    .channel('public:tables')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tables'
      },
      (payload) => {
        // Update UI with new table status
        updateTableUI(payload.new)
      }
    )
    .subscribe()
}

// Booking generation
function generateBookingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'BKD'
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
```

### 2.5 Key Customer Flow Implementation

**Step 1: Date Selection**
- Calendar picker (native HTML5 `<input type="date">` or lightweight date library)
- Only allow future dates
- Show occupancy indicator

**Step 2: Time Selection**
- Hourly slots (11:00, 11:30, 12:00, ... 22:30)
- Filter available times based on occupancy
- Show approximate wait time if busy

**Step 3: Table Selection**
- Grid layout: 5 columns x 4 rows
- Visualize each table:
  ```
  [Table 1] - Green (Available), Capacity 2, Garden View
  [Table 2] - Red (Occupied), Capacity 4
  [Table 3] - Orange (Booked), Capacity 6, Music Area
  ```
- Allow selection only of available tables
- Show confirmation: "You selected Table 3 for 2 people"

**Step 4: Customer Details**
- Form fields: Name, Email, Phone
- Validation: Email format, phone pattern (Myanmar +95)
- Optional: Special requests textarea

**Step 5: Confirmation**
- Show booking code (large, 24px+ font)
- Button: "Copy Code"
- Show booking summary: date, time, table, customer name
- SMS option: "Send to my phone" (optional for future)

---

## PHASE 3: N8N AUTOMATION WORKFLOW

### 3.1 Workflow 1: Booking Confirmation Email

**Trigger:** Supabase webhook (INSERT to `bookings` table)

**Flow:**
1. **Webhook Node** (Listen for new bookings)
   - Input: booking data with table, customer, date, time

2. **Set Node** (Prepare email variables)
   - Extract: customer name, email, booking code, date, time, table number
   - Format date/time for email (e.g., "Dec 11, 2025 at 7:30 PM")

3. **Gmail/SMTP Node** (Send email)
   - To: {{ $json.customer_email }}
   - Subject: "Your Creator Restaurant Booking Confirmation - Code: {{ $json.booking_code }}"
   - Body template (HTML):
     ```
     Dear {{ $json.customer_name }},
     
     Your booking at Creator Restaurant is confirmed!
     
     Booking Details:
     - Booking Code: {{ $json.booking_code }}
     - Date: {{ $json.formatted_date }}
     - Time: {{ $json.booking_time }}
     - Party Size: {{ $json.party_size }} people
     - Table: {{ $json.table_number }} ({{ $json.table_properties }})
     
     Please arrive 5 minutes early and show your booking code at the entrance.
     
     Questions? Call +95 1 234 5678
     
     Best regards,
     Creator Restaurant Team
     ```

### 3.2 Workflow 2: Staff Telegram Notification

**Trigger:** Supabase webhook (INSERT to `bookings` table)

**Flow:**
1. **Webhook Node** (Listen for new bookings)

2. **Set Node** (Format Telegram message)
   - Create message with: customer name, booking code, date, time, table, party size

3. **Telegram Bot Node** (Send to staff group)
   - Chat ID: {{ env.TELEGRAM_STAFF_GROUP_ID }}
   - Message format:
     ```
     📅 New Booking Received!
     
     Name: [Customer Name]
     Code: [BKD1234]
     Date: Dec 11, 2025
     Time: 7:30 PM
     Table: #3 (Garden View)
     Party: 2 people
     ```

### 3.3 Workflow 3: No-Show Check (Daily Scheduled)

**Trigger:** Cron job (every 30 minutes during service hours: 11:00 - 23:00)

**Flow:**
1. **Cron Node** (Schedule)
   - Every 30 minutes

2. **Supabase Query** (Find bookings that should have checked in)
   - Query: SELECT * FROM bookings WHERE:
     - status = 'confirmed'
     - booking_time <= NOW - 30 minutes
     - booking_date = TODAY

3. **For Each Node** (Iterate results)

4. **If Node** (Condition)
   - If no check_in record exists:
     - Send Telegram to staff: "No-show alert: [Customer] Table [#3] - Auto-cancel in 5 mins"
     - Update booking status to 'no_show' (or give staff chance to check in)

5. **Update Supabase** (Mark as no-show after 5 min grace)
   - Update bookings table: status = 'cancelled', cancelled_reason = 'no_show'
   - Update tables table: status = 'available'

### 3.4 Supabase Webhook Configuration

In Supabase Dashboard > Database > Webhooks:

**Webhook 1 (Booking Insert):**
- Event: Bookings INSERT
- HTTP method: POST
- URL: `https://your-n8n-instance.com/webhook/restaurant-booking`
- Headers: Add auth header if using webhook token

**Payload includes:**
- new: { full booking record }
- old: null (INSERT event)
- event: "INSERT"

---

## PHASE 4: SEED DATA (20 DEMO TABLES)

Insert into `tables` with variety:

```sql
-- Tables 1-4: Garden Area (4 tables)
INSERT INTO tables VALUES
  (1, '1', 2, ARRAY['Garden View', 'Quiet'], 'available'),
  (2, '2', 4, ARRAY['Garden View', 'Quiet'], 'available'),
  (3, '3', 6, ARRAY['Garden View', 'Private'], 'available'),
  (4, '4', 8, ARRAY['Garden View', 'Group Friendly'], 'available');

-- Tables 5-8: Smoking Area (4 tables)
INSERT INTO tables VALUES
  (5, '5', 2, ARRAY['Smoking Area', 'Casual'], 'available'),
  (6, '6', 4, ARRAY['Smoking Area', 'Casual'], 'available'),
  (7, '7', 4, ARRAY['Smoking Area', 'Window View'], 'available'),
  (8, '8', 6, ARRAY['Smoking Area', 'Private'], 'available');

-- Tables 9-12: Music Lounge (4 tables)
INSERT INTO tables VALUES
  (9, '9', 2, ARRAY['Near Music', 'Vibrant'], 'available'),
  (10, '10', 4, ARRAY['Near Music', 'DJ Area'], 'available'),
  (11, '11', 6, ARRAY['Near Music', 'Dance View'], 'available'),
  (12, '12', 8, ARRAY['Near Music', 'Premium'], 'available');

-- Tables 13-16: VIP Zone (4 tables)
INSERT INTO tables VALUES
  (13, '13', 4, ARRAY['VIP', 'Private', 'Premium Service'], 'available'),
  (14, '14', 6, ARRAY['VIP', 'Private', 'Terrace View'], 'available'),
  (15, '15', 8, ARRAY['VIP', 'Private', 'Panoramic View'], 'available'),
  (16, '16', 10, ARRAY['VIP', 'Private', 'Executive'], 'available');

-- Tables 17-20: Window & Mix (4 tables)
INSERT INTO tables VALUES
  (17, '17', 2, ARRAY['Window Seat', 'City View'], 'available'),
  (18, '18', 4, ARRAY['Window Seat', 'River View'], 'available'),
  (19, '19', 6, ARRAY['Window Seat', 'Sunset View', 'Romantic'], 'available'),
  (20, '20', 8, ARRAY['Mixed Area', 'Family Friendly'], 'available');
```

---

## PHASE 5: ENVIRONMENT VARIABLES

Create `.env.local` file:

```
# Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# n8n
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
N8N_WEBHOOK_TOKEN=your_secure_token

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABCDefg...
TELEGRAM_STAFF_GROUP_ID=-1001234567890

# Email (if using SMTP)
SMTP_FROM=noreply@creatorrestaurant.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=app_password

# Restaurant Config
RESTAURANT_NAME=Creator Restaurant
RESTAURANT_PHONE=+95 1 234 5678
RESTAURANT_EMAIL=bookings@creatorrestaurant.com
SERVICE_START=11:00
SERVICE_END=23:00
BOOKING_DURATION=120
DEFAULT_PARTY_SIZE=2
```

---

## PHASE 6: DEVELOPMENT WORKFLOW

### With GitHub Copilot Agent (Claude Sonnet):

1. **Initialize Project:**
   - `npm init vite@latest creator-restaurant -- --template vanilla`
   - Install dependencies: `npm install @supabase/supabase-js`

2. **Ask Copilot Agent:**
   - "Create customer booking UI with multi-step form following this spec..."
   - "Add real-time table subscription from Supabase"
   - "Build staff dashboard with table grid and status updates"
   - "Implement booking code generation and validation"

3. **Testing:**
   - Ask agent to add console logging for debugging
   - Request error handling for network failures
   - Ask for sample test data submission workflow

4. **Refinement:**
   - "Make the table grid responsive for mobile"
   - "Add loading states and animations"
   - "Improve accessibility (ARIA labels, keyboard nav)"

---

## PHASE 7: DEPLOYMENT CHECKLIST

**Before Going Live:**
- [ ] Test all customer booking flows end-to-end
- [ ] Verify Supabase webhooks trigger correctly
- [ ] Test n8n email and Telegram notifications
- [ ] Verify real-time updates in both UIs
- [ ] Test on actual mobile/tablet devices
- [ ] Set up proper error logging
- [ ] Configure backup strategy for Supabase
- [ ] Document staff training (how to use admin UI)
- [ ] Set up status page monitoring

**Deployment Targets:**
- Hosting: Vercel (free tier, auto-deploy from GitHub)
- Custom domain: Point to Vercel
- n8n: Self-hosted on VPS or n8n.cloud
- Supabase: Already managed (no deploy needed)

---

## PHASE 8: POST-LAUNCH FEATURES (Future Roadmap)

1. **SMS Notifications** - Confirm bookings via SMS
2. **Admin Analytics** - Revenue, popular times, no-show rates
3. **Customer Login** - Modify/cancel bookings
4. **Staff Authentication** - Secure admin login
5. **Multi-language** - Myanmar, Thai, English
6. **Payment Integration** - Deposit or full payment option
7. **Loyalty Program** - Booking rewards
8. **Waitlist System** - If fully booked
9. **Photo Gallery** - Show table photos with properties
10. **Review System** - Customer feedback

---

## KEY TECHNICAL NOTES

1. **Real-Time Performance:**
   - Use Supabase Postgres Changes (not Broadcast) for this scale (20 tables, <100 concurrent users)
   - Subscribe only to specific table status changes, not full table scans

2. **Booking Code:**
   - Generate on client before submission
   - Verify uniqueness in database with UNIQUE constraint
   - If collision, retry with new code

3. **Table Availability Logic:**
   - Available = status = 'available'
   - Filter bookings by date_time range (not just date)
   - Account for 120-minute booking duration

4. **Timezone:**
   - Store all times in UTC in Supabase
   - Display in local timezone (Asia/Bangkok for Myanmar)
   - Careful with date boundaries near midnight

5. **No-Show Handling:**
   - 30-minute grace period after booking_time
   - Alert staff at 25-minute mark
   - Auto-cancel and free table at 30-minute mark
   - Track no-shows in audit log

6. **Mobile Optimization:**
   - Use flexbox/grid for responsive layouts
   - Test on actual phones (not just browser DevTools)
   - Ensure 44px minimum touch targets
   - Optimize images (use WebP where possible)

---

## SUPPORT & MONITORING

- Set up Sentry or LogRocket for error tracking
- Monitor Supabase usage via dashboard
- Monitor n8n workflow execution logs
- Set up Telegram alerts for critical errors
- Weekly backup verification

---

## CONTACT & ITERATION

Once built, request from Copilot Agent:
- "Add dark mode toggle"
- "Create staff login page"
- "Set up email verification for customers"
- "Add booking modification flow"
- "Create admin dashboard with analytics"

Each iteration should be incremental and testable.