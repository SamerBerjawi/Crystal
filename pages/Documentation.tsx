import React, { useState } from 'react';
import { Page } from '../types';
import Card from '../components/Card';

interface DocumentationProps {
  setCurrentPage: (page: Page) => void;
}

const AccordionItem: React.FC<{
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, isOpen, onToggle, children }) => {
  return (
    <Card className="p-0 overflow-hidden transition-shadow duration-300 hover:shadow-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-4">
          <div className="bg-primary-100 dark:bg-primary-900/50 p-3 rounded-lg">
            <span className="material-symbols-outlined text-primary-500 text-2xl">{icon}</span>
          </div>
          <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">{title}</h3>
        </div>
        <span
          className={`material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[1000px]' : 'max-h-0'
        }`}
      >
        <div className="px-6 pb-6 pt-2 space-y-3 text-light-text-secondary dark:text-dark-text-secondary prose dark:prose-invert prose-li:my-1">
          {children}
        </div>
      </div>
    </Card>
  );
};

const features = [
    {
        title: 'Dashboard',
        icon: 'space_dashboard',
        content: (
            <>
                <p>Your central hub for a quick financial overview.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Customizable Widgets:</strong> Arrange, resize, and add widgets to create a dashboard that suits your needs. Enter 'Edit Layout' mode to customize.</li>
                    <li><strong>Dynamic Filters:</strong> Filter your entire dashboard view by accounts and time duration (7D, 1Y, etc.).</li>
                    <li><strong>Key Metrics:</strong> At-a-glance cards for Income, Expenses, Net Balance, and Net Worth.</li>
                    <li><strong>Transaction Matcher:</strong> Finaura automatically detects potential transfers between your accounts and prompts you to link them for accurate reporting.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Accounts & Transactions',
        icon: 'wallet',
        content: (
            <>
                <p>The core of your financial data.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Accounts:</strong> Add accounts manually or link them via 'Enable Banking' for automatic syncing. Accounts are categorized as Assets (e.g., Checking, Investments) or Liabilities (e.g., Credit Card, Loan).</li>
                    <li><strong>Transactions:</strong> Log expenses, income, or transfers between accounts. Use the bulk editing feature on the Transactions page to categorize or delete multiple items at once.</li>
                    <li><strong>Account Detail View:</strong> Click on any account to see a dedicated dashboard with detailed charts and transaction history for that specific account.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Budgeting',
        icon: 'pie_chart',
        content: (
            <p>Take control of your spending by setting monthly budgets for your main expense categories. Finaura tracks your spending in real-time and shows your progress throughout the month.</p>
        )
    },
    {
        title: 'Forecasting',
        icon: 'show_chart',
        content: (
            <>
                <p>Plan for the future with powerful projection tools.</p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Cash Flow Projection:</strong> Visualize your projected cash balance over different time horizons (3M, 1Y, 2Y) based on your recurring transactions.</li>
                    <li><strong>Financial Goals:</strong> Create savings goals (e.g., 'Vacation Fund') or plan for large one-time expenses. The forecast will show if you're on track to meet them.</li>
                    <li><strong>AI Smart Planner:</strong> Use the 'Generate Smart Plan' feature to get an AI-powered contribution strategy to help you reach your goals faster.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Investments & Warrants',
        icon: 'candlestick_chart',
        content: (
            <>
                <p>Track your portfolio's performance.</p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Investments:</strong> Log buy/sell transactions for stocks, crypto, and other assets to see your portfolio distribution, cost basis, and total gain/loss.</li>
                    <li><strong>Warrants:</strong> Specifically designed to track employee warrant grants. You can configure a web scraper to automatically fetch and update the current price for each warrant ISIN.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Schedule & Bills',
        icon: 'calendar_month',
        content: (
            <>
                <p>Never miss a payment again.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Recurring Transactions:</strong> Set up recurring income (like salary) and expenses (like subscriptions) to automate entries and improve forecast accuracy.</li>
                    <li><strong>Bills & Payments:</strong> Track one-time bills or expected deposits. Mark them as paid to automatically create a corresponding transaction.</li>
                </ul>
            </>
        )
    },
     {
        title: 'Data Management',
        icon: 'database',
        content: (
            <>
                <p>Your data, your control.</p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>CSV Import/Export:</strong> Use the powerful import wizard to bring in transactions or accounts from a CSV file. Export your data at any time.</li>
                    <li><strong>Full Backup & Restore:</strong> Create a complete JSON backup of all your app data and restore it when needed.</li>
                    <li><strong>Integrations:</strong> Connect to third-party services like Sure Finance to sync data.</li>
                </ul>
            </>
        )
    },
    {
        title: 'AI Assistant',
        icon: 'smart_toy',
        content: (
            <p>Click the chat bubble at the bottom-right to talk to your AI financial assistant. Ask questions about your spending, budgets, or account balances in natural language.</p>
        )
    }
];

const Documentation: React.FC<DocumentationProps> = ({ setCurrentPage }) => {
  const [openSections, setOpenSections] = useState<string[]>(['Dashboard']);

  const toggleSection = (title: string) => {
    setOpenSections(prev => 
        prev.includes(title) 
            ? prev.filter(t => t !== title) 
            : [...prev, title]
    );
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
            <span> / </span>
            <span className="text-light-text dark:text-dark-text font-medium">Documentation</span>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Welcome to Finaura! This guide will walk you through the key features of the application.
          </p>
        </div>
      </header>

      <div className="space-y-4">
        {features.map(feature => (
            <AccordionItem
                key={feature.title}
                title={feature.title}
                icon={feature.icon}
                isOpen={openSections.includes(feature.title)}
                onToggle={() => toggleSection(feature.title)}
            >
                {feature.content}
            </AccordionItem>
        ))}
      </div>
    </div>
  );
};

export default Documentation;