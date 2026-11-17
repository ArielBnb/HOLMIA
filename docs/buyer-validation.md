# HOLMIA — Buyer catalogue, details and filters

Validation: 17 November 2026. Implementation validated locally. Publication explicitly authorized by Ariel and performed through the dedicated branch; no merge is performed. See GitHub for the current PR state.

## Initial repository audit

| Ref | Finding |
| --- | --- |
| main — c160b2329d0de0fc2764d69eec2d3960900e50b9 | Latest combined code; PR #4 merged Agent portfolio, moderation and lifecycle. Existing App uses a demo session and tab navigation. |
| feature/crud-repositories — 8907019 | Agent/SQLite work already merged into main. |
| feature/supabase-setup | Earlier Supabase foundation already integrated into main. |
| feature/authentication — bba2e8a | Separate Login/Register implementation, not integrated into main; divergent from newer Agent work. |
| fix/expo-go-auth-launch — 2c5d25a | Restores authService and activates AuthNavigator on top of the authentication branch. |

Open PR: https://github.com/ArielBnb/HOLMIA/pull/3 (draft), `fix/expo-go-auth-launch` → `feature/authentication`. Initial connector PR search omitted it; direct REST collection confirmed it. Do not overwrite main with that older branch. This mission does not resolve the team's separate authentication integration.

Dedicated branch created: https://github.com/ArielBnb/HOLMIA/tree/feature/buyer-catalogue-filters . It was created from the original main commit and is being populated with the reviewed implementation. Automatic approval review rejected git push because the attached instructions were not considered explicit end-user authorization to disclose source files to the public GitHub repository. The GitHub connector also returns 403 for write operations; the connected browser can create a branch. Publication was paused after rejection. Ariel subsequently explicitly authorized publication and enabled Chrome file transfers; the reviewed files are published through the existing signed-in GitHub browser session. GitHub attachment uploads failed, so source editing is used instead; the original JPEG is encoded as a bundled data URI for offline use, without changing its bytes.

## Implementation

- Existing Catalogue tab now opens BuyerNavigator. Login, Register, Agent/Seller screens, repositories and their existing navigation remain untouched. The legacy tab bar is hidden within Buyer views; Profile returns to existing Login/session controls.
- Supabase-backed list, stable pagination (20 per page), debounced text search across title/location, All/Sale/Rent, loading/error/retry/empty states.
- Details fetch by UUID and active status, unavailable state, description, transaction/property types, return to Browse. Sale uses Make offer; rent uses Apply to rent.
- Advanced min/max price, location, multiple property types and listing types. Apply combines with text/quick filters using AND. Other includes non-house/flat/studio values such as the existing loft. Contradictory Sale/Rent combinations intentionally yield no results.
- Filters and search survive navigation to details and back. Filter edits remain drafts until Apply; close discards edits. Reset clears the draft; Apply then clears text/quick criteria as well. Price validation rejects negatives, invalid numbers and inverted bounds; blank, zero and up to two decimals accepted.
- Future action callback: `onNavigate(destination, { propertyId })` on BuyerNavigator, destinations `offer`, `rental`, `enquiry`, `favourites`, `offers`. There are no existing compatible native screens for these features on main. An explicit unavailable message is shown; nothing is simulated as saved or sent. SQLite repositories were not wired to cloud UUID actions.
- To combine with the authentication PR later, mount BuyerNavigator in AuthNavigator's buyer destination, supply real Profile/navigation callbacks, and retain Agent destinations. Do not replace App.js with the older authentication branch wholesale.

## Files

Modified: `App.js` (only catalogue import/render and tab visibility), `src/services/propertyService.js` (adds Buyer list/detail queries; existing create/update API preserved).

Created: `src/screens/BrowseScreen.js`, `src/screens/FiltersScreen.js`, `src/screens/PropertyDetailsScreen.js`, `src/components/FilterChip.js`, `src/components/PropertyCard.js`, `src/navigation/BuyerNavigator.js`, `src/services/buyerFilters.js`, `src/styles/buyerTheme.js`, `tests/buyer-catalogue.mjs`, `assets/propertyIllustration.js`, `assets/property-illustration.md`, this report.

No dependency changes, schema migrations, account changes or modifications to database rows. No admin key, password or .env file included in Git.

## Supabase evidence

Existing HOLMIA project: `icfqjwfmcwlejqpezhyi`. Inspected live public schema, relationships and policies. `properties` uses `title`, `description`, `price`, `listing_type`, `property_type`, `location`, `image_url`, `status`, `seller_id`, `agent_id`, timestamps and UUID id. Seller/agent foreign keys reference profiles, whose id references Auth users. RLS enabled on both public tables.

Six persisted active properties: three sale, three rent, in Paris, Lyon, Lille, Bordeaux, Nantes and Toulouse. No extra seed needed. All six image_url values are null. A bundled stock photo is clearly labelled Illustrative photo; non-null image_url takes precedence. Failed image loads show a truthful fallback. Prices use £ as required by the references; the schema has no separate currency column.

Public SELECT policy allows only active listings; authenticated sellers/agents have separate owner/assignment policies. Every Buyer query also adds status=active. No RLS change or bypass.

`node --env-file=.env tests/buyer-catalogue.mjs`: **25 checks passed**, using only the project's publishable key and real HTTP requests. Covers live rows, search title/location and special characters, sale/rent, min/max/exact bounds, location, multiple property/listing types, Other/loft, combined and contradictory criteria, reset values, invalid price validation, all six detail UUIDs, inaccessible public profiles, denied listing insertion. The denied insert adds no row; no existing row was modified.

Limits: authenticated Buyer login, authenticated mutation policies and native session restoration were not tested (no test-account password provided). Existing policies were read, but a draft/sold fixture was not created just to test invisibility. All current records are active.

## Expo and execution evidence

| Check | Result |
| --- | --- |
| npm ci | Passed |
| Expo Doctor | 20/20 passed |
| Android, iOS and web Metro exports | Passed, including bundled illustration |
| ESLint on every changed JS/MJS file | Passed |
| Global npm run lint | Fails with 9 existing errors and 7 warnings in untouched Login/Agent/lifecycle/role/TS test files |
| npm run test:all | Both existing repository and session suites passed |
| Compiled web application in JSDOM | 12 interaction checks passed with real Supabase requests |
| Native device / Expo Go | Not executed; no attached phone/emulator |
| Browser screenshot/visual comparison | Not completed; browser cannot reach server, local Chromium fails to launch |

The 12 DOM checks exercised: full app mount → existing Catalogue tab → six live listings; rental details and monthly price; sale details; Sale; Rent; text search; empty results; invalid min/max; Apply with combined price/location/type/rent; reopening retains inputs; Reset + Apply restores six rows; no JavaScript runtime error. These execute the actual exported web bundle, not a mockup, but do not verify rendering or images visually.

No application screenshots are supplied. Original mockups are not presented as app screenshots. No phone-accessible QR code has been verified.

## Reference comparison — implementation-level only

References were recovered from HOLMIA_Maquettes_Reference.zip and visually inspected before implementation.

| Reference | Implemented structure | Verification remaining |
| --- | --- | --- |
| 03 Browse | Browse/Filters header, search 48 px, quick chips, bordered rounded cards, 110 px image, title/price/location/status/heart, four-label bottom navigation | Device typography, safe areas, final margins and image rendering |
| 04 Filters | Two price inputs, Location, four property chips, Sale/Rent, bottom Reset and red Apply; scroll/keyboard support | Device keyboard and bottom spacing |
| 05 Details | Back/title/heart, 190 px hero image, name/price/type/location/status/description, red transaction action, enquiry | Device layout and long-text rendering; Book viewing omitted because no existing implementation |

Shared Buyer colours: background #F6F5F0, primary #B6311E, text/border #2A2424; 32 px horizontal margins, thin borders, 8 px main radii. System font approximates reference. No global theme changes to teammates' screens. Pixel-perfect fidelity is NOT certified without device/browser visual checks.

## Run locally

On the intended checkout after applying the patch (or after publication):

```sh
npm ci
# Copy .env.example to .env and fill HOLMIA's existing URL and publishable key.
node --env-file=.env tests/buyer-catalogue.mjs
npx expo-doctor
npx expo export --platform all
npx expo start --go --lan
```

Open the Catalogue tab. Test both Sale and Rent details. For combined filters, choose Rent, Studio, Lille, £600–£1000: the existing Lille studio should remain. Reset then Apply restores all six listings. A native client compatible with the repository's SDK 58 must be verified on the phone; successful exports do not prove Expo Go runtime compatibility.

Review remains pending: keep the Buyer PR unmerged until reviewed, and attach real phone screenshots once available. The branch publication does not constitute a deployment to a phone or a production service.
