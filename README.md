# 💊 CareCircle — Elderly Care & Medication Management

> **CareCircle** is an elderly care and medication management web application built for hackathons, family caregivers, and seniors. It features multi-role passcode authentication, an elder-first high-contrast interface, an automated 7-day adherence engine, doctor appointment scheduling, Brevo email notifications with console simulation, and Gemini AI natural language prescription auto-filling.

---

## 🌟 Key Highlights

- **Auto-Seeding JSON Database**: Starts with rich, current demo data on *every* launch—no manual setup or database servers needed.
- **Role-Based Passcodes (Bcrypt Hashed)**: A single patient profile with 3 distinct passcodes for **Elder**, **Caretaker**, and **Family (View-Only)**.
- **Elder Mode**: High-contrast, 20px+ font scaling, bold focus states, tactile buttons, keyboard-friendly navigation, and ARIA live announcements.
- **Weekly Adherence Engine**: Automatic 7-day adherence score calculation, daily breakdowns, streak tracking, and dose status indicators.
- **Brevo Email Reminders & Alerts**: Automated notifications for upcoming doses, upcoming doctor appointments, and **missed dose alerts dispatched directly to caretakers and family**. Gracefully simulates in the console when `BREVO_API_KEY` is not provided.
- **Gemini AI Natural Language Auto-Fill**: Type informal instructions like *"Metformin 500mg twice daily after meals"* to auto-fill prescriptions with structured times and days, backed by a clinical disclaimer.
- **Production Hardened**: `helmet` security headers, `express-rate-limit`, `httpOnly` JWT session cookies, `/healthz` monitoring, and input validation.

---

## 🔑 Demo Role Passcodes

CareCircle supports 3 distinct access tiers for **Eleanor Vance** (Age 78):

| Role | Demo Passcode | Permissions | Description |
| :--- | :--- | :--- | :--- |
| **Elder** | `1234` | Full Dose Tracking & View | Eleanor's dedicated view. Large buttons to mark doses as **Taken** or **Missed**, view visits, and track adherence. |
| **Caretaker** | `5678` | Full Admin & Management | Eleanor's primary caretaker (Marcus). Add/edit/delete medications, schedule doctor visits, run reminder cron jobs, and review audit logs. |
| **Family** | `9012` | **View-Only** | Eleanor's granddaughter (Sophia). Can monitor adherence, scheduled visits, and medication lists, but **cannot edit or alter records**. |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v20/v22/v26)
- **npm** v9+

### 2. Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Run the application (listens on process.env.PORT or 3000)
npm start
```

### 3. Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)**.
- Click any of the quick-login role cards (or enter `1234`, `5678`, or `9012`).
- Toggle **Elder Mode** in the top navigation for large text and high-contrast styling.
- Click **"Send Test Reminder"** in the navigation to verify email alerting.

---

## ⚙️ Environment Variables (`.env`)

A ready-to-use `.env.example` is included:

```ini
# Server Port & Environment
PORT=3000
NODE_ENV=development

# JWT Secret for Session Cookies
JWT_SECRET=carecircle-super-secret-key-hackathon-2026

# Secret for Cron Endpoint (POST /api/cron/run-reminders)
CRON_SECRET=carecircle-cron-secret-token

# Brevo (Sendinblue) Email API
# (Leave empty to use built-in formatted console simulation)
BREVO_API_KEY=
BREVO_SENDER_EMAIL=alerts@carecircle.health
BREVO_SENDER_NAME=CareCircle Health

# Google Gemini API
# (Leave empty to use built-in offline heuristic NLP fallback)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

> **Zero Configuration Required**: If `BREVO_API_KEY` or `GEMINI_API_KEY` are not set, CareCircle automatically falls back to clean simulation logging in the console and intelligent local NLP parsing, making it 100% testable offline and during live hackathon demos.

---

## 🏗️ Architecture Overview

```
carecircle/
├── public/                     # Vanilla HTML/CSS/JS frontend served by Express
│   ├── css/
│   │   └── style.css           # Modern design system + .elder-mode high-contrast
│   ├── js/
│   │   └── app.js              # SPA navigation, state management, modal logic
│   └── index.html              # Semantic HTML5, ARIA labels, responsive views
├── src/
│   ├── config.js               # Centralized configuration & environment loader
│   ├── db/
│   │   ├── db.js               # JSON file database with in-memory sync & audit logs
│   │   └── seed.js             # Dynamic auto-seeding engine (dates relative to today)
│   ├── middleware/
│   │   └── auth.js             # JWT extraction, role checks, view-only enforcement
│   ├── routes/
│   │   ├── activityLogs.js     # Audit trail stream
│   │   ├── adherence.js        # 7-day adherence math & visual breakdown
│   │   ├── ai.js               # Gemini AI natural language prescription parser
│   │   ├── appointments.js     # Doctor consultation CRUD
│   │   ├── auth.js             # Passcode bcrypt auth, session cookies, logout
│   │   ├── cron.js             # Cron triggers (/api/cron/run-reminders) & test alerts
│   │   ├── doses.js            # Today's dose schedule & mark taken/missed
│   │   └── medications.js      # Medication prescriptions CRUD
│   ├── services/
│   │   ├── emailService.js     # Brevo REST API + formatted console fallback
│   │   ├── geminiService.js    # Gemini 2.5 API integration + heuristic parser
│   │   └── reminderService.js  # Deduplicated upcoming/missed dose & visit alerts
│   └── server.js               # Express app, helmet, rate limiting, static server
├── data/
│   └── carecircle-db.json      # Auto-seeded demo state (profile, meds, doses, visits)
├── test/
│   └── carecircle.test.js      # Comprehensive automated test suite (8/8 pass)
├── .env.example                # Template environment variables
├── .gitignore                  # Prevents node_modules or secrets in repo
└── package.json                # Project dependencies (< 10 MB footprint)
```

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/login` — Login with 4-digit passcode (`{ passcode }`). Sets `carecircle_token` httpOnly cookie.
- `GET /api/auth/me` — Verify session and retrieve current user role & profile.
- `POST /api/auth/logout` — Clear session cookie.

### Doses & Adherence
- `GET /api/doses/today` — Compute today's scheduled doses and current status (`taken`, `missed`, `pending`).
- `POST /api/doses/log` — Mark dose taken or missed (`{ medicationId, scheduledTime, status: 'taken'|'missed' }`). *Blocked for Family role.*
- `GET /api/adherence/weekly` — Retrieve 7-day compliance rate, day-by-day counts, and adherence streak.

### Medications
- `GET /api/medications` — List all active prescriptions.
- `POST /api/medications` — Add medication with times & days. *Blocked for Family role.*
- `PUT /api/medications/:id` — Update medication details. *Blocked for Family role.*
- `DELETE /api/medications/:id` — Remove medication. *Blocked for Family role.*

### Doctor Appointments
- `GET /api/appointments` — List appointments sorted upcoming first.
- `POST /api/appointments` — Schedule new doctor visit. *Blocked for Family role.*
- `PUT /api/appointments/:id` — Edit doctor visit. *Blocked for Family role.*
- `DELETE /api/appointments/:id` — Cancel doctor visit. *Blocked for Family role.*

### Email Reminders & Cron
- `POST /api/cron/run-reminders` — Evaluates upcoming doses (< 90m), **missed doses (sent to caretakers & family)**, and appointments (< 48h). Protected by header `x-cron-secret: carecircle-cron-secret-token`.
- `POST /api/reminders/send-test` — Dispatches test notification via Brevo or server console simulator.
- `GET /api/reminders/logs` — View deduplication reminder log.

### Gemini AI
- `POST /api/ai/parse-medication` — Parses natural language (`{ prompt: "Metformin 500mg twice daily after meals" }`) into structured JSON with medical disclaimer.

### System
- `GET /healthz` — Service health check with timestamp, uptime, and status.

---

## 🧪 Testing

Run the automated test suite verifying all 8 core systems:

```bash
npm test
```

Test coverage includes:
1. `/healthz` operational status
2. Passcode validation & httpOnly JWT cookie issuance
3. Family view-only permission enforcement (HTTP 403)
4. Caretaker medication CRUD
5. Dose logging & 7-day adherence calculations
6. Doctor appointment scheduling
7. Protected cron endpoint (`x-cron-secret`) & Brevo simulation
8. Gemini AI / heuristic natural language parser & disclaimer

---

## ♿ Accessibility & Elder Mode

CareCircle was designed specifically for seniors and intergenerational caregivers:
- **Elder Mode Switch**: Instantly magnifies font sizes to 20–26px with high-contrast borders and large (56px+) tactile touch buttons.
- **Keyboard Navigation**: Complete tab indexing and active focus rings across all interactive cards and form controls.
- **Accessible ARIA Landmarks**: Uses `<header>`, `<main>`, `<nav>`, `role="dialog"`, `role="alert"`, and `aria-live="polite"` for instant status changes.
- **Keypad Input**: Onscreen touch keypad in addition to standard keyboard input for simpler tablet/mobile interaction.

---

## 📄 License
MIT License. Created for the Elderly Care & Medication Management Hackathon.
