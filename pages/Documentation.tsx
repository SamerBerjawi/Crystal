import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Page } from '../types';
import Card from '../components/Card';

interface DocumentationProps {
  setCurrentPage: (page: Page) => void;
}

const features = [
    {
        title: 'Dashboard',
        icon: 'space_dashboard',
        content: (
            <>
                <p>Your central hub for a quick financial overview.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li>🎨 <strong>Customizable Widgets:</strong> Arrange, resize, and add widgets to create a dashboard that suits your needs. Enter 'Edit Layout' mode to customize.</li>
                    <li>📊 <strong>Dynamic Filters:</strong> Filter your entire dashboard view by multiple accounts and time duration.</li>
                    <li>📈 <strong>Key Metrics:</strong> At-a-glance cards for Income, Expenses, Net Balance, and Net Worth. New cards show your lowest projected balance and credit card statement summaries.</li>
                    <li>🔗 <strong>Transaction Matcher:</strong> Finaura automatically detects potential transfers between your accounts and prompts you to link them for accurate reporting.</li>
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
                    <li>🏦 <strong>Detailed Account Types:</strong> Add various types of accounts, including Checking, Savings, Investments, Loans, Property, and Vehicles, each with specialized fields.</li>
                    <li>✨ <strong>Manual Sorting:</strong> On the Accounts page, you can sort by name or balance, or choose 'Manual' to drag-and-drop accounts into your preferred order.</li>
                    <li>🧾 <strong>Transactions:</strong> Log expenses, income, or transfers. Use the powerful bulk editing features on the Transactions page to modify multiple items at once.</li>
                     <li>🔎 <strong>Account Detail View:</strong> Click on any account to see a dedicated, customizable dashboard with detailed charts and transaction history for that specific account.</li>
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
                    <li>🔮 <strong>Cash Flow Projection:</strong> Visualize your projected cash balance over different time horizons (3M, 1Y, 2Y) based on your recurring transactions.</li>
                    <li>🎯 <strong>Financial Goals:</strong> Create savings goals (e.g., 'Vacation Fund') or plan for large one-time expenses. The forecast will show if you're on track to meet them.</li>
                    <li>🤖 <strong>AI Smart Planner:</strong> Use the 'Generate Smart Plan' feature to get an AI-powered contribution strategy to help you reach your goals faster, prioritizing those that are at-risk.</li>
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
                    <li>💹 <strong>Investments:</strong> Log buy/sell transactions for stocks, crypto, and other assets to see your portfolio distribution, cost basis, and total gain/loss.</li>
                    <li>📜 <strong>Warrants:</strong> Specifically designed to track employee warrant grants. You can configure a web scraper to automatically fetch and update the current price for each warrant ISIN.</li>
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
                    <li>🔄 <strong>Recurring Transactions:</strong> Set up recurring income (like salary) and expenses (like subscriptions) to automate entries and improve forecast accuracy.</li>
                    <li>💵 <strong>Bills & Payments:</strong> Track one-time bills or expected deposits. Mark them as paid to automatically create a corresponding transaction.</li>
                    <li>🗓️ <strong>Calendar Heatmap:</strong> Visualize your upcoming financial events for the next 12 months.</li>
                </ul>
            </>
        )
    },
     {
        title: 'Tasks & Tags',
        icon: 'task_alt',
        content: (
            <>
                <p>Organize your financial life beyond transactions.</p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li>✅ <strong>Tasks:</strong> Create and manage your financial to-do list. Assign priorities and due dates, and track your progress on a Kanban board and a priority heatmap.</li>
                    <li>🏷️ <strong>Tags:</strong> Group related transactions across different categories. For example, create a "Vacation 2024" tag to track all spending for a specific trip.</li>
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
                    <li>🧙‍♂️ <strong>Advanced CSV Import:</strong> Use the powerful step-by-step wizard to import transactions or accounts from a CSV file. It automatically maps columns, detects formats, and allows you to clean and validate data before publishing.</li>
                    <li>💾 <strong>Full Backup & Restore:</strong> Create a complete JSON backup of all your app data and restore it when needed.</li>
                    <li>📤 <strong>CSV Export:</strong> Export your accounts, transactions, budgets, and more to separate CSV files.</li>
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

// FIX: Changed to a named export for consistency.
export const Documentation: React.FC<DocumentationProps> = ({ setCurrentPage }) => {
    const [activeSection, setActiveSection] = useState(features[0].title);

    // FIX: Refactored to use a more robust ref callback pattern, which resolves the TypeScript errors.
    // This approach stores the DOM elements directly in the ref object.
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

    useEffect(() => {
        const observerOptions = {
            rootMargin: '-30% 0px -70% 0px',
            threshold: 0,
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    const matchingFeature = features.find(f => f.title.replace(/\s+/g, '-').toLowerCase() === id);
                    if (matchingFeature) {
                        setActiveSection(matchingFeature.title);
                    }
                }
            });
        }, observerOptions);
        
        const currentRefs = sectionRefs.current;
        Object.values(currentRefs).forEach(el => {
            // FIX: Use `instanceof HTMLElement` to ensure `el` is correctly typed as an Element, resolving the "Argument of type 'unknown' is not assignable" error.
            if (el instanceof HTMLElement) {
                observer.observe(el);
            }
        });

        return () => {
             Object.values(currentRefs).forEach(el => {
                // FIX: Use `instanceof HTMLElement` to ensure `el` is correctly typed as an Element, resolving the "Argument of type 'unknown' is not assignable" error.
                if (el instanceof HTMLElement) {
                    observer.unobserve(el);
                }
            });
        };
    }, []);

    const handleNavClick = (title: string) => {
        // FIX: The ref now holds the element directly, so we access it and call scrollIntoView.
        // This removes the need for the extra `.current` access that was causing errors.
        sectionRefs.current[title]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    };

    return (
        <div className="max-w-7xl mx-auto">
            <header className="mb-12">
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                        <span> / </span>
                        <span className="text-light-text dark:text-dark-text font-medium">Documentation</span>
                    </div>
                </div>
                <div className="text-center">
                    <h1 className="text-5xl font-bold mb-4 text-light-text dark:text-dark-text">Documentation</h1>
                    <p className="text-lg text-light-text-secondary dark:text-dark-text-secondary max-w-2xl mx-auto">
                        Find everything you need to know about Finaura's features. Browse the topics below to get started.
                    </p>
                </div>
            </header>
            
            <nav className="my-12">
                <ul className="flex flex-wrap justify-center gap-3">
                    {features.map(feature => (
                        <li key={feature.title}>
                            <button
                                onClick={() => handleNavClick(feature.title)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors duration-200 ${
                                    activeSection === feature.title
                                        ? 'bg-primary-500 text-white font-semibold'
                                        : 'bg-light-bg dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary hover:bg-primary-100 dark:hover:bg-primary-900/50'
                                }`}
                            >
                                <span className="material-symbols-outlined text-base">{feature.icon}</span>
                                <span className="text-sm font-medium">{feature.title}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            <main className="max-w-4xl mx-auto space-y-10">
                {features.map(feature => (
                    <section
                        key={feature.title}
                        id={feature.title.replace(/\s+/g, '-').toLowerCase()}
                        // FIX: Using a ref callback to populate the refs object.
                        // FIX: Completed the truncated file content, which was causing a syntax error and the "Cannot find name 'el'" error.
                        ref={(element) => (sectionRefs.current[feature.title] = element)}
                    >
                        <Card>
                            <div className="prose dark:prose-invert max-w-none prose-p:text-light-text-secondary prose-p:dark:text-dark-text-secondary prose-li:text-light-text-secondary prose-li:dark:text-dark-text-secondary">
                                <h2 className="!text-3xl !mb-4 flex items-center gap-3 !text-light-text !dark:text-dark-text">
                                    <span className="material-symbols-outlined text-primary-500 !text-3xl">{feature.icon}</span>
                                    {feature.title}
                                </h2>
                                {feature.content}
                            </div>
                        </Card>
                    </section>
                ))}
            </main>
        </div>
    );
};
