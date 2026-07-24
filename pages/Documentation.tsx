

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
        title: 'System Initialization',
        icon: 'terminal',
        iconColor: 'text-blue-500',
        content: (
            <div className="space-y-6">
                <p className="text-[14px] leading-relaxed opacity-80 font-medium">
                    Crystal operates as a high-fidelity financial telemetry system. Initialization allows you to establish a secure data perimeter and define your primary currency standards.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <div className="bg-black/[0.02] dark:bg-white/[0.02] p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">security</span>
                        </div>
                        <h4 className="font-bold text-[10px] tracking-tight opacity-40">Security Protocol</h4>
                        <p className="text-xs font-bold leading-relaxed">Establish a baseline using <strong>Demo Mode</strong> to simulate ledger operations, or register a persistent cloud node for live data tracking.</p>
                    </div>
                    <div className="bg-black/[0.02] dark:bg-white/[0.02] p-6 rounded-3xl border border-black/5 dark:border-white/5 space-y-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">database</span>
                        </div>
                        <h4 className="font-bold text-[10px] tracking-tight opacity-40">Local Persistence</h4>
                        <p className="text-xs font-bold leading-relaxed">By default, all telemetry resides within your browser's encrypted sandbox. No data leaves your secure perimeter unless explicitly synchronized.</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'dashboard',
        title: 'Command Center',
        icon: 'monitoring',
        iconColor: 'text-purple-500',
        content: (
            <div className="space-y-6">
                <p className="text-[14px] leading-relaxed opacity-80 font-medium">
                    The Dashboard serves as your multi-dimensional Command Center. It provides real-time visualization of your financial state through a modular, widget-based architecture.
                </p>
                <div className="space-y-4">
                    {[
                        { title: 'Dynamic Layouts', desc: 'Engage "Interface Modification Mode" to reorganize, resize, and prioritize data widgets based on your current operational needs.' },
                        { title: 'Global Time-Slicing', desc: 'Sync all visual nodes to specific temporal windows. From "Last 24h" to "Full Fiscal Year" snapshots.' },
                        { title: 'Heatmap Telemetry', desc: 'Visualize spending density through geographic and categorical heatmaps for instant pattern recognition.' }
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-2xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/5">
                            <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">0{i+1}</div>
                            <div>
                                <h4 className="text-[11px] font-bold tracking-tight mb-1">{item.title}</h4>
                                <p className="text-xs font-bold opacity-60 leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 'taxonomy',
        title: 'Taxonomy & Semantics',
        icon: 'schema',
        iconColor: 'text-orange-500',
        content: (
            <div className="space-y-6">
                <p className="text-[14px] leading-relaxed opacity-80 font-medium">
                    Organize your data using two distinct logical layers: Hierarchical Categories (Taxonomy) and Flat Labels (Semantics).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-bold tracking-tight text-primary-500">Taxonomy (Categories)</h4>
                        <p className="text-xs font-bold leading-relaxed opacity-70">Strict parent-child relationships. Use for primary structure like "Housing &gt; Rent" or "Transportation &gt; Fuel".</p>
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-bold tracking-tight text-orange-500">Semantics (Tags)</h4>
                        <p className="text-xs font-bold leading-relaxed opacity-70">Multi-dimensional overlays. Apply #vacation, #business, or #trip-2024 to cluster data across different taxonomic branches.</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'merchants',
        title: 'Merchant Intelligence',
        icon: 'storefront',
        iconColor: 'text-indigo-500',
        content: (
            <div className="space-y-6">
                <p className="text-[14px] leading-relaxed opacity-80 font-medium">
                    Crystal identifies and profiles transaction entities automatically. It builds a history of interaction with specific merchants to provide better categorization and recurring payment detection.
                </p>
                <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { icon: 'sell', text: 'Auto-Category Mapping' },
                            { icon: 'history', text: 'Temporal Distribution Analysis' },
                            { icon: 'pattern', text: 'Recurring Pattern Signal' },
                            { icon: 'rule', text: 'Custom Aggregation Rules' }
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-xs font-bold  tracking-widest opacity-80">
                                <span className="material-symbols-outlined text-[18px] opacity-40">{item.icon}</span>
                                {item.text}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )
    },
    {
        id: 'data-management',
        title: 'Data Sovereignty',
        icon: 'settings_ethernet',
        iconColor: 'text-emerald-500',
        content: (
            <div className="space-y-6">
                <p className="text-[14px] leading-relaxed opacity-80 font-medium">
                    Total control over your data nodes. Crystal provides granular tools for exporting and restoring your financial history.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold tracking-tight opacity-40">Granular Export</h4>
                        <p className="text-xs font-bold leading-relaxed">Extract specific vectors: Accounts, Transactions, Budgets, or Schema patterns. Available in high-density JSON or interoperable CSV formats.</p>
                    </div>
                    <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold tracking-tight opacity-40">Merge Restorations</h4>
                        <p className="text-xs font-bold leading-relaxed">Import data without data loss. Use the "Merge" protocol to combine external backup nodes with your current state, resolving conflicts through ID matching.</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'action-board',
        title: 'Action Board (Tasks)',
        icon: 'fact_check',
        iconColor: 'text-blue-600',
        content: (
            <div className="space-y-6">
                <p className="text-[14px] leading-relaxed opacity-80 font-medium">
                    The Action Board is a telemetric task management system designed to track operational chores, follow-ups, and systemic obligations.
                </p>
                <div className="space-y-4">
                    {[
                        { title: 'Status Matrix', desc: 'Manage workflow through Kanban-style columns: To Do, In Progress, and Done. Use Manual Sequence mode for precise prioritization.' },
                        { title: 'Temporal Density', desc: 'Visualize task distribution across the temporal horizon using the density heatmap. Identify bottleneck windows before they impact system stability.' },
                        { title: 'Priority Signals', desc: 'Assign "High", "Medium", or "Low" priority signals to ensure critical latency items are addressed first.' }
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-2xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/5">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-[10px] shrink-0">0{i+1}</div>
                            <div>
                                <h4 className="text-[11px] font-bold tracking-tight mb-1">{item.title}</h4>
                                <p className="text-xs font-bold opacity-60 leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
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
        <div className="w-full animate-fade-in-up pb-24 px-4">
             {/* Navigation & Header */}
            <div className="space-y-6 pt-4 mb-16">
                <nav className="flex items-center gap-3">
                    <button 
                      onClick={() => setCurrentPage('Settings')} 
                      className="group flex items-center gap-2 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary  tracking-widest hover:text-primary-500 transition-colors"
                    >
                        <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                        </div>
                        <span>Back to Control Center</span>
                    </button>
                </nav>
                
                <PageHeader
                  markerIcon="auto_stories"
                  markerLabel="Operational Manual"
                  title="Documentation"
                  subtitle="Detailed technical guidance on operating the Crystal system. From taxonomy definition to advanced data synchronization."
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-16">
                {/* Sticky Navigation Sidebar */}
                <aside className="hidden lg:block w-72 flex-shrink-0">
                    <div className="sticky top-24 space-y-2 p-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-3xl border border-black/5 dark:border-white/5">
                        <p className="px-4 py-4 text-[9px] font-black  tracking-[0.2em] opacity-40">
                            Manual Index
                        </p>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => scrollToSection(section.id)}
                                className={`w-full text-left px-5 py-4 rounded-2xl transition-all duration-300 flex items-center gap-4 ${
                                    activeSection === section.id
                                        ? 'bg-white dark:bg-dark-card text-primary-500 shadow-xl shadow-black/5 -translate-y-0.5'
                                        : 'text-light-text-secondary opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                            >
                                <span className={`material-symbols-outlined text-xl transition-all ${activeSection === section.id ? 'scale-110' : 'opacity-40 scale-90'}`}>
                                    {section.icon}
                                </span>
                                <span className="text-[11px] font-black  tracking-widest">{section.title}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Mobile Navigation */}
                <div className="lg:hidden overflow-x-auto pb-4 -mx-4 px-4 flex gap-4 snap-x no-scrollbar">
                     {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => scrollToSection(section.id)}
                            className={`flex-shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black  tracking-widest whitespace-nowrap transition-all ${
                                activeSection === section.id
                                    ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/20'
                                    : 'bg-black/5 dark:bg-white/5 text-light-text-secondary'
                            }`}
                        >
                            {section.title}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 space-y-24">
                    {sections.map(section => (
                        <section 
                            key={section.id} 
                            id={section.id} 
                            ref={(el) => { sectionRefs.current[section.id] = el; }}
                            className="scroll-mt-24 group"
                        >
                            <div className="space-y-8">
                                <div className="flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center ${section.iconColor} group-hover:scale-110 transition-transform`}>
                                        <span className="material-symbols-outlined text-3xl">{section.icon}</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold tracking-[0.2em] text-light-text dark:text-dark-text">{section.title}</h2>
                                        <div className="h-1 w-12 bg-primary-500 mt-2 rounded-full transform origin-left group-hover:scale-x-150 transition-transform"></div>
                                    </div>
                                </div>
                                <div className="text-light-text dark:text-dark-text leading-relaxed">
                                    {section.content}
                                </div>
                            </div>
                        </section>
                    ))}

                    <div className="flex justify-center pt-8">
                        <button 
                            onClick={handleBackToTop}
                            className="group flex items-center gap-4 px-10 py-5 rounded-3xl bg-black/5 dark:bg-white/5 hover:bg-primary-500 hover:text-white transition-all text-[11px] font-black  tracking-widest shadow-sm"
                        >
                            <span className="material-symbols-outlined group-hover:-translate-y-1 transition-transform">arrow_upward</span>
                            Scroll to Origin
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Documentation;