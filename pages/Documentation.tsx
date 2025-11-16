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
                <p>Your financial command center. Get an instant, high-level overview of your finances tailored to what matters most to you.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Build Your Perfect View:</strong> Customize your dashboard with modular widgets. Simply enter 'Edit Layout' mode to drag, drop, and resize components for a personalized experience.</li>
                    <li><strong>Dynamic Filtering:</strong> Instantly filter your entire dashboard by any combination of accounts and timeframes to slice and dice your data.</li>
                    <li><strong>Intelligent Transaction Matching:</strong> Effortlessly clean up your records. Our system automatically finds and links transfers between your accounts, ensuring perfect accuracy.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Accounts & Transactions',
        icon: 'wallet',
        content: (
            <>
                <p>The foundation of your financial picture. Manage all your accounts and transactions with precision and ease.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Track Everything:</strong> From checking and savings to complex loans, properties, and investment portfolios, our detailed account types have you covered.</li>
                    <li><strong>Organize Your Way:</strong> Sort accounts by name or balance, or create a custom order with simple drag-and-drop in 'Manual' sort mode.</li>
                    <li><strong>Master Your History:</strong> Utilize advanced multi-select filters and powerful bulk-editing tools to manage your transaction data efficiently.</li>
                    <li><strong>Dive Deeper:</strong> Click any account to access a dedicated, customizable dashboard with a focused view of its performance and history.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Budgeting',
        icon: 'pie_chart',
        content: (
             <>
                <p>Master your spending with intelligent budgeting tools designed for clarity and control.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Budget Smarter, Not Harder:</strong> Get AI-powered budget suggestions based on your actual spending habits to set realistic and achievable goals.</li>
                    <li><strong>Effortless Expense Tracking:</strong> All spending is categorized automatically, allowing you to set formal budgets only where you need them.</li>
                    <li><strong>Stay on Track with Real-Time Progress:</strong> Instantly see how your spending compares to your budget with clear, visual feedback.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Forecasting',
        icon: 'show_chart',
        content: (
            <>
                <p>See your financial future and make informed decisions with powerful projection and planning tools.</p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Project Your Cash Flow:</strong> Visualize your estimated balance weeks, months, or even years ahead based on your recurring transactions and goals.</li>
                    <li><strong>Plan for What's Next:</strong> Set, track, and manage financial goals, from one-time expenses to long-term savings. Organize related items into "buckets" for clarity.</li>
                    <li><strong>Achieve Goals Faster:</strong> Use the AI Smart Planner to get an intelligent, step-by-step contribution plan that prioritizes your goals and maximizes your savings potential.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Investments & Warrants',
        icon: 'candlestick_chart',
        content: (
            <>
                <p>Monitor and manage your investment portfolio with detailed tracking and automated tools.</p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>See the Complete Picture:</strong> Log buy and sell transactions for stocks, crypto, and other assets to track performance, cost basis, and total gains.</li>
                    <li><strong>Specialized Warrant Tracking:</strong> A dedicated tool for employee warrants, complete with a configurable web scraper to automatically fetch and update live prices.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Schedule & Bills',
        icon: 'calendar_month',
        content: (
            <>
                <p>Stay ahead of your financial obligations by automating and visualizing your upcoming payments.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Automate Your Cash Flow:</strong> Schedule recurring income and expenses to streamline data entry and improve forecast accuracy. Easily edit or skip single occurrences.</li>
                    <li><strong>Get a Complete Financial Picture:</strong> Crystal automatically creates scheduled payments for your loans and credit cards, giving you a comprehensive view of your upcoming cash flow.</li>
                    <li><strong>Manage One-Time Payments:</strong> Track individual bills and deposits, and mark them as paid to automatically generate a corresponding transaction.</li>
                    <li><strong>Visualize Your Year Ahead:</strong> A 12-month calendar heatmap provides an at-a-glance view of your scheduled financial activity.</li>
                </ul>
            </>
        )
    },
     {
        title: 'Tasks & Tags',
        icon: 'task_alt',
        content: (
            <>
                <p>Organize your financial life beyond transactions with powerful, flexible tools.</p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Stay on Top of Your Admin:</strong> Create a financial to-do list, assign priorities, and manage tasks with an intuitive Kanban board and priority heatmap.</li>
                    <li><strong>Connect Your Spending:</strong> Use tags to group related transactions across any category—perfect for tracking project costs or vacation spending.</li>
                </ul>
            </>
        )
    },
    {
        title: 'Data Management',
        icon: 'database',
        content: (
            <>
                <p>Your data, your rules. Import, export, and manage your financial information with complete control.</p>
                 <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Import with Ease:</strong> A powerful, step-by-step wizard for CSV imports that automatically maps columns, detects formats, and lets you clean data before publishing.</li>
                    <li><strong>Full Backup & Restore:</strong> Export a complete JSON snapshot of your data for backup or migration, and restore it anytime.</li>
                    <li><strong>Flexible CSV Exports:</strong> Export specific data sets like accounts, transactions, or budgets to individual CSV files.</li>
                </ul>
            </>
        )
    },
    {
        title: 'AI Assistant',
        icon: 'smart_toy',
        content: (
            <p>Your personal finance expert is just a click away. Tap the chat icon to interact with our AI assistant, powered by Google's Gemini models. Ask questions in plain language—"How much did I spend on groceries last month?" or "What's my biggest budget category?"—and get instant, insightful answers based on your data.</p>
        )
    },
    {
        title: 'Branding & Identity',
        icon: 'palette',
        content: (
            <>
                <p>The philosophy behind Crystal's design is to embody clarity, energy, and foresight.</p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>The Name:</strong> "Crystal" evokes the idea of a crystal ball, symbolizing our commitment to providing a clear, insightful view into your financial future.</li>
                    <li><strong>The Logo:</strong> A modern, minimalist crystal ball, representing focus, clarity, and the power to see what's ahead.</li>
                    <li><strong>The Palette:</strong> A vibrant gradient of orange and red serves as a powerful accent, signifying energy and drawing attention to key insights. The broader UI uses this palette to maintain a consistent and distinctive identity.</li>
                </ul>
            </>
        )
    }
];

export const Documentation: React.FC<DocumentationProps> = ({ setCurrentPage }) => {
    const [activeSection, setActiveSection] = useState(features[0].title);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ [features[0].title]: true });
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);

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
            if (el instanceof HTMLElement) {
                observer.observe(el);
            }
        });

        return () => {
             Object.values(currentRefs).forEach(el => {
                if (el instanceof HTMLElement) {
                    observer.unobserve(el);
                }
            });
        };
    }, []);

    const handleNavClick = (title: string) => {
        sectionRefs.current[title]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        setOpenSections(prev => ({ ...prev, [title]: true }));
    };

    const toggleSection = (title: string) => {
        setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
    };
    
    const handleBackToTop = () => {
        const mainContent = containerRef.current?.closest('main');
        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="max-w-7xl mx-auto" ref={containerRef}>
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
                        Find everything you need to know about Crystal's features. Browse the topics below to get started.
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

            <main className="max-w-4xl mx-auto space-y-6">
                {features.map(feature => {
                    const isOpen = !!openSections[feature.title];
                    const sectionId = feature.title.replace(/\s+/g, '-').toLowerCase();

                    return (
                        <section
                            key={feature.title}
                            id={sectionId}
                            // FIX: Changed the ref callback to a block body to avoid returning a value, which is not allowed for callback refs.
                            ref={(element) => { sectionRefs.current[feature.title] = element; }}
                        >
                            <Card className="p-0 overflow-hidden transition-all duration-300">
                                <button
                                    onClick={() => toggleSection(feature.title)}
                                    className="w-full text-left p-6 flex justify-between items-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    aria-expanded={isOpen}
                                    aria-controls={`content-${sectionId}`}
                                >
                                    <h2 className="text-2xl lg:text-3xl flex items-center gap-4 text-light-text dark:text-dark-text font-bold">
                                        <span className="material-symbols-outlined text-primary-500 text-3xl">{feature.icon}</span>
                                        {feature.title}
                                    </h2>
                                    <span className={`material-symbols-outlined text-3xl text-light-text-secondary dark:text-dark-text-secondary transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </button>
                                
                                <div
                                    id={`content-${sectionId}`}
                                    className={`transition-all duration-500 ease-in-out grid ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="px-6 pb-6 pt-2">
                                            <div className="prose dark:prose-invert max-w-none prose-p:leading-loose prose-p:mb-8 prose-li:leading-loose prose-li:my-4 prose-li:marker:text-primary-500 prose-headings:font-semibold prose-headings:text-light-text prose-headings:dark:text-dark-text prose-p:text-light-text-secondary prose-p:dark:text-dark-text-secondary prose-li:text-light-text-secondary prose-li:dark:text-dark-text-secondary">
                                                {feature.content}
                                            </div>
                                            <div className="mt-8 pt-4 border-t border-black/10 dark:border-white/10 text-right">
                                                <button
                                                    onClick={handleBackToTop}
                                                    className="text-sm font-semibold text-primary-500 hover:underline flex items-center gap-1 ml-auto"
                                                >
                                                    <span className="material-symbols-outlined text-base">arrow_upward</span>
                                                    Back to Top
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </section>
                    );
                })}
            </main>
        </div>
    );
};
