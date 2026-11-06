import type { Account } from '../types';

/** Well-known banks and brokers, by what their name contains, so a logo can be found without a website being typed in. */
const KNOWN_INSTITUTIONS: [RegExp, string][] = [
  [/\bkbc\b/i, 'kbc.be'], [/\bcbc\b/i, 'cbc.be'], [/belfius/i, 'belfius.be'], [/argenta/i, 'argenta.be'], [/bnp\s*paribas\s*fortis|\bfortis\b/i, 'bnpparibasfortis.be'],
  [/bnp\s*paribas/i, 'bnpparibas.com'], [/\bing\b/i, 'ing.com'], [/revolut/i, 'revolut.com'], [/pluxee|sodexo/i, 'pluxee.com'], [/edenred/i, 'edenred.com'],
  [/\bwise\b|transferwise/i, 'wise.com'], [/\bn26\b/i, 'n26.com'], [/bunq/i, 'bunq.com'], [/monzo/i, 'monzo.com'], [/starling/i, 'starlingbank.com'],
  [/paypal/i, 'paypal.com'], [/chase/i, 'chase.com'], [/bank of america|bofa/i, 'bankofamerica.com'], [/wells\s*fargo/i, 'wellsfargo.com'], [/citi(bank)?\b/i, 'citi.com'],
  [/capital\s*one/i, 'capitalone.com'], [/american express|\bamex\b/i, 'americanexpress.com'], [/\bhsbc\b/i, 'hsbc.com'], [/barclays/i, 'barclays.co.uk'],
  [/lloyds/i, 'lloydsbank.com'], [/natwest/i, 'natwest.com'], [/santander/i, 'santander.com'], [/\bbbva\b/i, 'bbva.com'], [/abn\s*amro/i, 'abnamro.nl'],
  [/rabobank/i, 'rabobank.nl'], [/deutsche bank/i, 'db.com'], [/commerzbank/i, 'commerzbank.de'], [/\bdkb\b/i, 'dkb.de'], [/postfinance/i, 'postfinance.ch'],
  [/\bubs\b/i, 'ubs.com'], [/credit suisse/i, 'credit-suisse.com'], [/degiro/i, 'degiro.com'], [/interactive brokers|\bibkr\b/i, 'interactivebrokers.com'],
  [/trade republic/i, 'traderepublic.com'], [/scalable/i, 'scalable.capital'], [/fidelity/i, 'fidelity.com'], [/vanguard/i, 'vanguard.com'], [/schwab/i, 'schwab.com'],
  [/binance/i, 'binance.com'], [/coinbase/i, 'coinbase.com'], [/kraken/i, 'kraken.com'], [/ledger/i, 'ledger.com'],
];

export const hostOf = (website?: string): string | undefined => {
  if (!website?.trim()) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`).hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
};

/** The domain to look a logo up by: the account's website, else a well-known bank matched from its name. */
export const institutionDomain = (account: Pick<Account, 'website' | 'financialInstitution' | 'name'>): string | undefined => {
  const fromWebsite = hostOf(account.website);
  if (fromWebsite) return fromWebsite;
  const haystack = `${account.financialInstitution ?? ''} ${account.name ?? ''}`;
  return KNOWN_INSTITUTIONS.find(([pattern]) => pattern.test(haystack))?.[1];
};
