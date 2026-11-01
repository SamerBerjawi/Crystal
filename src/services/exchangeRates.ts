const ECB_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR';
const TIMEOUT_MS = 10_000;

/**
 * European Central Bank rates through Frankfurter, which needs no key. Rates are the value in EUR of one unit, to match
 * Crystal's table. Only the request itself leaves the browser, and it holds no account data.
 */
export const fetchEcbRates = async (): Promise<Record<string, number>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ECB_URL, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new Error(`Frankfurter error: ${response.status}`);
    return ecbRatesFrom(await response.json());
  } finally {
    clearTimeout(timer);
  }
};

export const ecbRatesFrom = (payload: { rates?: Record<string, number> }): Record<string, number> => {
  const rates: Record<string, number> = { EUR: 1 };
  Object.entries(payload.rates ?? {}).forEach(([code, perEuro]) => {
    if (Number.isFinite(perEuro) && perEuro > 0) rates[code] = 1 / perEuro;
  });
  return rates;
};
