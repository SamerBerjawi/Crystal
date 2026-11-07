# Enable Banking integration

How Crystal connects to banks through [Enable Banking](https://enablebanking.com/docs) (PSD2 account information). This describes what the code does today. Where Enable Banking's own guidance shaped a decision, the source is noted.

| Part | File |
| --- | --- |
| Backend proxy and routes | `server/src/enableBanking.ts` |
| Error codes, rate-limit and PSU header handling | `server/src/ebErrors.ts` |
| Callback URL, sign-in method, credentials, `psu_id` | `server/src/ebRedirect.ts`, `server/src/ebAuthOptions.ts` |
| Encrypted key storage | `server/src/ebCredentials.ts` |
| Sync orchestration | `App.tsx` (`handleSyncEnableBankingConnection`) |
| Callback page | `pages/EnableBankingCallback.tsx` |
| Mapping, balances, account matching, merchants | `utils/enableBankingMapper.ts` |
| Consent expiry, bank coverage notes | `utils/consentExpiry.ts`, `utils/bankCoverage.ts` |
| UI | `components/BankConnectDialog.tsx`, `BankConnectionCard.tsx`, `BankLinkDialog.tsx`, `EnableBankingIntegrationCard.tsx` |

## Credentials and signing

- The user creates an application in the Enable Banking control panel and gets an **application ID** and a **private key (PEM)**.
- The key is sent to the server once, stored **encrypted** in `enable_banking_credentials`, and never returned to the browser or kept in the data blob. Later requests send only the application ID.
- Every bank request carries a JWT signed with RS256: header `kid = application ID`; claims `iss = enablebanking.com`, `aud = api.enablebanking.com`, `iat`, `exp = now + 1 h` (the API allows up to 24 h). Tokens are cached per application and key hash and reused until a minute before expiry.
- A key is only saved after Enable Banking accepts it (the first `/aspsps` or `/auth` call that succeeds).

## Connecting a bank

1. **Find banks.** `POST /api/enable-banking/aspsps` returns the bank list for a country. Crystal keeps, per bank: `maximum_consent_validity`, supported `psu_types`, `auth_methods` (with their credential fields), the `beta` flag and `required_psu_headers`.
2. **Choose.** The dialog asks for account holder type (personal or business) when the bank offers both, a sign-in method when the bank has more than one visible method, and optional login credentials for that method. Credentials are forwarded once and never stored.
3. **Authorize.** `POST /api/enable-banking/authorize` calls `POST /auth` with `access` (balances and transactions, `valid_until` = the shorter of 180 days and the bank's maximum minus a minute), `aspsp`, `psu_type`, `redirect_url`, `state`, and optionally `auth_method`, `credentials` and `psu_id`. The browser is redirected to `url`.
   - `state` is the connection id (`eb-<uuid>`). The pending connection is saved to the user's data under `enableBankingPendingConnections` before the redirect, with a single atomic statement that cannot overwrite a concurrent save.
   - `psu_id` is an anonymous digest of the Crystal user id, so Enable Banking can match sessions of the same person.
   - The callback URL is `ENABLE_BANKING_REDIRECT_URL` when set. Otherwise it is built from the request host, which must look like a plain `host[:port]` with an `http`/`https` scheme; anything else is a 400. **Set `ENABLE_BANKING_REDIRECT_URL` in production** and register the same URL in the control panel.
4. **Callback.** The bank sends the user to `/enable-banking/callback?code=…&state=…` (or `error` and `error_description`). The page exchanges the single-use code once (`POST /sessions`), stores `session_id` and `access.valid_until`, revokes the previous session if this was a reconnect, then runs a first sync. If the saved connections have not loaded yet, it waits a few seconds before reporting a missing connection.

## Sessions and consent expiry

- A session ends at `valid_until`. Re-authorizing creates a **new session and new account ids**; accounts are re-matched (see below).
- Crystal warns before the end: a banner on the bank card and a toast once per browser session at 14 days, 7 days, the last day, and after expiry.
- Reconnecting revokes the old session (`DELETE /sessions/{id}`), which also asks the bank to close the consent. Deleting a connection does the same.

## Syncing

`Sync` fetches the session, then for each account (at most two at a time, to stay inside bank rate limits) its details when needed, balances and transactions.

- **Accounts** come from the session. Crystal stores the bank's `cash_account_type` (current, savings, card, loan) and suggests the matching Crystal account type when linking.
- **Identity.** Account ids change between sessions, so accounts are matched by `uid`, then `identification_hash`, then IBAN.
- **Balance.** Preference order: `CLBD`, `XPCD`, `ITAV`, `ITBD`, `FWAV`, `OPBD`, then the first entry.
- **Transactions.** Booked (`BOOK`) only, paged with `continuation_key` (capped at 100 pages; a repeated key stops the loop). The first sync uses `strategy=longest`, later ones `default` with a 5-day lookback before the last sync. If the page cap is hit, the checkpoint is not advanced and a warning is shown.
- **Transaction ids** are built from `entry_reference` (stable across retrievals and sessions), falling back to `transaction_id`, `end_to_end_id`, and finally a hash of the fields. `transaction_id` can change between fetches and is not used when `entry_reference` exists. Rows imported before this rule keep their original id. Deduplication also checks a field fingerprint for transactions with no bank id, and honours transactions you deleted.
- **Merchants and categories.** Merchant names come from structured counterparty fields first, then card-text templates, then a known-brand list. Wallet wording ("Apple Pay", "Google Pay") is removed first, so a tap-to-pay purchase is not attributed to Apple or Google. Categories come from the brand, the merchant category code, or a transfer match against your other accounts.
- Edits you make to a synced transaction's merchant or description are locked; a later sync does not overwrite them.

## PSU headers and rate limits

- Banks allow only a few unattended fetches a day (often about four), but fetches the user triggers carry PSU context headers and are usually exempt. Crystal only syncs when the user asks, and sends the browser's context.
- `required_psu_headers` from `/aspsps` is stored on the connection. The server sends **every required header it can supply or none**, because a partial set fails with `PSU_HEADER_NOT_PROVIDED`. It can supply `Psu-Ip-Address`, `Psu-User-Agent`, `Psu-Accept`, `Psu-Accept-Charset`, `Psu-Accept-Encoding`, `Psu-Accept-Language` and `Psu-Referer`; it cannot supply `Psu-Geo-Location`. With no list, it sends the IP address and user agent together (and nothing on loopback).
- On `ASPSP_RATE_LIMIT_EXCEEDED` (HTTP 429) the user is told to wait about six hours, and "Sync all" skips that bank until then (kept in memory, so a page reload resets it).

## Errors

The server reads the error code from the Enable Banking response and never passes upstream bodies to the browser.

| Code | Meaning in Crystal |
| --- | --- |
| `EXPIRED_SESSION`, `CLOSED_SESSION`, `REVOKED_SESSION`, `SESSION_DOES_NOT_EXIST`, `WRONG_SESSION_STATUS` | Session unusable: connection becomes "Needs reconnecting". |
| `ASPSP_RATE_LIMIT_EXCEEDED` | Rate limited: wait; do not reconnect. |
| `UNAUTHORIZED_ACCESS`, `UNAUTHORIZED_IP` | Application key or allowed IP problem: not a bank reconnect. |
| `PSU_HEADER_NOT_PROVIDED`, `PSU_HEADER_INVALID` | Bank wants device context the server could not send. |
| `WRONG_TRANSACTIONS_PERIOD`, `DATE_FROM_IN_FUTURE`, `WRONG_DATE_INTERVAL` | Choose a later sync start date. |
| `ASPSP_ACCOUNT_NOT_ACCESSIBLE`, `ACCOUNT_DOES_NOT_EXIST`, `ASPSP_TIMEOUT`, `ASPSP_PSU_ACTION_REQUIRED` | Reported with a specific message; the connection stays. |

HTTP 401 alone is never treated as an expired session, since it also covers a bad application key.

## What banks share

A bank only exposes the accounts its PSD2 interface covers. **KBC, KBC Brussels and CBC do not share credit card accounts**, so Crystal shows a note on those connections; add such a card as a manual account. Whether savings accounts appear depends on the bank. Whatever the bank returns is synced and labelled by type.

## Not implemented

- **Pending transactions** (`PDNG`) are not fetched; a payment appears once it books.
- **Payments and webhooks.** Crystal only reads account information. The one documented webhook is for payment status, so it does not apply.
- **Background sync.** There is no scheduled job; syncs are user-triggered.
- **Balance choice per account.** The balance type is picked by the fixed order above.

## Testing

Pure logic is covered by `tests/unit/enableBankingMapper.test.ts`, `consentExpiry.test.ts`, `concurrency.test.ts`, `lockedFields.test.ts` and `server/src/eb*.test.ts`. Run with `npx tsx --test <file>`. There are no automated tests against a live bank; use Enable Banking's sandbox applications for that.
