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
      { title: 'First steps', text: 'Add your accounts, or connect a bank under Connections. Then choose your main currency under Preferences. Set your city under Profile too: the Tax pack uses it to pick your country.' },
      { title: 'Make it yours', text: 'Preferences has five accent colours (Forest, Ocean, Plum, Copper and Graphite), light and dark themes, your default period and the financial-year start.' },
      { title: 'Where to set things up', text: 'Everything that needs an address, a key or a token is under Settings, Connections: bank sync, Ask Crystal, alerts, API tokens, and the Twelve Data and Brandfetch keys. The “Connect and configure” section below walks through each one.' },
    ],
  },
  {
    id: 'overview',
    title: 'Overview',
    points: [
      { title: 'Your layout', text: 'Add, move and resize widgets to suit you.' },
      { title: 'Period', text: 'The period you choose applies to every widget. Set the default under Preferences.' },
      { title: 'Net worth bridge', text: 'On the Wealth tab. Choose Customise, then Add widget, then Net worth bridge. It shows what moved your net worth over the period: where it started, what came in, what went out, market gains and debt, and where it ended. Choose a step to see what is in it. It follows the period and accounts you chose on the Overview.' },
      { title: 'Life events', text: 'Mark moments that explain your net worth, like a new job, a move or a big purchase. They appear on the net-worth chart and in your Wrapped. Open Life events from the ⋯ menu beside the period on the Overview.' },
    ],
  },
  {
    id: 'ask-crystal',
    title: 'Ask Crystal',
    points: [
      { title: 'Ask in your own words', text: 'Press Ctrl or ⌘ and / , or choose Ask Crystal in search, then ask things like “What did I spend on dining last month?” or “Can I afford €500 next week?”.' },
      { title: 'Numbers you can trust', text: 'Crystal looks the numbers up with the same calculations the rest of the app uses. The model only chooses what to look up and words the answer. “How I found this” shows each lookup, and any figure that could not be matched to your data is flagged.' },
      { title: 'Choose a model', text: 'Under Connections, either download a model to the built-in engine or connect one you already run (Ollama, LM Studio, or a hosted service). Your questions and the figures looked up go only to the model you choose. See “Set up Ask Crystal” below for the addresses to use.' },
      { title: 'Suggestions', text: 'Ask Crystal can suggest filing a merchant under another category, or renaming a merchant. It never changes anything itself: its suggestions wait in Tidy-ups on the Queue tab until you approve them.' },
      { title: 'Connected tools', text: 'You can add up to five outside MCP servers under Connections, Ask Crystal. Only tools that declare themselves read-only are used.' },
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
      { title: 'Queue', text: 'Crystal gathers what needs a decision, such as possible transfers, bill matches and transactions with no category.' },
      { title: 'Tidy-ups', text: 'At the top of the Queue tab, Crystal suggests clean-ups such as merging two spellings of a merchant or filing a merchant under a category. Each suggestion shows the exact changes. Nothing happens until you approve, approving skips anything you changed since, and Undo puts the old values back. A suggestion you dismiss is not offered again.' },
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
      { title: 'Debt payoff', text: 'In Planning. Choose how much extra you can pay each month and compare the snowball (smallest balance first) with the avalanche (highest interest first): the date you are debt-free and the interest you pay.' },
      { title: 'Tasks', text: 'Track money chores by status, with a priority and a due date.' },
    ],
  },
  {
    id: 'investments',
    title: 'Investments',
    points: [
      { title: 'Holdings', text: 'Crystal builds holdings from your trades, with gains, allocation and price history.' },
      { title: 'Prices', text: 'Prices can come from Twelve Data or from a web page you point Crystal at. You can also enter them yourself. Add your Twelve Data key under Connections, Prices and logos.' },
      { title: 'Performance', text: 'The yearly return that counts when you put money in (XIRR) for each holding and the portfolio, what you paid in against growth, and how concentrated you are. Holdings with no live price are left out of returns, and histories under 90 days are flagged as a rough guide.' },
      { title: 'Against an index', text: 'On the Performance tab, Crystal replays your buys and sales into up to three index funds on the same days, and shows who is ahead. Choose a preset or type any ticker, like CSPX:XLON. It needs a Twelve Data key.' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports and reviews',
    points: [
      { title: 'Weekly recap', text: 'One Monday-to-Sunday week: spent, earned and kept against the week before, top categories and merchants, budgets running high and what is due. Turn on the weekly alert under Connections, Alerts to get a short summary every Monday.' },
      { title: 'Trips', text: 'Crystal finds trips from the country on your transactions: days outside your home country, within a few days of each other, make a trip, with the spend and a map. Nothing is stored; fix a country on a transaction and the trips follow. Home is the country with most transactions, or the one you type on the page. The map uses OpenStreetMap by default; you can switch it off or give your own tile server.' },
      { title: 'FIRE', text: 'Shows the odds your money lasts for as long as you need it, not just one number. Save your settings and add planned costs, such as a house or a child, to see how they change the odds.' },
      { title: 'Wrapped', text: 'A year in review built from your ledger. Pick any year with data.' },
      { title: 'Tax pack', text: 'For one tax year: income, investment income, spending in categories your country usually allows as deductions, and investment sales with their gains. A checklist shows the documents your country asks for, and you attach each one. Download pack gives a zip with CSV summaries and every document. It reads your country from the city under Profile; choose another country on the page to see its requirements instead. It is a guide to the paperwork, not tax advice.' },
      { title: 'Where tax documents live', text: 'Files are encrypted on your server’s disk (PDF, PNG, JPG, WebP or text, 10 MB each and 500 MB per person by default). Back up the server’s config folder with your database, and keep the server secret: without it the files cannot be read. See “Server settings” below.' },
    ],
  },
  {
    id: 'setup',
    title: 'Connect and configure',
    points: [
      { title: 'Twelve Data (prices and rates)', text: 'Create a free key at twelvedata.com, then paste it under Settings, Connections, Prices and logos. It adds live prices, extra exchange rates and the index comparison. The free plan has a daily limit; Crystal caches index history for a day.' },
      { title: 'Brandfetch (logos)', text: 'Create a free account at brandfetch.com/developers, copy your Client ID (not a secret key), and paste it under Settings, Connections, Prices and logos. Merchant and bank logos appear once it is saved.' },
      { title: 'Bank sync: what you need', text: 'Sign in at enablebanking.com, create an application, and download its private key (a .pem file). Note the application ID. In the application settings, register the callback address below, then open Settings, Connections, Enable Banking and enter the application ID and the key.' },
      { title: 'Bank sync: callback address', text: 'Register exactly https://<your-crystal-address>/enable-banking/callback, for example https://crystal.example.com/enable-banking/callback. Enable Banking only accepts https except for localhost. On your server, set ENABLE_BANKING_REDIRECT_URL to the same address so Crystal sends the one you registered. The page under Connections shows the address Crystal will use.' },
      { title: 'Bank sync: using it', text: 'Under Connections, Banks, choose your country and bank, sign in with the bank, then link each bank account to one in Crystal. Sync when you want new transactions. Access lasts up to 180 days, and Crystal warns before it ends.' },
      { title: 'Alerts to your phone', text: 'Under Connections, Alerts, choose ntfy, Gotify or a webhook. ntfy: the address is https://ntfy.sh (or your own server) and the topic is a hard-to-guess name you subscribe to in the ntfy app. Gotify: the address of your server and an application token. Webhook: an address that accepts a JSON POST. An address on your own network needs ALERTS_ALLOW_PRIVATE_URLS=true on the server. Alerts cover low balances, budgets, duplicate charges, price increases and expiring bank access.' },
      { title: 'API tokens', text: 'Under Connections, API tokens, create a token and choose what it can see: summary, transactions, investments or planning. It is read-only, can expire, and is shown once, so copy it. Use it as Authorization: Bearer cry_… against https://<your-crystal-address>/api/v1.' },
      { title: 'Connect an AI tool (MCP)', text: 'In an MCP client such as Claude Desktop or Claude Code, add a server of type “HTTP” with the address https://<your-crystal-address>/api/mcp and the header Authorization: Bearer cry_… using a token from API tokens. Tools: get_summary, list_transactions, spending_by_category, search_merchants, get_investments and get_planning, limited by the token’s scopes. Nothing can write.' },
      { title: 'Set up Ask Crystal', text: 'Built-in engine: on your server run docker compose --profile ai up -d, then under Connections, Ask Crystal pick a model and Download (qwen3:4b is a good start; it needs about 2.5 GB). Your own model server: choose “A model server I already have” and enter its address: Ollama http://192.168.1.10:11434, LM Studio http://192.168.1.10:1234/v1, OpenAI https://api.openai.com/v1, OpenRouter https://openrouter.ai/api/v1 (add an API key for hosted ones). Use Test to check it, and pick a model that supports tools.' },
      { title: 'Model server on your network', text: 'An address on your own network works when you are the only user. If other people share your server, the operator must set ASSISTANT_ALLOW_PRIVATE_URLS=true.' },
      { title: 'Server settings (self-hosting)', text: 'Set these in the environment of the backend, in docker-compose.yml or .env: JWT_SECRET and POSTGRES_PASSWORD (required), ENCRYPTION_SECRET (encrypts stored keys and tax documents; falls back to JWT_SECRET if empty, so set it once and never change it), ALLOW_REGISTRATION=false (once everyone has an account), ENABLE_BANKING_REDIRECT_URL, ALERTS_ENABLED, ALERTS_INTERVAL_MINUTES, ALERTS_ALLOW_PRIVATE_URLS, OLLAMA_URL, ASSISTANT_ALLOW_PRIVATE_URLS, TAX_DOCS_DIR, TAX_DOC_MAX_MB and TAX_DOC_USER_MAX_MB. The README lists each with its default.' },
    ],
  },
  {
    id: 'data',
    title: 'Data and backups',
    points: [
      { title: 'Import', text: 'Bring in transactions or accounts from a CSV file. You match the columns and check the rows before anything is added.' },
      { title: 'Export', text: 'Download chosen data as CSV tables, or everything as a JSON backup. The backup holds your data, not tax documents: back up the server’s config folder for those.' },
      { title: 'Restore', text: 'Restore a backup section by section. Merge keeps what’s here and adds what’s new. Replace removes what’s here first.' },
    ],
  },
  {
    id: 'currencies',
    title: 'Currencies',
    points: [
      { title: 'Main currency', text: 'Accounts and transactions keep their own currency. Totals appear in your main currency, set under Preferences, at today’s exchange rate.' },
      { title: 'Exchange rates', text: 'Crystal gets rates from the European Central Bank, and from Twelve Data if you add a key. If a currency has no rate, amounts in it stay out of totals until you enter one under Preferences.' },
    ],
  },
  {
    id: 'lock',
    title: 'Locking Crystal',
    points: [
      { title: 'PIN lock', text: 'Set a PIN under Profile, then lock from your profile menu or by pressing L. Crystal also locks itself when idle, after a time you choose. Locking clears your data from the browser until you unlock.' },
      { title: 'Forgot your PIN', text: 'Choose Sign out instead, sign in with your password, then set a new PIN under Profile. Five wrong PINs sign you out.' },
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
