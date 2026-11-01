import { MileageLog } from '../types';

export interface MileageBatchEntry {
  date: string;
  reading: number;
  diff?: number;
  error?: string;
  warning?: string;
}

/** An odometer never goes backwards, so a reading has to sit between its neighbours. */
export const readingProblem = (reading: number, date: string, logs: MileageLog[], editingId?: string): string | null => {
  const others = logs.filter(log => log.id !== editingId);
  const previous = others.filter(log => log.date <= date).sort((a, b) => b.date.localeCompare(a.date) || b.reading - a.reading)[0];
  const next = others.filter(log => log.date > date).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (previous && reading < previous.reading) return `It can't be lower than ${previous.reading.toLocaleString()} km on ${previous.date}.`;
  if (next && reading > next.reading) return `It can't be higher than ${next.reading.toLocaleString()} km on ${next.date}.`;
  return null;
};

export const parseReading = (text: string) => parseInt(text.replace(/[^0-9]/g, ''), 10);

const splitLine = (line: string) => {
  const separator = [',', ';', '\t'].find(mark => line.includes(mark));
  return (separator ? line.split(separator) : line.split(/\s+/)).map(part => part.trim());
};

/** `2024-5-1` and `2024/05/01` become `2024-05-01`. It stays text, so no time zone can move the day. */
const normalizeDate = (text: string) => {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** One reading per line: date, then reading. Anything after those is ignored. */
export const parseMileageBatch = (text: string, existing: MileageLog[]): MileageBatchEntry[] => {
  const entries: MileageBatchEntry[] = text.split('\n').flatMap((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return [];
    const [rawDate, rawReading] = splitLine(trimmed);
    if (!rawReading) return [{ date: '', reading: 0, error: `Line ${index + 1}: add a date and a reading.` }];
    const date = normalizeDate(rawDate);
    if (!date) return [{ date: rawDate, reading: 0, error: `Line ${index + 1}: "${rawDate}" isn't a date. Use YYYY-MM-DD.` }];
    const reading = parseReading(rawReading);
    if (Number.isNaN(reading)) return [{ date, reading: 0, error: `Line ${index + 1}: "${rawReading}" isn't a reading.` }];
    return [{ date, reading }];
  });

  const earlier = [...existing].sort((a, b) => a.date.localeCompare(b.date));
  entries.filter(entry => !entry.error).sort((a, b) => a.date.localeCompare(b.date)).forEach((entry, index, valid) => {
    const previous = index > 0 ? valid[index - 1].reading : earlier.filter(log => log.date <= entry.date).pop()?.reading;
    if (previous === undefined) return;
    entry.diff = entry.reading - previous;
    if (entry.diff < 0) entry.warning = `Lower than the reading before it, ${previous.toLocaleString()} km.`;
  });

  return entries;
};
