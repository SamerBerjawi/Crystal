import React, { useMemo, useState, useDeferredValue, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { INPUT_BASE_STYLE } from '../constants';
import Icon from './ui/Icon';
import {
  PHOSPHOR_CATEGORIES,
  PhosphorCategory,
  searchPhosphorIcons,
  groupIconsByCategory,
  PhosphorIconItem,
  PHOSPHOR_ICONS,
} from '../utils/phosphorIcons';

interface IconPickerProps {
  onClose: () => void;
  onSelect: (icon: string) => void;
  iconList?: string[];
  selectedIcon?: string;
}

const CATEGORY_ICON_HINTS: Record<string, string> = {
  'View all': 'SquaresFour',
  'Finance & Commerce': 'Bank',
  'Charts & Analytics': 'ChartBar',
  'Navigation & UI': 'Compass',
  'Users & Account': 'Users',
  'Security & Privacy': 'Shield',
  Communication: 'Envelope',
  'Media & Devices': 'Monitor',
  'Layout & Design': 'Columns',
  'Files & Documents': 'Folder',
  'Time & Calendar': 'Clock',
  'Travel & Maps': 'MapPin',
  'Health & Wellness': 'Heart',
  'Shopping & Lifestyle': 'ShoppingBag',
  'Development & Tech': 'Code',
  'Weather & Nature': 'Sun',
  'General & System': 'Gear',
};

const IconPicker: React.FC<IconPickerProps> = ({
  onClose,
  onSelect,
  selectedIcon,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PhosphorCategory>('View all');
  const [activeHoverIcon, setActiveHoverIcon] = useState<PhosphorIconItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const deferredSearch = useDeferredValue(searchTerm);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Trigger slide-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const handleIconClick = (iconName: string) => {
    onSelect(iconName);
    handleClose();
  };

  // Filtered icons based on search query and category
  const filteredIcons = useMemo(() => {
    return searchPhosphorIcons(deferredSearch, selectedCategory);
  }, [deferredSearch, selectedCategory]);

  // Grouped structure when in "View all" mode
  const groupedSections = useMemo(() => {
    if (selectedCategory !== 'View all') return null;
    return groupIconsByCategory(filteredIcons);
  }, [selectedCategory, filteredIcons]);

  // Dynamic category counts according to current search
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'View all': searchPhosphorIcons(deferredSearch, 'View all').length,
    };
    for (const cat of PHOSPHOR_CATEGORIES) {
      if (cat === 'View all') continue;
      counts[cat] = searchPhosphorIcons(deferredSearch, cat).length;
    }
    return counts;
  }, [deferredSearch]);

  const totalVisibleCount = filteredIcons.length;

  if (typeof document === 'undefined') return null;

  const content = (
    <div className="fixed inset-0 z-[10000] overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Slide-over Sidebar Drawer from Right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-6 md:pl-10">
        <div 
          className={`w-screen max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl h-screen bg-light-card dark:bg-dark-card backdrop-blur-2xl dark:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.1)] text-light-text dark:text-dark-text shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transform transition-transform duration-300 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <header className="p-4 sm:p-5 md:p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/5 to-transparent shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 border border-primary-500/20 flex items-center justify-center shrink-0 shadow-xs">
                <Icon name="SquaresFour" className="text-2xl" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-light-text dark:text-dark-text tracking-tight truncate">
                    Select Icon
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                    Phosphor Duotone
                  </span>
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate mt-0.5 font-medium">
                  Select a duotone icon for your category, account, or custom view
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                aria-label="Close drawer"
              >
                <Icon name="X" className="text-lg" />
              </button>
            </div>
          </header>

          {/* Drawer Body: Left Category Sidebar + Right Icons Grid */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            
            {/* Left Categories Sidebar */}
            <aside className="w-52 sm:w-56 md:w-64 flex-shrink-0 border-r border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015] flex flex-col justify-between overflow-hidden">
              
              <div className="px-4 py-2.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between flex-shrink-0">
                <span className="text-2xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                  Categories
                </span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary font-mono">
                  {PHOSPHOR_CATEGORIES.length - 1}
                </span>
              </div>

              {/* Scrollable Category List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {PHOSPHOR_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  const count = categoryCounts[cat] || 0;
                  const hintIcon = CATEGORY_ICON_HINTS[cat] || 'SquaresFour';

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer text-left ${
                        isSelected
                          ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm font-bold'
                          : 'text-light-text dark:text-dark-text hover:bg-black/5 dark:hover:bg-white/5'
                      } ${count === 0 ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Icon
                          name={hintIcon}
                          className={`text-sm shrink-0 ${isSelected ? 'text-white' : 'text-primary-500'}`}
                        />
                        <span className="truncate">{cat}</span>
                      </div>

                      <span
                        className={`text-2xs px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Main Grid Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-light-card dark:bg-dark-card">
              
              {/* Search Toolbar */}
              <div className="p-3.5 border-b border-black/5 dark:border-white/5 flex items-center gap-3 flex-shrink-0 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-sm">
                <div className="relative flex-1">
                  <Icon
                    name="MagnifyingGlass"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none text-base"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Search ${selectedCategory === 'View all' ? 'all' : selectedCategory.toLowerCase()} icons by name, tag, or synonyms (e.g. wallet, dollar, card, check)...`}
                    className={`${INPUT_BASE_STYLE} !h-10 pl-10 pr-9 text-xs font-medium shadow-xs`}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-rose-500 transition-colors p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                      title="Clear search"
                    >
                      <Icon name="X" className="text-xs block" />
                    </button>
                  )}
                </div>

                <div className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 text-xs font-bold shrink-0">
                  <Icon name={CATEGORY_ICON_HINTS[selectedCategory] || 'SquaresFour'} className="text-sm" />
                  <span>{selectedCategory}</span>
                </div>
              </div>

              {/* Icons Grid Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {totalVisibleCount > 0 ? (
                  groupedSections && selectedCategory === 'View all' ? (
                    // Sectioned view in "View all" mode
                    groupedSections.map((group) => (
                      <div key={group.category} className="space-y-3">
                        <div className="sticky top-0 z-10 py-1.5 px-3.5 bg-light-card/95 dark:bg-dark-card/95 backdrop-blur-md flex items-center justify-between border-y border-black/5 dark:border-white/5 -mx-4 shadow-2xs">
                          <div className="flex items-center gap-2">
                            <Icon
                              name={CATEGORY_ICON_HINTS[group.category] || 'SquaresFour'}
                              className="text-primary-500 text-sm"
                            />
                            <h3 className="text-xs font-bold text-light-text dark:text-white uppercase tracking-wider">
                              {group.category}
                            </h3>
                          </div>
                          <span className="text-2xs font-semibold text-light-text-secondary dark:text-dark-text-secondary bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full font-mono">
                            {group.icons.length} {group.icons.length === 1 ? 'icon' : 'icons'}
                          </span>
                        </div>

                        {/* Spacious Unclipped Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-1">
                          {group.icons.map((item) => {
                            const isCurrent =
                              selectedIcon &&
                              (selectedIcon.toLowerCase() === item.name.toLowerCase() ||
                                selectedIcon.toLowerCase() === item.label.toLowerCase());

                            return (
                              <button
                                key={item.name}
                                type="button"
                                onClick={() => handleIconClick(item.name)}
                                onMouseEnter={() => setActiveHoverIcon(item)}
                                onMouseLeave={() => setActiveHoverIcon(null)}
                                className={`group relative min-h-[92px] p-2.5 rounded-2xl flex flex-col items-center justify-between transition-all duration-150 border cursor-pointer ${
                                  isCurrent
                                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600 dark:text-primary-400 shadow-sm ring-2 ring-primary-500/20'
                                    : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-primary-500/40 hover:bg-primary-500/[0.04] dark:hover:bg-primary-500/[0.08] hover:shadow-sm'
                                }`}
                                title={`${item.label} (${item.category})`}
                              >
                                {/* Center Icon */}
                                <div className="w-10 h-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] group-hover:bg-primary-500/10 flex items-center justify-center transition-colors">
                                  <Icon
                                    name={item.name}
                                    className={`text-2xl transition-transform duration-150 group-hover:scale-115 ${
                                      isCurrent
                                        ? 'text-primary-600 dark:text-primary-400'
                                        : 'text-light-text dark:text-dark-text group-hover:text-primary-500'
                                    }`}
                                  />
                                </div>

                                {/* Full Label with no clipping */}
                                <span className="text-xs font-semibold text-light-text dark:text-dark-text group-hover:text-primary-600 dark:group-hover:text-primary-400 text-center w-full px-1 mt-1.5 leading-snug line-clamp-2 break-words transition-colors">
                                  {item.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    // Single Category Grid
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {filteredIcons.map((item) => {
                        const isCurrent =
                          selectedIcon &&
                          (selectedIcon.toLowerCase() === item.name.toLowerCase() ||
                            selectedIcon.toLowerCase() === item.label.toLowerCase());

                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => handleIconClick(item.name)}
                            onMouseEnter={() => setActiveHoverIcon(item)}
                            onMouseLeave={() => setActiveHoverIcon(null)}
                            className={`group relative min-h-[92px] p-2.5 rounded-2xl flex flex-col items-center justify-between transition-all duration-150 border cursor-pointer ${
                              isCurrent
                                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600 dark:text-primary-400 shadow-sm ring-2 ring-primary-500/20'
                                : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-primary-500/40 hover:bg-primary-500/[0.04] dark:hover:bg-primary-500/[0.08] hover:shadow-sm'
                            }`}
                            title={`${item.label} (${item.category})`}
                          >
                            {/* Center Icon */}
                            <div className="w-10 h-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] group-hover:bg-primary-500/10 flex items-center justify-center transition-colors">
                              <Icon
                                name={item.name}
                                className={`text-2xl transition-transform duration-150 group-hover:scale-115 ${
                                  isCurrent
                                    ? 'text-primary-600 dark:text-primary-400'
                                    : 'text-light-text dark:text-dark-text group-hover:text-primary-500'
                                }`}
                              />
                            </div>

                            {/* Full Label with no clipping */}
                            <span className="text-xs font-semibold text-light-text dark:text-dark-text group-hover:text-primary-600 dark:group-hover:text-primary-400 text-center w-full px-1 mt-1.5 leading-snug line-clamp-2 break-words transition-colors">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  // Empty search state
                  <div className="flex flex-col items-center justify-center h-64 text-center text-light-text-secondary dark:text-dark-text-secondary opacity-70">
                    <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
                      <Icon name="MagnifyingGlass" className="text-2xl text-primary-500" />
                    </div>
                    <p className="text-sm font-bold text-light-text dark:text-white">
                      No icons found for &ldquo;{searchTerm}&rdquo;
                    </p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-xs">
                      Try searching for another keyword or switch category.
                    </p>
                    {selectedCategory !== 'View all' && (
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('View all')}
                        className="mt-3 px-3 py-1.5 rounded-full text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 transition-colors"
                      >
                        Search across all categories
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="px-4 py-2.5 border-t border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015] flex items-center justify-between text-xs flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {activeHoverIcon ? (
                    <div className="flex items-center gap-2 min-w-0 animate-fade-in">
                      <div className="w-5 h-5 rounded-md bg-primary-500/10 flex items-center justify-center text-primary-500 shrink-0">
                        <Icon name={activeHoverIcon.name} className="text-sm" />
                      </div>
                      <span className="font-bold text-light-text dark:text-white truncate">
                        {activeHoverIcon.label}
                      </span>
                      <span className="text-2xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md shrink-0">
                        {activeHoverIcon.category}
                      </span>
                    </div>
                  ) : (
                    <span className="text-light-text-secondary dark:text-dark-text-secondary text-2xs truncate">
                      Click any icon to select. All icons render in Phosphor Duotone.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-2xs text-light-text-secondary dark:text-dark-text-secondary shrink-0">
                  <span>
                    Showing <strong className="text-light-text dark:text-white">{totalVisibleCount}</strong> icons
                  </span>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default IconPicker;
