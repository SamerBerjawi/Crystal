export interface HelpSection {
  id: string;
  title: string;
  points: { title: string; text: string }[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    points: [
      { title: 'Your data', text: 'When you’re signed in, Crystal saves your data to your own server and keeps it in step across your devices. Demo mode runs in this browser and saves nothing to the server.' },
      { title: 'First steps', text: 'Add your accounts, or connect a bank under Connections. Then choose your main currency under Preferences.' },
    ],
  },
  {
    id: 'overview',
    title: 'Overview',
    points: [
      { title: 'Your layout', text: 'Add, move and resize widgets to suit you.' },
      { title: 'Period', text: 'The period you choose applies to every widget. Set the default under Preferences.' },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and banks',
    points: [
      { title: 'Accounts', text: 'Each account type shows what matters for it, such as a card’s statement or a loan’s schedule.' },
      { title: 'Bank sync', text: 'Connect a bank under Connections and link each of its accounts to one in Crystal. Bank access expires, and Crystal shows when to reconnect.' },
    ],
  },
  {
    id: 'transactions',
    title: 'Transactions',
    points: [
      { title: 'Review queue', text: 'Crystal gathers what needs a decision, such as possible transfers, bill matches and transactions with no category.' },
      { title: 'Merchants', text: 'Crystal remembers each merchant, so new transactions can fill in by themselves. Rules give you more control.' },
    ],
  },
  {
    id: 'categories-and-tags',
    title: 'Categories and tags',
    points: [
      { title: 'Categories', text: 'Every transaction has one category, and categories can have sub-categories, like Housing and Rent. Use them for your budget and reports.' },
      { title: 'Tags', text: 'A transaction can have many tags, or none. Use them for things that cross categories, like a trip or a project.' },
    ],
  },
  {
    id: 'planning',
    title: 'Planning',
    points: [
      { title: 'Budget and forecast', text: 'Set a budget per category, then see where your balances are heading with everything scheduled.' },
      { title: 'Goals, calendar and subscriptions', text: 'Save towards goals, see upcoming bills and payments, and keep an eye on subscriptions.' },
      { title: 'Tasks', text: 'Track money chores by status, with a priority and a due date.' },
    ],
  },
  {
    id: 'investments',
    title: 'Investments',
    points: [
      { title: 'Holdings', text: 'Crystal builds holdings from your trades, with gains, allocation and price history.' },
      { title: 'Prices', text: 'Prices can come from Twelve Data or from a web page you point Crystal at. You can also enter them yourself.' },
    ],
  },
  {
    id: 'data',
    title: 'Data and backups',
    points: [
      { title: 'Import', text: 'Bring in transactions or accounts from a CSV file. You match the columns and check the rows before anything is added.' },
      { title: 'Export', text: 'Download chosen data as CSV tables, or everything as a JSON backup.' },
      { title: 'Restore', text: 'Restore a backup section by section. Merge keeps what’s here and adds what’s new. Replace removes what’s here first.' },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    points: [
      { title: 'See them all', text: 'Press ? anywhere in Crystal.' },
    ],
  },
];

export const searchHelp = (sections: HelpSection[], term: string): HelpSection[] => {
  const query = term.toLowerCase().trim();
  if (!query) return sections;
  return sections.flatMap(section => {
    if (section.title.toLowerCase().includes(query)) return [section];
    const points = section.points.filter(point => `${point.title} ${point.text}`.toLowerCase().includes(query));
    return points.length > 0 ? [{ ...section, points }] : [];
  });
};
