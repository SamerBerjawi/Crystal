import { parseAmount } from './parseAmount';
import { toLocalISOString } from '../utils';


// Helper function for fuzzy matching (Levenshtein distance)
export const levenshteinDistance = (s1: string, s2: string): number => {
    const track = Array(s2.length + 1).fill(null).map(() =>
        Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) {
        track[0][i] = i;
    }
    for (let j = 0; j <= s2.length; j += 1) {
        track[j][0] = j;
    }
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator, // substitution
            );
        }
    }
    return track[s2.length][s1.length];
};

export const calculateMatchScore = (header: string, keywords: string[]): number => {
    let maxScore = 0;
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalizedHeader) return 0;

    for (const keyword of keywords) {
        let currentScore = 0;
        const normalizedKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normalizedKeyword) continue;

        // 1. Exact match = 100
        if (normalizedHeader === normalizedKeyword) {
            currentScore = 100;
        } 
        // 2. Contains match = 70-90
        // (very short keywords such as "cr" or "in" only count on an exact match, otherwise "Description" matches "cr")
        else if (normalizedKeyword.length > 3 && normalizedHeader.includes(normalizedKeyword)) {
            const lengthRatio = normalizedKeyword.length / normalizedHeader.length;
            currentScore = 70 + (20 * lengthRatio);
        }
        // 3. Levenshtein distance = up to 70
        else {
            const distance = levenshteinDistance(normalizedHeader, normalizedKeyword);
            const similarity = 1 - (distance / Math.max(normalizedHeader.length, normalizedKeyword.length));
            if (similarity > 0.6) { // Only consider if reasonably similar
                currentScore = similarity * 70;
            }
        }
        
        if (currentScore > maxScore) {
            maxScore = currentScore;
        }
    }
    return maxScore;
};


export const parseCSV = (csvText: string, delimiter: string): { headers: string[], data: Record<string, any>[] } => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 1) return { headers: [], data: [] };

    const headers = lines.shift()!.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const data: Record<string, any>[] = [];

    const escapedDelimiter = delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const valueRegex = new RegExp(`(".*?"|[^"${escapedDelimiter}]+)(?=\\s*${escapedDelimiter}|\\s*$)`, 'g');


    lines.forEach(line => {
        // Guard against empty lines
        if (!line.trim()) return;

        const values = line.match(valueRegex) || [];
        if (values.length > 0) {
            const obj = headers.reduce((acc, header, index) => {
                let value = (values[index] || '').trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1).replace(/""/g, '"');
                }
                acc[header] = value;
                return acc;
            }, {} as Record<string, any>);
            data.push(obj);
        }
    });
    return { headers, data };
};

/** Text like "March 3, 2026". Anything unreadable is null, so the row is reported rather than imported. */
const parseLooseDate = (dateStr: string): Date | null => {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

export const parseDate = (dateStr: string, format: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.match(/(\d+)/g);
    if (!parts || parts.length < 3) return parseLooseDate(dateStr);
    
    const [p1, p2, p3] = parts.map(Number);
    
    try {
        let year, month, day;
        switch(format) {
            case 'YYYY-MM-DD': [year, month, day] = [p1, p2, p3]; break;
            case 'MM/DD/YYYY': [month, day, year] = [p1, p2, p3]; break;
            case 'DD/MM/YYYY': [day, month, year] = [p1, p2, p3]; break;
            default: return parseLooseDate(dateStr);
        }
        
        if (String(year).length === 2) {
            year += 2000;
        }

        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return date;
        }
        return null;
    } catch (e) {
        return null;
    }
}

export const detectDateFormat = (data: Record<string, any>[], dateColumn: string): string => {
    if (!dateColumn || data.length === 0) return 'YYYY-MM-DD';

    const samples = data.map(row => row[dateColumn]).filter(Boolean).slice(0, 20);
    if (samples.length === 0) return 'YYYY-MM-DD';

    const scores = { 'YYYY-MM-DD': 0, 'MM/DD/YYYY': 0, 'DD/MM/YYYY': 0 };
    let isLikelyDMY = false;
    let isLikelyMDY = false;

    const formats = [
        { name: 'YYYY-MM-DD', regex: /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/ },
        { name: 'slashed', regex: /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/ },
    ];

    samples.forEach(sample => {
        if (formats[0].regex.test(sample)) {
            scores['YYYY-MM-DD']++;
        } else if (formats[1].regex.test(sample)) {
            const parts = sample.split(/[-/]/).map(Number);
            if (parts.length === 3) {
                const [p1, p2] = parts;
                if (p1 > 12) isLikelyDMY = true;
                if (p2 > 12) isLikelyMDY = true;
                if (p1 >= 1 && p1 <= 12) scores['MM/DD/YYYY']++;
                if (p2 >= 1 && p2 <= 12) scores['DD/MM/YYYY']++;
            }
        }
    });

    if (isLikelyDMY && !isLikelyMDY) return 'DD/MM/YYYY';
    if (isLikelyMDY && !isLikelyDMY) return 'MM/DD/YYYY';

    const maxScore = Math.max(scores['YYYY-MM-DD'], scores['MM/DD/YYYY'], scores['DD/MM/YYYY']);
    const bestFormats = Object.keys(scores).filter(key => scores[key as keyof typeof scores] === maxScore);

    if (bestFormats.length === 1) return bestFormats[0];
    if (bestFormats.includes('YYYY-MM-DD')) return 'YYYY-MM-DD';
    if (bestFormats.includes('MM/DD/YYYY')) return 'MM/DD/YYYY';
    
    return 'DD/MM/YYYY'; // Common default
};

export const detectAmountFormat = (mapping: Record<string, string>): string => {
    if (mapping.amountIn && mapping.amountOut) {
        return 'double_entry';
    }
    return 'single_signed';
};

export type RowFilter = { type: string; value: string };

/** The Clean step's column filters. An unreadable filter value matches everything. */
export const rowMatchesFilters = (row: Record<string, any>, filters: Record<string, RowFilter>): boolean =>
  Object.entries(filters).every(([header, filter]) => {
    if (!filter.value) return true;
    const rowValue = row[header];
    if (header === 'date') {
      const rowDate = new Date(rowValue);
      if (isNaN(rowDate.getTime())) return false;
      const filterDate = new Date(filter.value);
      switch (filter.type) {
        case 'exact': return toLocalISOString(rowDate) === filter.value;
        case 'before': return rowDate < filterDate;
        case 'after': return rowDate > filterDate;
        case 'year': return rowDate.getFullYear() === parseInt(filter.value);
        case 'month': return rowDate.getMonth() + 1 === parseInt(filter.value);
        case 'day': return rowDate.getDate() === parseInt(filter.value);
        default: return true;
      }
    }
    if (header === 'amount' || header === 'balance') {
      const rowAmount = parseAmount(rowValue);
      const filterAmount = parseAmount(filter.value);
      if (isNaN(rowAmount) || isNaN(filterAmount)) return true;
      switch (filter.type) {
        case 'gt': return rowAmount > filterAmount;
        case 'lt': return rowAmount < filterAmount;
        case 'eq': return rowAmount === filterAmount;
        default: return true;
      }
    }
    return String(rowValue).toLowerCase().includes(String(filter.value).toLowerCase());
  });
