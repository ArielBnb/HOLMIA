# HOLMIA — Business Rules, Permissions & Persistence Test Report

- **Date:** 24 November 2026
- **Runner:** `npm run test:all` (Node.js 24 LTS with built-in `node:sqlite`)
- **Overall Result:** **205 / 205 tests PASSED (0 failures)**

---

## Summary by Test Suite

| Suite | Command | Tests Passed | Scope Verified |
| :--- | :--- | :---: | :--- |
| **1. CRUD & Lifecycle Repositories** | `npm run test:repositories` | **52 / 52** | User/Property/Offer/Rental CRUD, filters (price, location, type, sale/rent), `Draft → Active → Under Offer → Sold/Rented`, `Sold → Active` & `Rented → Active` blocked, `Under Offer` field locks, atomic offer acceptance, rental decisions, Agent KPI metrics |
| **2. Session & Role Access Control** | `npm run test:session` | **49 / 49** | Strict Buyer / Seller / Agent isolation, unauthorized actions denied, own-property and assigned-property boundaries, logout/session checks |
| **3. Seller Creation Form** | `npm run test:seller-form` | **10 / 10** | Required fields validation (title, description, price, listing type, property type, location), simulated images, `draft` creation |
| **4. Seller Edit & Delete Rules** | `npm run test:seller-edit` | **30 / 30** | Cross-seller edits/deletes blocked, price/type/listing_type locked when `under_offer`, non-commercial fields editable, delete blocked on `under_offer`/`sold`, linked records cleaned without orphans |
| **5. Offer Decisions (Atomic)** | `npm run test:offers` | **23 / 23** | Only owner or assigned agent decides, accepting one offer rejects all competing offers and moves property to `under_offer`, double acceptance blocked at service and DB unique-index level |
| **6. Buyer Enquiries & Replies** | `npm run test:enquiries` | **23 / 23** | Buyer-only enquiry creation, Seller/Agent inbox isolation, reply storage, Pending/Handled indicators, length validation |
| **7. Local SQLite Persistence & Integrity** | `npm run test:persistence` | **18 / 18** | `PRAGMA foreign_keys = ON`, idempotent `seedDatabase`, full persistence on disk across `close()` & reopen (users, properties, `status_history`, offers, rental applications, enquiries), cascade deletes with 0 orphans, `PRAGMA foreign_key_check` = 0 violations |
| **TOTAL** | `npm run test:all` | **205 / 205** | **100% PASS** |

---

## Core Specification Constraints Verified

- **Illegal transitions blocked:** `sold → active` and `rented → active` raise explicit terminal-state errors.
- **Commercial field locks under offer:** `price`, `property_type`, and `listing_type` cannot be modified once a property reaches `under_offer`, while non-commercial details remain editable.
- **Status history audit trail:** Every state transition is logged chronologically in `status_history` with author, timestamp, and notes, and persists across database restarts.
- **Single accepted offer guarantee:** Accepting one sale offer atomically rejects all other pending offers for the same property and transitions the property to `under_offer`; a second accepted offer is rejected both in application logic and by the SQLite partial unique index `idx_offers_one_accepted`.
- **Rental applications:** Buyers submit move-in dates and optional notes on `rent` listings only; Seller/Agent can accept or reject.
- **Unauthorized access denied:** Buyers cannot mutate listings or decide offers; Sellers cannot touch other Sellers' listings; Agents cannot create listings or touch unassigned properties.
- **Database integrity:** Zero orphan rows after deletions and zero `PRAGMA foreign_key_check` violations.
