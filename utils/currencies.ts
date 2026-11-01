/** Every active ISO 4217 currency, plus BTC. Intl's own list also holds retired ones like DEM. */
const ISO_CODES = `AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWG`.split(' ');

export const CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'BTC', ...ISO_CODES.filter(code => !['EUR', 'USD', 'GBP'].includes(code))];

/** Where Intl's narrow symbol would be ambiguous or absent. */
const SYMBOL_OVERRIDES: Record<string, string> = { BTC: '₿', RON: 'lei', CAD: 'C$', AUD: 'A$', NZD: 'NZ$', CHF: 'CHF', HKD: 'HK$', SGD: 'S$', MXN: 'MX$' };

const BTC_DIGITS = 8;
const DEFAULT_DIGITS = 2;

const symbols = new Map<string, string>();
const digits = new Map<string, number>();

export const currencySymbol = (code: string): string => {
  const known = SYMBOL_OVERRIDES[code] ?? symbols.get(code);
  if (known) return known;
  let symbol = code;
  try {
    symbol = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find(part => part.type === 'currency')?.value ?? code;
  } catch { /* an unknown code shows as itself */ }
  symbols.set(code, symbol);
  return symbol;
};

/** JPY has none, KWD has three. */
export const currencyDigits = (code: string): number => {
  if (code === 'BTC') return BTC_DIGITS;
  const known = digits.get(code);
  if (known !== undefined) return known;
  let count = DEFAULT_DIGITS;
  try {
    count = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? DEFAULT_DIGITS;
  } catch { /* an unknown code gets two */ }
  digits.set(code, count);
  return count;
};

export const currencyName = (code: string): string => {
  if (code === 'BTC') return 'Bitcoin';
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
};

/** Picker rows, with the name to search by. */
export const currencyOptions = () => CURRENCY_CODES.map(code => ({ id: code, label: `${code} ${currencyName(code)}`, description: currencySymbol(code) }));

/** The form a main currency is saved in, such as "EUR (€)". */
export const currencyPreference = (code: string) => `${code} (${currencySymbol(code)})`;

/** Every currency your data uses, from any list of records that carry one. */
export const currenciesInUse = (...lists: { currency?: string | null }[][]): string[] => {
  const found = new Set<string>();
  lists.forEach(list => list.forEach(item => { if (item.currency) found.add(item.currency.trim().split(/[\s(]/)[0].toUpperCase()); }));
  return [...found].sort();
};
