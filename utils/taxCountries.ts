/*
 * What each country usually asks for at tax time, as a checklist to gather documents against. This is a general guide to
 * the paperwork, not tax advice or a complete list of what applies to you: rules change and depend on your situation, so
 * check with your tax authority. Countries are listed by what most people there need.
 */

export type ChecklistNeed = 'always' | 'investmentIncome' | 'sales' | 'deductible';

export interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  /** When it applies. Items that do not apply to your data are shown as optional. */
  need: ChecklistNeed;
}

export interface TaxCountry {
  code: string;
  name: string;
  authority: string;
  /** When the tax year starts. Most countries use the calendar year. */
  yearStart: { month: number; day: number };
  /** When a return is usually due, in words. */
  deadline: string;
  checklist: ChecklistItem[];
  /** Spending commonly deductible or creditable here. Used to pick categories for the deductible summary. */
  deductibleKeywords: string[];
  deductibleNote: string;
}

const item = (key: string, label: string, hint: string, need: ChecklistNeed = 'always'): ChecklistItem => ({ key, label, hint, need });

const INCOME = item('income', 'Income statement', 'From your employer or payer, for the whole year');
const BANK = item('bank-interest', 'Bank interest statements', 'Interest paid on savings and current accounts', 'investmentIncome');
const DIVIDENDS = item('dividends', 'Dividend and interest statements', 'Dividends, coupons and interest from investments', 'investmentIncome');
const BROKER = item('brokerage', 'Brokerage annual statement', 'Trades, proceeds and fees for the year', 'sales');
const HEALTH = item('health', 'Medical receipts', 'Costs not reimbursed by insurance', 'deductible');
const DONATIONS = item('donations', 'Donation receipts', 'From the charities you gave to', 'deductible');
const EDUCATION = item('education', 'Education and training costs', 'Tuition, courses, study materials', 'deductible');
const CHILDCARE = item('childcare', 'Childcare receipts', 'Nursery and after-school care', 'deductible');
const MORTGAGE = item('mortgage', 'Mortgage and home loan statement', 'Interest paid and the remaining balance', 'deductible');
const PENSION = item('pension', 'Pension and retirement contributions', 'Statements of what you paid in', 'deductible');
const PROPERTY = item('property', 'Property and rental documents', 'Rental income, costs and property tax notices');

const GENERIC: TaxCountry = {
  code: 'XX', name: 'Other country', authority: 'your tax authority', yearStart: { month: 1, day: 1 },
  deadline: 'Check your tax authority for the date.',
  checklist: [INCOME, BANK, DIVIDENDS, BROKER, HEALTH, DONATIONS, EDUCATION, MORTGAGE, PENSION, PROPERTY],
  deductibleKeywords: ['health', 'medical', 'donation', 'charity', 'education', 'childcare', 'pension', 'mortgage'],
  deductibleNote: 'What is deductible depends on your country. This lists spending in the usual categories; check the rules before relying on it.',
};

export const TAX_COUNTRIES: TaxCountry[] = [
  {
    code: 'BE', name: 'Belgium', authority: 'FPS Finance (MyMinfin)', yearStart: { month: 1, day: 1 },
    deadline: 'Usually due between late June and mid July online, with extensions for some filers.',
    checklist: [INCOME, BANK, DIVIDENDS, BROKER, CHILDCARE, DONATIONS, item('service-vouchers', 'Service voucher certificates', 'Fiscal attestation for the year', 'deductible'), item('housing-loan', 'Housing loan attestation', 'From your lender: interest and capital repaid', 'deductible'), PENSION, PROPERTY],
    deductibleKeywords: ['childcare', 'donation', 'charity', 'service voucher', 'mortgage', 'pension', 'energy'],
    deductibleNote: 'Belgium allows deductions for childcare, gifts to approved charities, service vouchers and some housing and pension costs.',
  },
  {
    code: 'NL', name: 'Netherlands', authority: 'Belastingdienst', yearStart: { month: 1, day: 1 },
    deadline: 'Usually due 1 May, with an easy extension to 1 September.',
    checklist: [item('income', 'Annual income statement (jaaropgave)', 'From each employer or benefit provider'), item('bank-interest', 'Bank and savings balances on 1 January', 'Box 3 uses wealth at the start of the year', 'investmentIncome'), DIVIDENDS, BROKER, item('mortgage', 'Mortgage statement', 'Interest paid for the year', 'deductible'), item('health', 'Medical costs', 'Specific healthcare costs not reimbursed', 'deductible'), DONATIONS, EDUCATION, PROPERTY],
    deductibleKeywords: ['mortgage', 'health', 'medical', 'donation', 'charity', 'education', 'study'],
    deductibleNote: 'The Netherlands allows mortgage interest, some medical costs, gifts and study costs.',
  },
  {
    code: 'FR', name: 'France', authority: 'Direction générale des Finances publiques (impots.gouv.fr)', yearStart: { month: 1, day: 1 },
    deadline: 'Usually between April and June online, depending on your department.',
    checklist: [INCOME, BANK, DIVIDENDS, BROKER, DONATIONS, CHILDCARE, item('home-help', 'Home help receipts', 'Employed home services', 'deductible'), PENSION, PROPERTY],
    deductibleKeywords: ['donation', 'charity', 'childcare', 'home help', 'pension', 'energy'],
    deductibleNote: 'France gives tax reductions and credits for donations, childcare, home help and some pension savings.',
  },
  {
    code: 'DE', name: 'Germany', authority: 'Finanzamt (ELSTER)', yearStart: { month: 1, day: 1 },
    deadline: 'Usually 31 July of the next year, later with a tax adviser.',
    checklist: [item('income', 'Wage tax statement (Lohnsteuerbescheinigung)', 'From your employer'), BANK, item('dividends', 'Annual tax certificate from your bank or broker', 'Jahressteuerbescheinigung, if your bank did not withhold everything', 'investmentIncome'), BROKER, item('work-costs', 'Work-related costs', 'Equipment, commuting, home office', 'deductible'), DONATIONS, HEALTH, EDUCATION, CHILDCARE, PROPERTY],
    deductibleKeywords: ['work', 'office', 'commute', 'donation', 'charity', 'health', 'medical', 'education', 'childcare'],
    deductibleNote: 'Germany allows work-related costs, donations, extraordinary medical costs, childcare and training.',
  },
  {
    code: 'GB', name: 'United Kingdom', authority: 'HMRC', yearStart: { month: 4, day: 6 },
    deadline: 'Online returns are due 31 January after the tax year ends on 5 April.',
    checklist: [item('income', 'P60 and P45 or payslips', 'From your employers'), item('bank-interest', 'Interest certificates', 'From banks and building societies', 'investmentIncome'), item('dividends', 'Dividend vouchers', 'From companies and funds', 'investmentIncome'), item('brokerage', 'Capital gains records', 'Sale proceeds, costs and dates', 'sales'), DONATIONS, PENSION, item('self-employment', 'Self-employment income and costs', 'If you work for yourself'), PROPERTY],
    deductibleKeywords: ['donation', 'charity', 'pension', 'work', 'professional'],
    deductibleNote: 'The UK tax year runs 6 April to 5 April. Gift Aid donations, pension contributions and some work costs can reduce tax.',
  },
  {
    code: 'US', name: 'United States', authority: 'Internal Revenue Service', yearStart: { month: 1, day: 1 },
    deadline: 'Usually 15 April, with an extension available.',
    checklist: [item('income', 'W-2 or 1099 forms', 'From employers and payers'), item('bank-interest', 'Form 1099-INT', 'Interest income', 'investmentIncome'), item('dividends', 'Form 1099-DIV', 'Dividends', 'investmentIncome'), item('brokerage', 'Form 1099-B or consolidated 1099', 'Sales and cost basis', 'sales'), item('mortgage', 'Form 1098', 'Mortgage interest and property tax', 'deductible'), HEALTH, DONATIONS, EDUCATION, item('retirement', 'Retirement contribution statements', 'IRA and 401(k)', 'deductible'), PROPERTY],
    deductibleKeywords: ['mortgage', 'health', 'medical', 'donation', 'charity', 'education', 'student loan', 'retirement'],
    deductibleNote: 'Itemised deductions include mortgage interest, charity and large medical costs. Many people take the standard deduction instead.',
  },
  {
    code: 'CA', name: 'Canada', authority: 'Canada Revenue Agency', yearStart: { month: 1, day: 1 },
    deadline: 'Usually 30 April, or 15 June if self-employed (any tax owing is still due 30 April).',
    checklist: [item('income', 'T4 slips', 'From employers'), item('bank-interest', 'T5 slips', 'Interest and dividends', 'investmentIncome'), BROKER, item('rrsp', 'RRSP and FHSA contribution receipts', 'Registered savings contributions', 'deductible'), DONATIONS, HEALTH, CHILDCARE, EDUCATION, PROPERTY],
    deductibleKeywords: ['rrsp', 'donation', 'charity', 'health', 'medical', 'childcare', 'tuition', 'education'],
    deductibleNote: 'Canada allows registered savings contributions, donations, medical expenses, childcare and tuition.',
  },
  {
    code: 'AU', name: 'Australia', authority: 'Australian Taxation Office', yearStart: { month: 7, day: 1 },
    deadline: 'The tax year ends 30 June; returns are usually due 31 October.',
    checklist: [item('income', 'Income statement', 'From myGov, for the year to 30 June'), BANK, DIVIDENDS, BROKER, item('work-costs', 'Work-related expense records', 'Equipment, travel, self-education', 'deductible'), DONATIONS, item('health', 'Private health insurance statement', 'Annual tax statement from your insurer', 'deductible'), PROPERTY],
    deductibleKeywords: ['work', 'donation', 'charity', 'education', 'health', 'insurance'],
    deductibleNote: 'The Australian tax year runs 1 July to 30 June. Work-related costs and gifts to registered charities can be claimed.',
  },
  {
    code: 'IE', name: 'Ireland', authority: 'Revenue', yearStart: { month: 1, day: 1 },
    deadline: 'Usually 31 October, a little later when filing online.',
    checklist: [item('income', 'Employment Detail Summary', 'From Revenue myAccount'), BANK, DIVIDENDS, BROKER, HEALTH, EDUCATION, DONATIONS, item('rent', 'Rent receipts', 'For the rent tax credit', 'deductible'), PROPERTY],
    deductibleKeywords: ['health', 'medical', 'education', 'donation', 'charity', 'rent', 'pension'],
    deductibleNote: 'Ireland gives tax credits and reliefs for medical costs, tuition, rent and some donations.',
  },
  {
    code: 'ES', name: 'Spain', authority: 'Agencia Tributaria', yearStart: { month: 1, day: 1 },
    deadline: 'Usually from April to 30 June.',
    checklist: [INCOME, BANK, DIVIDENDS, BROKER, PENSION, DONATIONS, MORTGAGE, PROPERTY],
    deductibleKeywords: ['pension', 'donation', 'charity', 'mortgage', 'education'],
    deductibleNote: 'Spain allows pension plan contributions, donations and some housing costs, depending on the region.',
  },
  {
    code: 'IT', name: 'Italy', authority: 'Agenzia delle Entrate', yearStart: { month: 1, day: 1 },
    deadline: 'Pre-filled returns are usually due around 30 September.',
    checklist: [item('income', 'Certificazione Unica', 'From your employer'), BANK, DIVIDENDS, BROKER, HEALTH, MORTGAGE, EDUCATION, DONATIONS, PROPERTY],
    deductibleKeywords: ['health', 'medical', 'mortgage', 'education', 'donation', 'charity', 'renovation'],
    deductibleNote: 'Italy lets you deduct a share of medical costs, mortgage interest, education, donations and some renovation work.',
  },
  {
    code: 'CH', name: 'Switzerland', authority: 'your cantonal tax office', yearStart: { month: 1, day: 1 },
    deadline: 'Set by your canton, usually March to 31 March, with extensions.',
    checklist: [item('income', 'Salary certificate (Lohnausweis)', 'From your employer'), item('bank-interest', 'Bank statements with 31 December balances', 'Wealth tax uses the year-end value', 'investmentIncome'), DIVIDENDS, item('pension', 'Pillar 3a certificate', 'Retirement savings contributions', 'deductible'), HEALTH, DONATIONS, MORTGAGE, PROPERTY],
    deductibleKeywords: ['pillar', 'pension', 'health', 'medical', 'donation', 'charity', 'mortgage', 'education'],
    deductibleNote: 'Switzerland allows Pillar 3a contributions, medical costs, donations and professional training. Rules vary by canton.',
  },
  {
    code: 'LU', name: 'Luxembourg', authority: 'Administration des contributions directes', yearStart: { month: 1, day: 1 },
    deadline: 'Usually 31 December of the following year; earlier if you must file.',
    checklist: [INCOME, BANK, DIVIDENDS, BROKER, item('mortgage', 'Mortgage interest statement', 'From your lender', 'deductible'), PENSION, DONATIONS, CHILDCARE, PROPERTY],
    deductibleKeywords: ['mortgage', 'pension', 'donation', 'charity', 'childcare'],
    deductibleNote: 'Luxembourg allows mortgage interest, pension contributions, donations and childcare costs.',
  },
  {
    code: 'AE', name: 'United Arab Emirates', authority: 'Federal Tax Authority', yearStart: { month: 1, day: 1 },
    deadline: 'There is no personal income tax. Businesses and some activities have separate duties.',
    checklist: [item('income', 'Income record', 'Useful if another country asks for proof'), item('residency', 'Tax residency certificate', 'Often needed to show you pay tax in the UAE', 'always'), BANK, BROKER],
    deductibleKeywords: [],
    deductibleNote: 'There is no personal income tax, so there is nothing to deduct. If you also file in another country, switch to that country.',
  },
  {
    code: 'LB', name: 'Lebanon', authority: 'Ministry of Finance', yearStart: { month: 1, day: 1 },
    deadline: 'Salary-tax declarations are generally due early in the next year; check the current notice.',
    checklist: [INCOME, BANK, DIVIDENDS, BROKER, item('rent', 'Rent and property documents', 'Rental income and property fees', 'always'), HEALTH, EDUCATION],
    deductibleKeywords: ['health', 'medical', 'education', 'school', 'insurance'],
    deductibleNote: 'Lebanon gives family and some education and insurance allowances. Check the current rules, as they change often.',
  },
];

export const countryByCode = (code: string | undefined): TaxCountry =>
  TAX_COUNTRIES.find(country => country.code === code?.toUpperCase()) ?? GENERIC;

export const OTHER_COUNTRY = GENERIC;

/** The first day and last day of a tax year, as YYYY-MM-DD. `year` is the calendar year the tax year starts in. */
export const taxYearRange = (country: TaxCountry, year: number): { start: string; end: string; label: string } => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const { month, day } = country.yearStart;
  const start = `${year}-${pad(month)}-${pad(day)}`;
  if (month === 1 && day === 1) return { start, end: `${year}-12-31`, label: String(year) };
  const next = new Date(Date.UTC(year + 1, month - 1, day - 1));
  const end = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  return { start, end, label: `${year}/${String(year + 1).slice(2)}` };
};

/** The tax year a date falls in, by the year it starts in. */
export const taxYearOf = (country: TaxCountry, isoDate: string): number => {
  const year = Number(isoDate.slice(0, 4));
  const { month, day } = country.yearStart;
  const before = Number(isoDate.slice(5, 7)) < month || (Number(isoDate.slice(5, 7)) === month && Number(isoDate.slice(8, 10)) < day);
  return before ? year - 1 : year;
};

const CITY_COUNTRY: Record<string, string> = {
  brussels: 'BE', antwerp: 'BE', ghent: 'BE', bruges: 'BE', leuven: 'BE', liege: 'BE', namur: 'BE', charleroi: 'BE',
  amsterdam: 'NL', rotterdam: 'NL', 'the hague': 'NL', utrecht: 'NL', eindhoven: 'NL',
  paris: 'FR', lyon: 'FR', marseille: 'FR', toulouse: 'FR', nice: 'FR', bordeaux: 'FR', lille: 'FR',
  berlin: 'DE', munich: 'DE', hamburg: 'DE', frankfurt: 'DE', cologne: 'DE', stuttgart: 'DE',
  london: 'GB', manchester: 'GB', birmingham: 'GB', edinburgh: 'GB', glasgow: 'GB', bristol: 'GB', leeds: 'GB',
  'new york': 'US', 'los angeles': 'US', chicago: 'US', houston: 'US', 'san francisco': 'US', seattle: 'US', boston: 'US', austin: 'US', miami: 'US',
  toronto: 'CA', vancouver: 'CA', montreal: 'CA', calgary: 'CA', ottawa: 'CA',
  sydney: 'AU', melbourne: 'AU', brisbane: 'AU', perth: 'AU', adelaide: 'AU',
  dublin: 'IE', cork: 'IE', galway: 'IE',
  madrid: 'ES', barcelona: 'ES', valencia: 'ES', seville: 'ES',
  rome: 'IT', milan: 'IT', naples: 'IT', turin: 'IT', florence: 'IT',
  zurich: 'CH', geneva: 'CH', basel: 'CH', bern: 'CH', lausanne: 'CH',
  luxembourg: 'LU', 'luxembourg city': 'LU',
  dubai: 'AE', 'abu dhabi': 'AE', sharjah: 'AE',
  beirut: 'LB', tripoli: 'LB', sidon: 'LB', jounieh: 'LB',
};

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * The country for the city in Settings. Reads "Brussels", "Brussels, Belgium" or a country name on its own. Returns
 * undefined when nothing matches, so the page can ask rather than guess.
 */
export const countryForCity = (city: string | undefined): string | undefined => {
  if (!city?.trim()) return undefined;
  const text = fold(city);
  for (const country of TAX_COUNTRIES) if (text.split(/[,;/]|\s-\s/).map(part => part.trim()).includes(fold(country.name)) || text.endsWith(` ${fold(country.name)}`)) return country.code;
  const parts = text.split(/[,;/]|\s-\s/).map(part => part.trim()).filter(Boolean);
  for (const part of parts) if (CITY_COUNTRY[part]) return CITY_COUNTRY[part];
  return undefined;
};
