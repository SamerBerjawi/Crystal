
import React, { useState, useEffect, useRef } from 'react';
import { Page } from '../types';
import Card from '../components/Card';

interface DocumentationProps {
  setCurrentPage: (page: Page) => void;
}

interface Section {
    id: string;
    title: string;
    icon: string;
    iconColor: string;
    content: React.ReactNode;
}

const sections: Section[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: 'rocket_launch',
        iconColor: 'text-blue-500',
        content: (
            <div className="space-y-6">
                <p className="text-lg leading-relaxed">
                    Welcome to <strong>Crystal</strong>, your comprehensive financial command center. Crystal is designed to give you clarity on your past, control over your present, and foresight into your future.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                        <h4 className="font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">shield</span> Privacy First
                        </h4>
                        <p className="text-sm leading-relaxed">
                            Crystal is built on a <strong>local-first</strong> philosophy. While we provide a secure backend for synchronization, your financial calculations happen right in your browser. We prioritize data sovereignty—you can export your entire workspace at any time.
                        </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-xl border border-purple-100 dark:border-purple-800">
                        <h4 className="font-bold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">science</span> Demo Mode
                        </h4>
                        <p className="text-sm leading-relaxed">
                            Want to look around safely? Use <strong>Demo Mode</strong> on the login screen. It populates the app with realistic sample data so you can test features like Forecasting and AI without entering your own info.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'dashboard',
        title: 'Dashboard',
        icon: 'space_dashboard',
        iconColor: 'text-indigo-500',
        content: (
            <div className="space-y-4">
                <p>
                    The Dashboard is your customizable landing page. It provides a modular view of your financial health.
                </p>
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 space-y-3">
                    <h5 className="font-semibold text-sm uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Key Widgets</h5>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary-500 text-sm">account_balance</span> <strong>Net Worth:</strong> Real-time aggregation of assets vs. debts.</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary-500 text-sm">timeline</span> <strong>Cash Flow:</strong> Income vs. Expense trends.</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary-500 text-sm">public</span> <strong>Transaction Map:</strong> Heatmap of spending locations.</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary-500 text-sm">sync_alt</span> <strong>Sankey Diagram:</strong> Visual flow of money source to destination.</li>
                    </ul>
                </div>
                <p className="text-sm">
                    <strong>Customization:</strong> Click the "Edit Layout" button to drag, drop, resize, or remove widgets to fit your workflow.
                </p>
            </div>
        )
    },
    {
        id: 'accounts',
        title: 'Accounts',
        icon: 'wallet',
        iconColor: 'text-emerald-500',
        content: (
            <div className="space-y-4">
                <p>
                    Track every aspect of your portfolio, from cash in your pocket to complex mortgages.
                </p>
                <div className="overflow-x-auto border border-black/5 dark:border-white/5 rounded-lg">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-white/5 font-semibold">
                            <tr>
                                <th className="p-3">Account Type</th>
                                <th className="p-3">Advanced Features</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            <tr><td className="p-3 font-medium">Loans</td><td className="p-3 text-gray-500">Built-in <strong>amortization schedules</strong>. Calculates principal vs. interest splits automatically.</td></tr>
                            <tr><td className="p-3 font-medium">Properties</td><td className="p-3 text-gray-500">Tracks equity, appreciation, and links directly to mortgages for <strong>LTV (Loan-to-Value)</strong> ratios.</td></tr>
                            <tr><td className="p-3 font-medium">Vehicles</td><td className="p-3 text-gray-500">Mileage logging, depreciation tracking, and lease management (mileage allowances, penalties).</td></tr>
                            <tr><td className="p-3 font-medium">Credit Cards</td><td className="p-3 text-gray-500">Statement cycle tracking, utilization alerts, and payment due dates.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )
    },
    {
        id: 'transactions',
        title: 'Transactions',
        icon: 'receipt_long',
        iconColor: 'text-blue-500',
        content: (
            <div className="space-y-4">
                <p>
                    The ledger for all your financial activity. Crystal offers powerful tools to keep this organized.
                </p>
                <ul className="space-y-2 text-sm">
                     <li className="flex gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">autorenew</span>
                        <span>
                            <strong>Transfer Matching:</strong> The system automatically detects transfers between accounts (e.g., a debit in Checking matching a credit in Savings) and suggests linking them to prevent double-counting.
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">edit_note</span>
                        <span>
                            <strong>Bulk Actions:</strong> Select multiple transactions to categorize, tag, or delete them in one go.
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="material-symbols-outlined text-primary-500 text-lg">location_on</span>
                        <span>
                            <strong>Location Tagging:</strong> Add city/country data to transactions to populate the Map Widget.
                        </span>
                    </li>
                </ul>
            </div>
        )
    },
    {
        id: 'subscriptions',
        title: 'Subscriptions & Loyalty',
        icon: 'loyalty',
        iconColor: 'text-pink-500',
        content: (
            <div className="space-y-4">
                <p>
                    Manage your recurring life and rewards in one place.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-pink-50 dark:bg-pink-900/10 rounded-xl border border-pink-100 dark:border-pink-900/30">
                        <h5 className="font-bold text-pink-700 dark:text-pink-300 mb-2">Recurring Payments</h5>
                        <p className="text-sm">
                            Crystal scans your transaction history to <strong>automatically detect</strong> subscriptions (Netflix, Gym, Spotify) based on amount and frequency patterns. You can convert these into tracked items for forecasting.
                        </p>
                    </div>
                     <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                        <h5 className="font-bold text-orange-700 dark:text-orange-300 mb-2">Loyalty Wallet</h5>
                        <p className="text-sm">
                            A digital wallet for your rewards programs. Store membership IDs, track point balances, monitor tier status (Silver, Gold), and keep support numbers handy.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'budgeting',
        title: 'Budgeting',
        icon: 'pie_chart',
        iconColor: 'text-orange-500',
        content: (
            <div className="space-y-4">
                <p>
                    Set limits and track spending by category.
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <li><strong>AI Advice:</strong> Use the "AI Advice" button to analyze your last 3 months of spending and generate realistic budget recommendations.</li>
                    <li><strong>Quick Create:</strong> Instantly generate budgets based on historical averages (Last Month, 3-Month Avg, etc.).</li>
                    <li><strong>Visual Alerts:</strong> Progress bars change color (Green → Yellow → Red) as you approach your limits.</li>
                </ul>
            </div>
        )
    },
    {
        id: 'forecasting',
        title: 'Forecasting',
        icon: 'show_chart',
        iconColor: 'text-cyan-500',
        content: (
            <div className="space-y-4">
                <p>
                    The "Crystal Ball" feature. We project your daily balance up to 2 years into the future.
                </p>
                <div className="p-4 bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border border-cyan-100 dark:border-cyan-900/30">
                    <h5 className="font-semibold mb-2 text-cyan-800 dark:text-cyan-200">How Projection Works</h5>
                    <p className="text-sm mb-2">The engine combines:</p>
                    <ol className="list-decimal list-inside text-sm space-y-1 ml-2">
                        <li><strong>Recurring Transactions:</strong> Salary, Rent, Subscriptions.</li>
                        <li><strong>Bills:</strong> One-off scheduled payments.</li>
                        <li><strong>Financial Goals:</strong> Target savings dates are treated as "expense events" to ensure you have liquidity.</li>
                        <li><strong>Smart Logic:</strong> Auto-adjusts for weekends and bank holidays.</li>
                    </ol>
                </div>
                <p className="text-sm">
                    This helps you answer questions like <em>"Will I go into overdraft in November if I buy this car today?"</em>
                </p>
            </div>
        )
    },
    {
        id: 'investments',
        title: 'Investments & Warrants',
        icon: 'candlestick_chart',
        iconColor: 'text-purple-500',
        content: (
            <div className="space-y-4">
                <p>
                    Track your portfolio performance with support for complex asset types.
                </p>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-3 items-start">
                         <span className="material-symbols-outlined text-purple-500 mt-0.5">query_stats</span>
                         <div>
                             <strong>Standard Assets:</strong> Stocks, ETFs, and Crypto. Track cost basis, current value, and unrealized gains.
                         </div>
                    </div>
                     <div className="flex gap-3 items-start">
                         <span className="material-symbols-outlined text-purple-500 mt-0.5">card_membership</span>
                         <div>
                             <strong>Employee Warrants:</strong> A specialized feature for tracking unvested or vested equity grants. Track grant price vs. current price to see the "in-the-money" value.
                         </div>
                    </div>
                     <div className="flex gap-3 items-start">
                         <span className="material-symbols-outlined text-purple-500 mt-0.5">web</span>
                         <div>
                             <strong>Price Scrapers:</strong> For assets without public APIs (like private equity or niche funds), you can configure a visual scraper to fetch prices from a specific URL automatically.
                         </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'tasks',
        title: 'Tasks',
        icon: 'task_alt',
        iconColor: 'text-red-500',
        content: (
            <div className="space-y-4">
                <p>
                    Financial management involves chores. The Tasks module is a Kanban-style board to track these to-dos.
                </p>
                <ul className="list-disc list-inside text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <li><strong>Status Tracking:</strong> To Do, In Progress, Done.</li>
                    <li><strong>Priorities:</strong> High, Medium, Low priority tagging.</li>
                    <li><strong>Deadlines:</strong> Set due dates and reminders for tax filings, bill payments, or cancellations.</li>
                    <li><strong>Consistency:</strong> A "Consistency Heatmap" visualizes your productivity over the year.</li>
                </ul>
            </div>
        )
    },
    {
        id: 'ai-assistant',
        title: 'AI Assistant',
        icon: 'smart_toy',
        iconColor: 'text-fuchsia-500',
        content: (
            <div className="space-y-4">
                <p>
                    Crystal integrates with Google's <strong>Gemini</strong> models to provide a conversational financial analyst.
                </p>
                <div className="bg-gradient-to-r from-fuchsia-50 to-purple-50 dark:from-fuchsia-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-fuchsia-100 dark:border-fuchsia-800/30">
                    <p className="font-semibold text-fuchsia-900 dark:text-fuchsia-100 mb-2">Capabilities:</p>
                    <ul className="space-y-2 text-sm">
                        <li>💬 <strong>Chat:</strong> "How much did I spend on dining out last month vs. this month?"</li>
                        <li>📉 <strong>Budgeting:</strong> "Analyze my spending and suggest a realistic budget for groceries."</li>
                        <li>📅 <strong>Planning:</strong> "Create a step-by-step contribution plan to reach my Emergency Fund goal by December."</li>
                    </ul>
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">
                    * Requires a valid Google Gemini API Key configured in Settings.
                </p>
            </div>
        )
    },
    {
        id: 'data-management',
        title: 'Data Management',
        icon: 'database',
        iconColor: 'text-gray-500',
        content: (
            <div className="space-y-4">
                <p>
                    You are in control of your data.
                </p>
                <ul className="list-disc list-inside text-sm">
                    <li><strong>Import Wizard:</strong> A powerful CSV importer that maps columns, cleans data, and detects duplicates.</li>
                    <li><strong>Export:</strong> Download all your transactions, accounts, or budgets as CSV files for use in Excel/Numbers.</li>
                    <li><strong>Backup & Restore:</strong> Create a full JSON snapshot of your entire workspace state. Perfect for migrating to a new device.</li>
                    <li><strong>Reset:</strong> A "nuclear option" to wipe all data and start fresh is available in the Danger Zone.</li>
                </ul>
            </div>
        )
    }
];

const Documentation: React.FC<DocumentationProps> = ({ setCurrentPage }) => {
    const [activeSection, setActiveSection] = useState(sections[0].id);
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

    // Scroll Spy Logic
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + 150; // Offset for header

            for (const section of sections) {
                const element = sectionRefs.current[section.id];
                if (element) {
                    const offsetTop = element.offsetTop;
                    const offsetHeight = element.offsetHeight;

                    if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                        setActiveSection(section.id);
                        break;
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        const element = sectionRefs.current[id];
        if (element) {
            const yOffset = -100; // Header height offset
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    const handleBackToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="max-w-7xl mx-auto animate-fade-in-up pb-24 relative">
            {/* Header */}
            <header className="mb-12 pt-4">
                <div className="flex items-center gap-3 mb-6 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <button onClick={() => setCurrentPage('Settings')} className="hover:text-primary-500 flex items-center gap-1 transition-colors">
                         <span className="material-symbols-outlined text-base">arrow_back</span> Settings
                    </button>
                    <span>/</span>
                    <span className="text-light-text dark:text-dark-text font-medium">Documentation</span>
                </div>
                <div className="text-center md:text-left">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600 dark:from-primary-400 dark:to-purple-400 mb-4">
                        Documentation
                    </h1>
                    <p className="text-lg text-light-text-secondary dark:text-dark-text-secondary max-w-2xl">
                        Master your finances with Crystal. Explore features, learn workflows, and unlock the full potential of your dashboard.
                    </p>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row gap-12">
                {/* Sticky Navigation Sidebar */}
                <aside className="hidden lg:block w-64 flex-shrink-0">
                    <div className="sticky top-24 space-y-1">
                        <p className="px-4 mb-2 text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                            Contents
                        </p>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => scrollToSection(section.id)}
                                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-3 ${
                                    activeSection === section.id
                                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 translate-x-1'
                                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-light-text dark:hover:text-dark-text'
                                }`}
                            >
                                <span className={`material-symbols-outlined text-[18px] ${activeSection === section.id ? 'opacity-100' : 'opacity-0 transition-opacity'}`}>
                                    chevron_right
                                </span>
                                {section.title}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Mobile Navigation (Horizontal Scroll) */}
                <div className="lg:hidden overflow-x-auto pb-4 -mx-4 px-4 flex gap-2 snap-x no-scrollbar">
                     {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => scrollToSection(section.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                                activeSection === section.id
                                    ? 'bg-primary-500 text-white border-primary-500'
                                    : 'bg-white dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary border-black/10 dark:border-white/10'
                            }`}
                        >
                            {section.title}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 space-y-12">
                    {sections.map(section => (
                        <section 
                            key={section.id} 
                            id={section.id} 
                            ref={(el) => { sectionRefs.current[section.id] = el; }}
                            className="scroll-mt-24"
                        >
                            <Card className="p-0 overflow-hidden border-l-4 border-l-transparent hover:border-l-primary-500 transition-all duration-300">
                                <div className="p-6 md:p-8">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className={`w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${section.iconColor}`}>
                                            <span className="material-symbols-outlined text-3xl">{section.icon}</span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">{section.title}</h2>
                                    </div>
                                    <div className="prose dark:prose-invert max-w-none text-light-text dark:text-dark-text leading-relaxed">
                                        {section.content}
                                    </div>
                                </div>
                            </Card>
                        </section>
                    ))}

                    <div className="flex justify-center pt-8">
                        <button 
                            onClick={handleBackToTop}
                            className="flex items-center gap-2 px-6 py-3 rounded-full bg-light-fill dark:bg-dark-fill hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary transition-colors font-medium text-sm"
                        >
                            <span className="material-symbols-outlined">arrow_upward</span>
                            Back to Top
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Documentation;
