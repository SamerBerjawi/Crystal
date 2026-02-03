

import React, { useState, useEffect, useRef } from 'react';
import { Page } from '../types';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

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
            <div className="space-y-4">
                <p className="text-lg leading-relaxed">
                    Welcome to Crystal! This guide will help you set up your financial workspace quickly and efficiently.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                        <h4 className="font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">login</span> Authentication
                        </h4>
                        <p className="text-sm">Sign up for a secure account or use the <strong>Demo Mode</strong> to explore features with sample data without any commitment.</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                        <h4 className="font-bold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">check_circle</span> Onboarding
                        </h4>
                        <p className="text-sm">Our wizard guides you through setting your base currency, adding your first account, and creating a budget goal.</p>
                    </div>
                </div>

                <div className="mt-6">
                    <h4 className="font-semibold text-light-text dark:text-dark-text mb-2">Data Privacy</h4>
                    <p>
                        Your data is persisted locally in your browser for performance. You can also perform a full 
                        <strong> JSON Backup</strong> at any time from the Data Management page to secure your records or migrate devices.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'dashboard',
        title: 'Dashboard',
        icon: 'space_dashboard',
        iconColor: 'text-purple-500',
        content: (
            <div className="space-y-4">
                <p>
                    Your financial command center. The dashboard is designed to be modular and customizable, giving you an instant overview of your net worth, cash flow, and recent activity.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2 text-light-text-secondary dark:text-dark-text-secondary">
                    <li><strong>Edit Layout:</strong> Click the "Edit Layout" button to enter customization mode. You can drag, drop, and resize widgets to build your perfect view.</li>
                    <li><strong>Global Filtering:</strong> Use the filters at the top to slice your data by specific accounts or time ranges (e.g., "Last 30 Days", "Year to Date").</li>
                    <li><strong>Smart Insights:</strong> Widgets like "Cash Flow" and "Net Worth" automatically update based on your selected filters.</li>
                </ul>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border-l-4 border-yellow-400 text-sm mt-4">
                    <strong>Pro Tip:</strong> Try adding the "Transaction Map" widget to visualize your spending locations!
                </div>
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
                    Crystal supports a wide variety of account types to mirror your real-world portfolio.
                </p>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-white/5 font-semibold">
                            <tr>
                                <th className="p-2 rounded-tl-md">Type</th>
                                <th className="p-2 rounded-tr-md">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            <tr><td className="p-2 font-medium">Liquid</td><td className="p-2 text-gray-500">Checking, Savings, Cash. Used for day-to-day spending.</td></tr>
                            <tr><td className="p-2 font-medium">Credit</td><td className="p-2 text-gray-500">Credit Cards with limit tracking and billing cycle management.</td></tr>
                            <tr><td className="p-2 font-medium">Assets</td><td className="p-2 text-gray-500">Property, Vehicles, and other high-value items with depreciation/appreciation tracking.</td></tr>
                            <tr><td className="p-2 font-medium">Investments</td><td className="p-2 text-gray-500">Stocks, ETFs, Crypto, and Warrants.</td></tr>
                        </tbody>
                    </table>
                </div>
                <p className="mt-2">
                    <strong>Transaction Matching:</strong> The system automatically detects potential transfers between accounts (e.g., a debit in Checking matching a credit in Savings) and suggests linking them to keep your records clean.
                </p>
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
                    Move away from rigid spreadsheets. Crystal's budgeting is flexible and intelligent.
                </p>
                <ul className="space-y-3">
                    <li className="flex gap-3">
                        <span className="material-symbols-outlined text-primary-500">auto_awesome</span>
                        <div>
                            <strong>Auto Suggestions:</strong> Tap the "Auto-Calculate" button to analyze your last 3 months of spending and auto-generate realistic budget limits for each category.
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="material-symbols-outlined text-primary-500">notifications_active</span>
                        <div>
                            <strong>Visual Alerts:</strong> Progress bars turn yellow (warning) or red (over budget) as you spend, giving you instant feedback on your financial health.
                        </div>
                    </li>
                </ul>
            </div>
        )
    },
    {
        id: 'forecasting',
        title: 'Forecasting',
        icon: 'show_chart',
        iconColor: 'text-indigo-500',
        content: (
            <div className="space-y-4">
                <p>
                    Predict your future balance based on your scheduled income, bills, and savings goals.
                </p>
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg">
                    <h5 className="font-semibold mb-2">How it works:</h5>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <li>Define your <strong>Recurring Transactions</strong> (Salary, Rent, Netflix).</li>
                        <li>Set <strong>Financial Goals</strong> (Vacation, Emergency Fund).</li>
                        <li>Crystal projects your daily balance up to 2 years into the future.</li>
                    </ol>
                </div>
                <p>
                    This allows you to spot potential cash flow issues ("Will I go overdraft next month?") or opportunities to invest more.
                </p>
            </div>
        )
    },
    {
        id: 'investments',
        title: 'Investments',
        icon: 'candlestick_chart',
        iconColor: 'text-cyan-500',
            content: (
            <div className="space-y-4">
                <p>
                    Track your portfolio performance with manually maintained prices.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Standard Assets:</strong> Enter and update stock and crypto prices yourself to keep valuations current.</li>
                    <li><strong>Warrants:</strong> Specialized tracking for employee equity grants with manual price inputs for each grant.</li>
                    <li><strong>Analysis:</strong> View asset allocation pie charts and track your total gains/losses over time.</li>
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
            <header className="mb-12 pt-4 space-y-6">
                <div className="flex items-center gap-3 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <button onClick={() => setCurrentPage('Settings')} className="hover:text-primary-500 flex items-center gap-1 transition-colors">
                         <span className="material-symbols-outlined text-base">arrow_back</span> Settings
                    </button>
                    <span>/</span>
                    <span className="text-light-text dark:text-dark-text font-medium">Documentation</span>
                </div>
                <PageHeader
                  markerIcon="menu_book"
                  markerLabel="Help Library"
                  title="Documentation"
                  subtitle="How-to guides, release notes, and implementation tips at your fingertips."
                />
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
                                <span className={`material-symbols-outlined text-[18px] ${activeSection === section.id ? 'opacity-100' : 'opacity-0'}`}>
                                    chevron_right
                                </span>
                                {section.title}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Mobile Navigation (Dropdown style or Horizontal Scroll) */}
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
                            // FIX: Changed the ref callback to a block body to avoid returning a value, which is not allowed for callback refs.
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