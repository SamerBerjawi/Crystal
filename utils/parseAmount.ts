/**
 * Parses a human-formatted number from a CSV cell. Handles:
 *   "1234.56", "-12,50", "1.234,56", "1,234.56", "1 234,56", "1'234.56", "(45.10)", "€ 12,50", "12.50-".
 * The last separator that is followed by 1-2 digits (or 3 digits with the other separator present) is the decimal mark.
 * Returns NaN when the cell is not a number.
 */
export function parseAmount(raw: unknown): number {
    if (typeof raw === 'number') return raw;
    let s = String(raw ?? '').trim();
    if (!s) return NaN;

    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    if (/-\s*$/.test(s)) { negative = true; s = s.replace(/-\s*$/, ''); }
    if (/^[-−–]/.test(s)) { negative = true; s = s.replace(/^[-−–]\s*/, ''); }

    s = s.replace(/[^\d.,'\s]/g, '').replace(/[\s']/g, '');
    if (!/\d/.test(s)) return NaN;

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    let decimalMark: '.' | ',' | null = null;

    if (lastDot > -1 && lastComma > -1) {
        decimalMark = lastDot > lastComma ? '.' : ',';
    } else if (lastDot > -1 || lastComma > -1) {
        const mark = lastDot > -1 ? '.' : ',';
        const count = s.split(mark).length - 1;
        const digitsAfter = s.length - s.lastIndexOf(mark) - 1;
        // A single separator followed by exactly 3 digits is a thousands group ("1.234"); otherwise it is the decimal mark.
        if (count === 1 && digitsAfter !== 3) decimalMark = mark;
        else if (count === 1 && digitsAfter === 3 && /^0[.,]/.test(s)) decimalMark = mark;
    }

    let normalized: string;
    if (decimalMark) {
        const idx = s.lastIndexOf(decimalMark);
        const intPart = s.slice(0, idx).replace(/[.,]/g, '');
        const frac = s.slice(idx + 1).replace(/[.,]/g, '');
        normalized = `${intPart || '0'}.${frac || '0'}`;
    } else {
        normalized = s.replace(/[.,]/g, '');
    }
    const n = Number(normalized);
    if (!Number.isFinite(n)) return NaN;
    return negative ? -n : n;
}
