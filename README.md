# HOLMIA — Real Estate Management Application

University mobile marketplace application built with **React Native (Expo)** for property **sales and rentals**, supporting three distinct user roles: **Buyer**, **Seller**, and **Agent**.

- **Team:** Ariel (Buyer), Abdoulaye / ABD (Seller), and Timothé (Agent & Database Architecture)
- **Submission Deadline:** 2 December 2026 at 5:00 PM
- **Presentations:** 3 December & 8 December 2026

---

## Tech Stack

- **Mobile & Web Framework:** React Native, Expo SDK 58, JavaScript / TypeScript (`blank` template)
- **Local Database:** Built-in SQLite (`node:sqlite`) with isolated CRUD repositories (`src/repositories/`) and foreign-key enforcement
- **Cloud Backend & Auth:** Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS), Transactional RPCs, and Realtime Messaging
- **Session Persistence:** `@react-native-async-storage/async-storage` (mobile) and browser storage (web)
- **Package Management & Quality:** npm (`package-lock.json`), ESLint (`eslint-config-expo`), and 205 automated tests

---

## Installation & Quick Launch (Windows)

### Prerequisites
- **Node.js 24 LTS** (https://nodejs.org/)
- **npm** and **Git** (https://git-scm.com/downloads/win)

Verify your environment in PowerShell:

```powershell
node --version
npm --version
git --version
```

### 1. Clone & Install

```powershell
git clone https://github.com/ArielBnb/HOLMIA.git
cd HOLMIA
npm ci
```

### 2. Configure Environment Variables

Create your local `.env` file from the template:

```powershell
Copy-Item .env.example .env
```

Fill in the two public variables from **Supabase > Settings > API Keys**:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (starts with `sb_publishable_`)

> **Security note:** `EXPO_PUBLIC_*` variables are bundled into client builds and are public. Never place `sb_secret_*`, `service_role`, or database passwords inside `.env`. Both `.env` and `.env.test.local` are ignored by Git.

### 3. Run the Application

```powershell
npx expo start --clear
```

- Press **`w`** to open the app directly in your web browser (`http://localhost:8081`).
- Run `npm run android` or `npm run ios` to launch on an emulator or physical device.
- Useful Expo commands:
  - `npx expo-doctor`: check project configuration and dependencies
  - `npx expo export --platform web`: verify the web production bundle

---

## Demo Accounts & Role Workflows

Three demo accounts are pre-configured in Supabase Auth & `public.profiles` (passwords are shared privately within the team and never committed to Git):

| Role | Demo Email | Core Functionalities |
| :--- | :--- | :--- |
| **Buyer** | `buyer@holmia.example` | Browse active listings, filter by price/location/property type/sale vs. rent, view property details, send enquiries, track replies & messages |
| **Seller** | `seller@holmia.example` | Create sale/rent listings (with simulated images), edit/delete own properties (with Under Offer locks), review & accept/reject offers, reply to enquiries |
| **Agent** | `agent@holmia.example` | Dashboard KPIs (active listings per user, average price, offers per property), managed properties portfolio, listing moderation (approve/reject drafts), strict lifecycle management (`Draft → Active → Under Offer → Sold / Rented`) with status history audit trail, offer decisions & live enquiries |

---

## Project Structure

```text
HOLMIA/
├── assets/                     # Static assets and property illustrations
├── scripts/                    # Verification scripts (Supabase & SQL checks)
├── supabase/
│   ├── migrations/             # PostgreSQL schema, triggers, RLS policies & RPCs
│   └── seed.sql                # Reproducible demo listings (sale & rent)
├── src/
│   ├── components/             # Reusable custom React Native UI components
│   ├── config/                 # Supabase client configuration (supabase.js)
│   ├── context/                # Authentication context (AuthContext.js)
│   ├── database/               # Local SQLite database (db.ts) & demo seed (seed.ts)
│   ├── navigation/             # Role-isolated navigation (AuthNavigator.js, BuyerNavigator.js)
│   ├── repositories/           # Isolated CRUD repositories (User, Property, Offer, Rental, Enquiry)
│   ├── screens/                # Role-specific screens (Login, Buyer, Seller, Agent, Messaging)
│   ├── services/               # Business rules, validation & Supabase/local adapters
│   ├── styles/                 # Custom themes (pure white #FFFFFF, terracotta #B6311E, #2A2424 borders)
│   ├── tests/                  # Automated test suites (187 tests)
│   └── utils/                  # Cross-platform utilities (e.g. universal UUID generator)
├── App.js                      # Application root
├── index.js                    # Expo entry point
├── package.json
└── README.md
```

---

## Local SQLite Database & CRUD Repositories

To satisfy the local database, scalability, and data consistency requirements, all local persistence is isolated behind typed repositories in `src/repositories/`:

- **Schema & Seed (`src/database/db.ts`, `src/database/seed.ts`):**
  - Tables: `users`, `properties`, `status_history`, `offers`, `rental_applications`, `enquiries`
  - Strict foreign keys (`PRAGMA foreign_keys = ON`)
  - Initialize or reset local sample data:
    ```powershell
    npm run seed:sqlite
    ```
- **Repositories (`src/repositories/`):**
  - `userRepository.ts`: Buyer / Seller / Agent CRUD and role validation.
  - `propertyRepository.ts`: CRUD, multi-criteria filtering (price range, location, property type, sale/rent), strict lifecycle state machine (`draft → active → under_offer → sold / rented`), blocking illegal transitions (`sold → active`, `rented → active`), locking commercial fields (`price`, `property_type`, `listing_type`) once `under_offer`, automatic `status_history` audit logging, and Agent dashboard KPI calculations.
  - `offerRepository.ts`: Sale offer CRUD and atomic offer acceptance (accepting one offer automatically rejects all competing pending offers and moves the property to `under_offer` within a single transaction).
  - `rentalRepository.ts`: Rental application CRUD (move-in date, optional notes, accept/reject).
  - `enquiryRepository.ts`: Buyer enquiries and Seller/Agent replies with ownership isolation.

---

## Supabase Backend & Row Level Security (RLS)

- **Project:** [HOLMIA](https://supabase.com/dashboard/project/icfqjwfmcwlejqpezhyi) (`eu-west-1`)
- **API URL:** `https://icfqjwfmcwlejqpezhyi.supabase.co`
- **Migrations (`supabase/migrations/`):** Defines tables (`profiles`, `properties`, `offers`, `enquiries`, `messages`, `property_messages`), indexes, triggers, transactional RPCs (`accept_offer`, `reject_offer`, `reply_enquiry`), and PostgreSQL RLS policies.

### Role-Based Access Control Matrix

| Action | Buyer | Seller | Agent | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: |
| Read active listings | Yes | Yes | Yes | Yes |
| Read non-active listings | No | Own listings | Assigned listings | No |
| Create a listing | No | Own listings | No | No |
| Edit / delete a listing | No | Own listings | Assigned listings | No |
| Edit own profile (name / username) | Yes | Yes | Yes | No |
| Escalate own role | No | No | No | No |

---

## Automated Tests & Verification

Run the full automated test suite (**205 tests** — see [TEST_REPORT.md](./TEST_REPORT.md) for the recorded results):

```powershell
npm run test:all
```

This runs:
1. `npm run test:repositories` — SQLite CRUD, filters, lifecycle constraints, atomic offer acceptance, rental applications, and Agent KPIs
2. `npm run test:session` — Role isolation and access control enforcement
3. `npm run test:seller-form` — Seller listing creation validation
4. `npm run test:seller-edit` — Seller edit/delete ownership and `Under Offer` field locks
5. `npm run test:offers` — Transactional offer acceptance/rejection and double-acceptance prevention
6. `npm run test:enquiries` — Buyer enquiries, permission isolation, and Seller/Agent replies
7. `npm run test:persistence` — Disk persistence across close/reopen, cascade deletes, and `PRAGMA foreign_key_check`

Additional checks:

```powershell
npm run lint
npx expo-doctor
npx expo export --platform web
```

---

## Git Collaboration Workflow

For each feature or bug fix:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/task-name
# Edit and verify files
git add <files>
git commit -m "Describe the change"
git push -u origin feature/task-name
```

Open a Pull Request into `main` for team review before merging. Never commit `node_modules`, Expo caches, or `.env` files.

---

## References Used During Development

- **React Native Official Documentation (Core Components, Hooks, StyleSheet):** https://reactnative.dev/docs/getting-started
- **Expo SDK & Expo CLI Documentation:** https://docs.expo.dev/
- **Using Supabase with Expo:** https://docs.expo.dev/guides/using-supabase/
- **Supabase Documentation (PostgreSQL, Auth, Row Level Security, RPC, Realtime):** https://supabase.com/docs
- **Supabase Auth Quickstart for React Native:** https://supabase.com/docs/guides/auth/quickstarts/react-native
- **Node.js Built-in SQLite (`node:sqlite`) Documentation:** https://nodejs.org/api/sqlite.html
- **React Native AsyncStorage Documentation:** https://react-native-async-storage.github.io/async-storage/
- **ESLint & `eslint-config-expo` Guide:** https://docs.expo.dev/guides/using-eslint/
