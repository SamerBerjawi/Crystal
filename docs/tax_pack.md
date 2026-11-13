# Tax pack

Reports → Tax pack gathers a tax year in one place: income, investment income, spending in deductible categories, investment sales, a checklist of the documents your country asks for, and the documents themselves. **Download pack** gives a zip with CSV summaries and every document attached for the year.

It is a guide to the paperwork, worked out from your own records. It is not tax advice or a return. Rules depend on your country and situation.

## Country

The country is read from the **city in Settings → Profile** (for example "Brussels" or "Springfield, Belgium"). Choose another country on the page to see its requirements instead; the choice is saved and overrides the city. Countries are listed in `utils/taxCountries.ts`; "Other country" gives a general checklist. Some countries use a tax year that is not the calendar year (the UK runs 6 April to 5 April, Australia 1 July to 30 June).

## What is counted

- **Income** and **investment income** (dividends, interest, coupons, found by category or description) from income transactions in the tax year. Transfers, split and combined parents, balance and market adjustments are left out.
- **Deductible spending** is spending whose category matches the country's usual deductions (for example childcare, donations, medical). Check it against the rules before relying on it.
- **Investment sales** are sells in the year, with the gain by average cost. Your country may use another method.
- Amounts are in your main currency at today's rates.

## Documents

Documents (PDF, PNG, JPG, WebP, text) are stored **encrypted on the server's disk**, not in the database or the JSON data. Each file is encrypted with AES-256-GCM using a key derived from the server's secret, and bound to your user and the document, so a file cannot be swapped for another.

| Variable | Default | Meaning |
| --- | --- | --- |
| `TAX_DOCS_DIR` | `config/tax-docs` | Where the encrypted files are written. Must be on a persistent volume. |
| `TAX_DOC_MAX_MB` | `10` | Largest single file. |
| `TAX_DOC_USER_MAX_MB` | `500` | Total per user. |

Back up the documents folder together with the database, and keep the server secret: without it the files cannot be decrypted. The folder is not part of Crystal's JSON backup.
