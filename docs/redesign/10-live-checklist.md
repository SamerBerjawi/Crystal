# Live checklist

These are the things only a real install can prove: a real server, real Postgres, a real bank and real keys. They can't be tested in the demo or the mock.

It covers `main` as merged through Module 11, plus Module 12 once PR #304 is merged. Work from the top, because later checks depend on earlier ones. Tick each box, and note anything odd in **What to send back** at the end.

## 1. Before you update

- [ ] Note the image you're running now, so you can go back to it.
  - Docker Compose: `docker compose images`
  - Umbrel: `crystal/docker-compose.yml` pins an image by digest, so Umbrel won't update until that digest changes.
- [ ] In the version you're on now, download a full JSON backup. In the old layout it's under **Data Management, System Snapshots, Backup**. In the new one it's **Settings, Data, Back up**. Keep this file. It's your way back.
- [ ] Also back up the database:

```bash
docker compose exec db pg_dump -U crystal_user crystal > crystal-before-redesign.sql
```

- [ ] Check the dump isn't empty.
- [ ] Merge PR #304 first if you want currency checked in the same pass.

## 2. Update

```bash
docker compose pull
```

```bash
docker compose up -d
```

- [ ] The backend starts. Check with `docker compose logs backend`, and look for "Database tables are ready."
- [ ] The three lock columns exist:

```bash
docker compose exec db psql -U crystal_user crystal -c "\d user_sessions" -c "\d users"
```

Expect `locked_at` and `pin_failures` on `user_sessions`, and `pin_hash` on `users`.

- [ ] Sign in. Your data is all there, and nothing looks empty.
- [ ] The browser console shows no red errors on the Overview.

## 3. Rules migration (D-105)

This changes saved data, so check it before you edit anything.

- [ ] **Transactions, Rules**: under Always file, your merchant categories appear as sentences, such as "Always file Colruyt under Groceries".
- [ ] Count them against what you expect. Every merchant that had a category or default description should be there.
- [ ] Your old regex rules appear under Your rules, with the same patterns, below your other rules.
- [ ] Your existing transaction rules are all still there, in the same order.
- [ ] **Merchants**: pick three merchants. Logo, notes and location are unchanged, and the category still shows.
- [ ] **Add a transaction** for a merchant with an Always file rule. Its category fills in, and so does its description if it has one.
- [ ] **Rules, Advanced, Preview and apply**: read the list before applying anything. It should be short and make sense. A long list means something moved wrongly, so stop and send it to me.
- [ ] Change anything small, such as a preference, then reload. The rules are still there. This confirms the move was saved, because loading alone doesn't save it.
- [ ] Open a second device or browser. The rules are the same.

## 4. PIN lock (D-107, D-108)

- [ ] **Profile, Security, Set a PIN**. A wrong password is refused. The right one saves it.
- [ ] Make a small change, then press `L` straight away. The lock screen appears.
- [ ] Reload. It stays locked.
- [ ] In the browser's dev tools, the Network tab shows `/api/data` answering 423.
- [ ] Unlock with the right PIN. Your data is back, including that last change.
- [ ] A wrong PIN says how many tries are left.
- [ ] In the Network tab, `/api/data` answers with `Cache-Control: no-store`.
- [ ] Open a second tab, then lock in the first. The second tab should follow.
- [ ] Lock, then choose **Sign out instead**, and sign in with your password. You get in, and the PIN is unchanged.
- [ ] Five wrong PINs sign you out. Use a session you don't mind losing.
- [ ] Set Auto-lock to 5 minutes and leave it. It locks.
- [ ] Close a laptop for longer than the auto-lock time, then open it. It locks.
- [ ] Set Auto-lock back to what you want.

## 5. Bank sync

- [ ] **Connections**: your banks show the right status and dates.
- [ ] Sync one bank with **New transactions only**. No duplicates appear.
- [ ] A new transaction from a merchant with an Always file rule gets its category. This is the first proof that rules run on bank records in real use.
- [ ] A round-up on a new bank transaction is created, if you use them.
- [ ] Sync from an account page works too.
- [ ] If a bank needs it, **Reconnect** works, and you come back to Crystal afterwards.
- [ ] Linking a new account with **Link** works.

## 6. Prices and rates

- [ ] With a Twelve Data key saved, **Investments, Update prices** works.
- [ ] A USD holding's quote converts properly into its own currency.
- [ ] A web page price source still works. Note that these settings are per browser for now.

After #304:

- [ ] **Preferences, Exchange rates** says "From the European Central Bank and Twelve Data" with today's date.
- [ ] In the browser console, there's no Content Security Policy report for `api.frankfurter.dev`.
- [ ] Switch the main currency to USD. Net worth changes by the rate shown, and a transaction in USD shows its exact amount.
- [ ] Switch back. The figures return exactly.

## 7. Sync across devices

- [ ] Ignore a subscription on one device. It stays ignored on another.
- [ ] Dismiss a bill notification on one device. It's gone on another.

## If something goes wrong

Stop, and don't apply rules or edit data.

1. Go back to the image you noted in step 1. In Docker Compose, set that tag on `backend` and `frontend`, then run `docker compose up -d`.
2. **Your data needs restoring too**, because older versions read merchant categories from where they used to be. Restore the backup from step 1: **Data page, Restore, Replace all**.
3. The three lock columns can stay. Older versions ignore them.

If the app won't start at all, restore the SQL dump from step 1. Ask me first, because that replaces everything saved since.

## What to send back

- Anything that failed, with its step number.
- For a failure on the server: the output of `docker compose logs backend --tail 50`. Remove any personal details first.
- The number of Always file rules you expected and the number you got.
- How long Preview and apply's list was.

Don't paste passwords, PINs, API keys or bank credentials.
