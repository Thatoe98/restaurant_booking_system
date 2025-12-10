# 🍽️ Creator Restaurant Booking System

A modern, real-time restaurant table reservation system built for Myanmar mid-to-high-end restaurants.

![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

## ✨ Features

### Customer Booking Portal
- 📅 **Easy Date Selection** - Calendar picker with future date validation
- 🕐 **Time Slot Selection** - Visual time slots with availability indicators
- 🪑 **Interactive Table Selection** - Cinema-style table grid with real-time availability
- 📱 **Mobile Responsive** - Fully optimized for phones, tablets, and desktops
- 🎫 **Instant Booking Code** - Unique booking codes for easy check-in

### Staff Dashboard
- 📊 **Real-time Table Overview** - Live 5x4 grid showing all 20 tables
- 🔄 **Live Status Updates** - Powered by Supabase real-time subscriptions
- 👤 **Walk-in Management** - Quick marking for walk-in customers
- 📞 **Phone Booking Support** - Create bookings on behalf of customers
- ✅ **Check-in System** - Track customer arrivals
- 📈 **Occupancy Stats** - Real-time availability and occupancy percentage

### Automation (n8n Integration)
- 📧 **Email Confirmations** - Automatic booking confirmation emails
- 💬 **Telegram Notifications** - Instant alerts to staff group
- ⚠️ **No-show Alerts** - Automated alerts for overdue bookings

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 |
| **Build Tool** | Vite |
| **Database** | Supabase (PostgreSQL) |
| **Real-time** | Supabase Realtime |
| **Automation** | n8n (self-hosted) |
| **Hosting** | Vercel |

## 📸 Screenshots

### Customer Booking Flow
```
[Date Selection] → [Time & Table Selection] → [Customer Details] → [Confirmation]
```

### Staff Dashboard
```
┌─────────────────────────────────────────────────┐
│  🍽️ Creator Restaurant          [Dec 10, 2025] │
├─────────────────────────────────────────────────┤
│  Available: 15  │  Booked: 3  │  Occupied: 2    │
├───────────────────────┬─────────────────────────┤
│   TABLE GRID (5x4)    │   BOOKING DETAILS       │
│   ┌──┬──┬──┬──┬──┐   │   Table #5              │
│   │1 │2 │3 │4 │5 │   │   Status: Booked        │
│   ├──┼──┼──┼──┼──┤   │   Customer: John Doe    │
│   │6 │7 │8 │9 │10│   │   Time: 7:00 PM         │
│   ├──┼──┼──┼──┼──┤   │   Party: 4 guests       │
│   │11│12│13│14│15│   │                         │
│   ├──┼──┼──┼──┼──┤   │   [Check In] [Cancel]   │
│   │16│17│18│19│20│   │                         │
│   └──┴──┴──┴──┴──┘   │                         │
└───────────────────────┴─────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- (Optional) n8n instance for automation

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/creator-restaurant.git
   cd creator-restaurant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase database**
   
   Run the SQL schema in your Supabase SQL Editor (see `database-schema.sql`)

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   - Main: http://localhost:3000
   - Customer: http://localhost:3000/customer/
   - Staff: http://localhost:3000/staff/ (code: 123)

## 📁 Project Structure

```
creator-restaurant/
├── index.html              # Landing page
├── customer/
│   ├── index.html          # Customer booking UI
│   ├── styles.css          # Customer styles
│   └── script.js           # Booking logic
├── staff/
│   ├── index.html          # Staff dashboard UI
│   ├── styles.css          # Dashboard styles
│   └── script.js           # Dashboard logic
├── src/
│   └── supabase.js         # Supabase client & utilities
├── .env                    # Environment variables
├── vite.config.js          # Vite configuration
└── package.json
```

## 🗄️ Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `tables` | Restaurant tables (20 tables with properties) |
| `bookings` | Customer reservations |
| `audit_log` | Staff action history |

### Table Properties
- Garden View, Quiet, Private
- Smoking Area, Window View
- Near Music, DJ Area, Dance View
- VIP, Premium Service, Terrace View
- City View, River View, Sunset View

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Environment variables for sensitive keys
- Staff dashboard protected with access code
- Supabase anon key (safe for client-side)

## 🌐 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

### Environment Variables for Production

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

## 📧 n8n Automation Setup

1. Create webhook in n8n: `POST /webhook/restaurant-booking`
2. Add Supabase webhook trigger on `bookings` INSERT
3. Configure email (Gmail/SMTP) and Telegram nodes
4. Activate workflow

## 🎯 Future Roadmap

- [ ] SMS notifications
- [ ] Customer accounts & booking history
- [ ] Admin analytics dashboard
- [ ] Multi-language support (Myanmar, Thai, English)
- [ ] Payment integration (deposits)
- [ ] Waitlist system
- [ ] Table photos
- [ ] Review & feedback system

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

Built with ❤️ for Myanmar restaurants

---

⭐ **Star this repo if you found it helpful!**
