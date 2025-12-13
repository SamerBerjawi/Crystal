# Enable Banking Integration Notes

This document summarizes the workflow and requirements for integrating Enable Banking, based on the reference implementation in `we-promise/sure`.

## High-level flow
1. Obtain application credentials (application ID and private key PEM).
2. Generate a JWT (RS256) with `kid=application_id` and use it for Authorization headers.
3. Start an authorization with `/auth` specifying the bank (ASPSP), redirect URL, and state.
4. Handle the callback containing an authorization code and exchange it for a session via `/sessions`.
5. Persist the session (ID, expiration, accounts) and schedule background sync jobs.
6. During sync, fetch session details, balances, and paginated transactions; deduplicate by `transaction_id` or `entry_reference`.
7. Let users map provider accounts to internal accounts (or link to existing accounts) and select a sync start date.
8. Revoke or reauthorize sessions as needed when they expire or become unauthorized.

## API endpoints used
- `GET /aspsps?country=XX` — list available banks for a country.
- `POST /auth` — start authorization and receive redirect URL plus `authorization_id`.
- `POST /sessions` — exchange authorization code for a `session_id` and account list.
- `GET /sessions/{session_id}` — fetch session snapshot (accounts, access info).
- `DELETE /sessions/{session_id}` — revoke a session/consent.
- `GET /accounts/{account_id}/balances` — retrieve balances; prefer `closingBooked`, then `expected`, otherwise first entry.
- `GET /accounts/{account_id}/transactions?transaction_status=BOOK&date_from=...&continuation_key=...` — fetch transactions with pagination via `continuation_key`.

## Data handling and robustness
- Sessions may list accounts as strings (UIDs) or objects; handle both and prefer `identification_hash` as a stable identifier.
- Guard pagination with a maximum page count (e.g., 100) and break on repeated `continuation_key` to avoid loops.
- Deduplicate transactions using `transaction_id` or `entry_reference` before storing.
- Choose a sync start date per linked account; default the first sync to an early date but allow the user to pick a later start when linking existing accounts.
- Mark sessions as requiring reauthorization on `401/404` responses; prompt the user to restart authorization.
- Validate redirect URLs against a trusted host allowlist and require HTTPS to prevent open redirect issues.

## Account linking
- Store provider accounts separately (e.g., `EnableBankingAccount`) with raw payloads, balances, and transaction snapshots.
- Link provider accounts to internal accounts via a join (e.g., `AccountProvider`).
- Support two flows:
  - **Create new accounts** from provider data (name, currency, balance, account type/subtype chosen by user).
  - **Link to existing accounts** and ask the user to choose the sync start date before importing transactions.
- After linking, run a sync to process balances and transactions into the selected internal accounts.

## Security and storage
- Parse the PEM client certificate to extract the RSA private key for signing JWTs; raise errors on invalid certificates.
- Keep sensitive fields (client certificate, session ID) encrypted at rest (e.g., ActiveRecord encryption).
- Regenerate JWTs per request with short expiry (1 hour) using `iss=enablebanking.com` and `aud=api.enablebanking.com`.

## Background jobs
- Run imports in background workers: fetch session snapshot, upsert account data, retrieve balances and transactions, and persist results.
- Implement rate-limit handling and retries around HTTP calls; map common HTTP statuses to typed errors for clearer remediation.
