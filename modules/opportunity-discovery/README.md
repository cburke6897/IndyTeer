# IndyTeer Discover

An independent, working discovery and review module for real volunteer opportunities. It runs beside IndyTeer, with its own process, dependency lockfile, SQLite database and browser interface. It changes no main-app routes, packages, tables, migrations, Auth settings, background worker or existing records.

## Run

Requires Node **22.13+** (Node 26 also tested). Docker and Supabase CLI are unnecessary for discovery.

```powershell
cd modules/opportunity-discovery
npm ci --ignore-scripts
npm run collect
npm start
```

Open **http://127.0.0.1:5188**. On Windows, `Start-Discovery.ps1` installs missing dependencies and starts the module. Running it does not start or rebuild the main app.

No configuration is needed for the initial Indiana scan. The official `DEMO_KEY` is used for evaluation. For repeated use, get a free personal [NPS API key](https://www.nps.gov/subjects/developer/get-started.htm), copy `.env.example` to ignored `.env.local`, and set `NPS_API_KEY`. The key stays server-side.

The initial live verification on November 7, 2026 returned **55 explicit volunteer occurrences across four programs** in Indiana Dunes National Park. These are real source records, not 55 different organizations or fabricated activities. The queue excludes elapsed sessions as time passes. Counts are a dated observation, not a guarantee of ongoing availability.

## What works

- Manual collection, or opt-in automatic collection while the module is running. NPS defaults to every six hours; toggling it off stops future scheduled runs. The current bounded scan finishes without changing the main app.
- Official NPS event adapter, including bounded national/multi-state scans; approved RSS/Atom and HTML JSON-LD adapters for additional licensed/authorized sources.
- Explicit volunteer-event filtering, recurrence dates from the source, timezone/date validation, cancellation screening, same-day expiry, cross-source duplicate detection and factual completeness notes.
- Public-source attribution, exact event-detail links, original organizer/signup links and observation timestamps. Only limited event facts are stored; source descriptions, photos, personal contact fields and full pages are not retained.
- Independent navy/gold/white desktop/mobile discovery interface, search, review queue, dismiss, source status and scheduler controls.
- Owner/admin-only draft import using normal Supabase Auth and existing RLS. Capacity, local details and organizer authorization must be confirmed; unknown fields are never invented.
- Durable import journal. A confirmed import is reused; an ambiguous timeout blocks retries until read-only reconciliation finds a unique source marker. This prevents a network failure from quietly creating duplicates.
- Source changes/missing listings flag imported records for rechecking. Existing app drafts are never automatically overwritten, unpublished or deleted.

The classification/completeness score uses deterministic rules. It is not a verification of organizer identity, available places, safety, permission or source truth. Source contradictions are flagged for human review.

## Connect the main app without modifying it

Set the following in this module's **ignored `.env.local`**:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_BROWSER_SAFE_KEY
DISCOVERY_ENABLE_IMPORTS=true
```

Restart this module. Choose **Connect account**, sign in with an existing IndyTeer account, select a listing, and choose an organization where you have an active owner/admin membership. Confirm the date, times, timezone, city, venue and organizer-confirmed capacity. Confirm your authority to manage that organizer's opportunity, then **Import as draft**.

The browser sends the password directly to Supabase Auth, not to this module's HTTP server. Tokens remain in tab memory and are never written to SQLite, files, cookies or browser storage. Import audit records retain the acting Auth UUID and organization ID. Disconnecting forgets this tab's tokens and does not log out the main app.

An external listing does **not** establish a partnership. Ordinary users can browse and follow its original signup link without importing. Do not create an NPS organization you do not represent or select an unrelated organization just to fill the app. The main app's internal registration is appropriate only after the actual organizer authorizes management there.

The bridge creates one row in `public.opportunities` through the signed-in person's existing permissions. It omits `id` and `status` to match main's column-level grants and draft default; it records provenance in `instructions`. No service-role key, new schema, fake Auth identity, platform admin, automatic publication, registration, attendance or hours verification is used. Review/publish inside the main organization's existing workspace.

Unknown outcomes remain blocked. **Reconcile** only reads matching source markers and adopts a unique confirmed result. If no unique result exists, inspect the organization's drafts with the backend owner; there is intentionally no automatic “force retry.” Keep the local SQLite/import journal when moving the service. Losing that journal can weaken cross-organization/concurrent-process deduplication; the source marker still supports same-organization recovery.

## Source coverage and permission

“Publicly readable” does not mean “licensed for unrestricted crawling.” This implementation uses an extendable approved source registry, not indiscriminate whole-web scraping. It currently ships **one enabled live provider: NPS**, offering US-wide coverage. Other platforms are not silently scraped.

Each source in `sources.json` needs its adapter, exact HTTPS URL, permission basis/evidence and a review date no older than 180 days. Generic feeds/pages require an open reuse license or written permission; a robots allow-rule is insufficient. Disabled examples in `sources.example.json` are configuration templates, not evidence of actual permission.

| Source                                             | Implemented                         | Enabled by default | Permission handling                                                        |
| -------------------------------------------------- | ----------------------------------- | ------------------ | -------------------------------------------------------------------------- |
| NPS official events API                            | Yes; tested with live Indiana data  | Yes                | Official external-use API; government facts only, attribution retained     |
| Authorized partner RSS/Atom                        | Yes; parser/network policies tested | No                 | Maintainer supplies reviewed license/permission; robots enforced           |
| Authorized partner HTML JSON-LD Event pages        | Yes; parser/network policies tested | No                 | Same permission requirement; no login/CAPTCHA bypass or arbitrary browsing |
| Volunteer platforms/search engines/social networks | No live connector                   | No                 | Review their API agreements and permissions before adding an adapter       |

For more NPS coverage, set `DISCOVERY_STATES=IN,IL,OH` or `DISCOVERY_STATES=ALL`. Default horizon is 30 days (maximum 90). A national scan is **bounded**, not an exhaustive national index: NPS defaults to four pages of 50 event definitions, at most eight pages and 1,000 saved occurrences per source/run. Page caps are reported; truncated/national scans do not withdraw unseen records. Unknown timezones remain blank; only Indiana Dunes' independently checked Central Time mapping is currently supplied. Explicit cities/states are extracted from source addresses when available.

To add a partner, copy the disabled template, replace its evidence with genuine reviewed permission, select `adapter: "feed"` or `"jsonld"`, set its state/timezone, then enable it. `pages` can list additional approved pages on the **same origin**; at most ten are fetched. RSS publication dates are never interpreted as event dates. A source without event times/dates can enter review but cannot import without confirmed facts.

## Collection limits and security

Requests identify `IndyTeerDiscovery/0.1`; set `DISCOVERY_CONTACT` to an operator contact when adding web sources. Defaults are serial, at least two seconds apart. Generic web sources check robots.txt (404 permits, 401/403/5xx/unknown fails closed), honor supported crawl delays and refuse delays beyond the bounded run budget. Redirects are not followed: review/update the source URL instead. HTTP 429 pauses the host for at least the requested interval/one hour; no immediate retry or proxy rotation is attempted.

Each run has a two-minute request-start budget, with bounded DNS/request completion. Responses are capped at 2 MB, requests at 15 seconds, DNS at four seconds. DNS is checked on every request and pinned into the connection; private/reserved/mixed answers, IP-literal URLs, non-HTTPS, custom ports, credentials and off-origin targets are blocked. Credentials use request headers, not URLs. The NPS documented API uses its API-use policy rather than the web-page crawler robots path.

SQLite leases prevent concurrent collectors. Per-source intervals persist across restarts; the default minimum is 15 minutes even if configured lower. The last 100 run records are retained. Unimported, unreferenced candidates not seen for 90 days are pruned; import provenance remains. Local data lives in ignored `data/` and does not belong in Git.

The UI binds **127.0.0.1 only**. Host/origin validation, a per-process mutation token and CSP protect its local controls. This is a trusted-operator sidecar, not a publicly exposed multi-tenant admin service. To run continuously, use a separate trusted machine/service and an SSH tunnel to loopback, or add a separately reviewed authenticated deployment layer. Do not expose this local reviewer directly to the internet. Main stays usable if discovery is stopped or unavailable.

## Tests and verification boundary

```powershell
npm test
npm run test:e2e
npm audit --audit-level=moderate
npm run export
```

23 automated unit/integration tests cover source permission, NPS pagination, recurrence/cancellation, missing facts, stale review, XSS/unsafe links, SSRF/DNS/redirects, robots/429, duplicate leases, draft-only authorization, timeout ambiguity, local origin/CSRF and source changes. Three browser tests cover mobile/search, authorized review/import, original attribution, scheduler pause/dismiss and token non-persistence. Browser import tests use intercepted Auth and a test-only in-memory backend; they do not create production records. Windows uses installed Edge; Linux/macOS require `npx playwright install chromium`.

Live NPS fetching and desktop/mobile rendering were separately verified. **No live Supabase row was imported, changed or deleted for this module.** The main app's unrelated build issues are left to teammates, as requested. The collector and reviewer tests run independently of the root app.

## Primary references

- [NPS API external use](https://www.nps.gov/subjects/digital/nps-data-api.htm), [API authentication/rate limits](https://www.nps.gov/subjects/developer/guides.htm), [official event schema](https://www.nps.gov/subjects/developer/customcf/swagger.json).
- [NPS disclaimer and contributed-material restrictions](https://www.nps.gov/aboutus/disclaimer.htm), [copyright and permissions](https://www.nps.gov/aboutus/publications.htm).
- [api.data.gov DEMO_KEY limits](https://api.data.gov/docs/developer-manual/): 30 requests/hour and 50/day per IP at time of review. A personal NPS key is recommended for regular operation.
- [Indiana Dunes official Central Time information](https://www.nps.gov/indu/planyourvisit/basicinfo.htm), [official volunteering page](https://www.nps.gov/indu/getinvolved/drop-in-volunteering.htm).
- [robots-parser documentation](https://github.com/samclarke/robots-parser).

Source permission is an operational review record, not a blanket legal guarantee. Recheck changes in terms and third-party rights before enabling or expanding a source.
