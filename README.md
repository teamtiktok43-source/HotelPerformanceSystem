# Hotel Performance System — Full Web App

A full multi-user Hotel Performance System built as a real web application:

- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI
- Database: SQLAlchemy (SQLite by default; PostgreSQL-ready via `DATABASE_URL`)
- Authentication: JWT
- Realtime: WebSockets
- Reports: dashboard + tables + charts + print-friendly layouts
- Roles: Admin, Manager, Employee
- Seed users:
  - Mostafa / `M123456m` — Admin
  - Mohamed / `M1234m` — Employee
  - Mang / `Mm123456` — Manager

> Change these passwords before production deployment.

## Structure

```text
HotelPerformanceSystem/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── seed.py
│   │   └── websocket.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── main.tsx
│   │   ├── styles.css
│   │   └── components/
│   │       ├── Layout.tsx
│   │       ├── PrintButton.tsx
│   │       ├── ProtectedRoute.tsx
│   │       └── StatCard.tsx
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── Home.tsx
│   │       ├── DailyBookings.tsx
│   │       ├── DailyRevenue.tsx
│   │       ├── Reviews.tsx
│   │       ├── HotelRatings.tsx
│   │       ├── MonthlyReport.tsx
│   │       ├── Hotels.tsx
│   │       ├── Employees.tsx
│   │       └── Data.tsx
│   └── package.json
├── docker-compose.yml
└── .gitignore
```

## Run locally

### 1) Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

API: http://127.0.0.1:8000  
Docs: http://127.0.0.1:8000/docs

### 2) Frontend

Open a second VS Code terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

### 3) Multi-device on the same LAN

Run the backend with:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Run Vite with:

```powershell
npm run dev -- --host 0.0.0.0
```

Then use the server PC's LAN IP, e.g.:

```text
http://192.168.1.50:5173
```

All devices use one backend and one database, and changes are broadcast through WebSockets.

### 4) PostgreSQL later

Set `DATABASE_URL` in `.env` to a PostgreSQL SQLAlchemy URL, for example:

```text
postgresql+psycopg://hotel_app:password@localhost:5432/hotel_performance
```

The application code is already written around SQLAlchemy so the migration is straightforward.

## Main functional areas

### Home Dashboard
- Date range + hotel filters
- KPI cards for reviews, bookings, paid/cash, revenue, commission, net revenue, rating
- Revenue by hotel chart
- Paid vs cash chart
- Review sentiment chart
- Top / weakest hotel metrics
- View Report and Refresh actions
- Print shortcuts
- Always shows charts with zero-state data instead of disappearing

### Daily Bookings
- Hotel, booking date, total bookings, paid bookings, cash bookings, employee
- Search/filter by date, hotel, employee, payment type
- Live save and live refresh
- Print-ready report

### Daily Revenue
- Booking number, hotel, platform, revenue date, actual price
- Commissionable amount
- Hotel commission rate auto-applied
- Commission + net revenue auto-calculated
- Employee
- Print-ready report with chart

### Reviews
- Booking number, hotel, rating, comment, sentiment, review date
- Proposed action entered by employee
- Manager approves/rejects
- Employee who entered review is stored
- Print-ready report with chart

### Hotel Ratings
- Hotel-level review counts and average ratings
- Positive/negative/pending sentiment summary
- Refresh + print

### Monthly Report
- Monthly KPIs and hotel comparison
- Revenue, commission, net revenue, bookings and rating charts
- Print-friendly report containing the written report, tables and charts in the same document

### Hotels / Employees / Data
- Hotel commission rate management
- Employee management and active status
- Data page to review all records

## Printing

Every major report includes a **Print Report** button. The print CSS intentionally places summary tables and charts in the same print document so the chart is next to / below the relevant written report section instead of becoming a separate report.

## Security notes

This starter stores the default credentials only as secure password hashes in the database. The plaintext passwords are used only for the initial seed. Change them before real deployment and set a strong `SECRET_KEY`.
### Hotels editing
The Hotels page now supports editing hotel name, commission rate, and active/inactive status from the table. Admins and managers can edit; employees cannot.

