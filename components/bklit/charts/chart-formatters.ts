export const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const weekdayDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export const hmsTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// `Intl.NumberFormat.prototype.format` is a bound getter — safe to extract.
export const intFmt = new Intl.NumberFormat("en-US").format;
export const valueLabelFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
}).format;

/**
 * Returns an array of labels evaluated on demand or pre-generated.
 */
export function lazyLabels(
  length: number,
  getLabel: (index: number) => string
): string[] {
  return Array.from({ length }, (_, i) => getLabel(i));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Converts a data key or label (camelCase, snake_case, kebab-case, or lower case)
 * into human-readable Proper Case / Title Case (e.g. "netWorth" -> "Net Worth", "balance" -> "Balance").
 * Preserves uppercase acronyms and abbreviations (e.g. "USD", "EUR", "LTV", "APY").
 */
export function toProperCase(str: string): string {
  if (!str || typeof str !== "string") return str;
  const withSpaces = str
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .trim();

  return withSpaces
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";
      if (word.length > 1 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const symbolMap: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  BTC: "BTC",
  RON: "lei",
};

/**
 * Splits a currency amount into split-weight components matching the application's
 * standard money styling (§1.2 rule 1):
 * - sign: "" or "-"
 * - symbol: currency symbol (e.g. "€", "$", "£")
 * - digits: whole integer portion (e.g. "1,234")
 * - fraction: decimal portion (e.g. ".50")
 * - rest: suffix or currency code when applicable
 */
export function formatCurrencyAmount(
  amount: number,
  currency: string = "EUR"
): { sign: string; symbol: string; digits: string; fraction: string; rest: string } {
  const cleanCurrency = currency.split(" ")[0] || "EUR";
  if (cleanCurrency === "BTC") {
    const formatted = `${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    })} BTC`;
    return { sign: "", symbol: "", digits: formatted, fraction: "", rest: "" };
  }

  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sign = amount < 0 ? "-" : "";
  const symbol = symbolMap[cleanCurrency] || cleanCurrency;
  const absFormatted = formatter.format(Math.abs(amount));
  const dotIndex = absFormatted.lastIndexOf(".");
  if (dotIndex !== -1) {
    return {
      sign,
      symbol,
      digits: absFormatted.slice(0, dotIndex),
      fraction: absFormatted.slice(dotIndex),
      rest: "",
    };
  }

  return {
    sign,
    symbol,
    digits: absFormatted,
    fraction: "",
    rest: "",
  };
}

/**
 * Tooltip value for a `<Band>` row: `"low – high"` (ordered), the value itself
 * when both edges read the same key, or `null` when either edge is missing
 * (e.g. Bollinger warm-up rows).
 */
export function formatBandRange(
  point: Record<string, unknown>,
  upperKey: string,
  lowerKey: string,
  format: (value: number) => string = intFmt
): string | number | null {
  const upper = point[upperKey];
  const lower = point[lowerKey];
  if (!(isFiniteNumber(upper) && isFiniteNumber(lower))) {
    return null;
  }
  if (upperKey === lowerKey) {
    return upper;
  }
  return `${format(Math.min(lower, upper))} – ${format(Math.max(lower, upper))}`;
}
