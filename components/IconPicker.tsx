
import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { INPUT_BASE_STYLE } from '../constants';
import { fuzzySearch } from '../utils';

interface IconPickerProps {
  onClose: () => void;
  onSelect: (icon: string) => void;
  iconList: string[];
}

const IconPicker: React.FC<IconPickerProps> = ({ onClose, onSelect, iconList }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [remoteIcons, setRemoteIcons] = useState<string[]>([]);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

  const handleIconClick = (icon: string) => {
    onSelect(icon);
    onClose();
  };

  const localMatches = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return iconList;
    // Use fuzzy search for better matching, and ensure we ONLY return valid icons from the list.
    return iconList.filter(icon => fuzzySearch(term, icon));
  }, [searchTerm, iconList]);

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term || localMatches.length > 0) {
      setRemoteIcons([]);
      setIsFetchingRemote(false);
      return;
    }

    const controller = new AbortController();

    const fetchMaterialSymbols = async () => {
      setIsFetchingRemote(true);
      try {
        const response = await fetch('https://fonts.google.com/metadata/icons?key=material_symbols', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch Material Symbols (status ${response.status})`);
        }

        const rawText = await response.text();
        // The metadata API prefixes the JSON with a )]}\' guard. Strip it before parsing.
        const cleanedText = rawText.replace(/^\)\]\}'/, '');
        const data = JSON.parse(cleanedText);
        const icons = Array.isArray(data?.icons) ? data.icons : [];

        const matches = icons.filter((icon: { name?: string; tags?: string[] }) => {
          const name = icon?.name || '';
          const tags = Array.isArray(icon?.tags) ? icon.tags : [];
          return fuzzySearch(term, name) || tags.some(tag => fuzzySearch(term, tag));
        }).map((icon: { name?: string }) => icon?.name).filter(Boolean) as string[];

        const uniqueMatches = Array.from(new Set(matches));
        setRemoteIcons(uniqueMatches);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('Unable to fetch Material Symbols metadata', error);
          setRemoteIcons([]);
        }
      } finally {
        setIsFetchingRemote(false);
      }
    };

    fetchMaterialSymbols();

    return () => controller.abort();
  }, [searchTerm, localMatches.length]);

  const displayedIcons = useMemo(() => {
    if (!searchTerm.trim()) return iconList;
    const combinedIcons = [...localMatches];

    for (const icon of remoteIcons) {
      if (!combinedIcons.includes(icon)) {
        combinedIcons.push(icon);
      }
    }

    return combinedIcons;
  }, [searchTerm, iconList, localMatches, remoteIcons]);

  return (
    <Modal onClose={onClose} title="Select Icon" zIndexClass="z-[60]" size="xl">
      <div className="flex flex-col h-[60vh] max-h-[600px]">
        {/* Search Bar */}
        <div className="mb-4 relative flex-shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search icons..."
            className={`${INPUT_BASE_STYLE} pl-10 pr-10`}
            autoFocus
          />
           {searchTerm && (
            <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                title="Clear search"
            >
                <span className="material-symbols-outlined text-sm block">close</span>
            </button>
           )}
        </div>

        {/* Icons Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-1 -mx-1 px-1">
          {displayedIcons.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {displayedIcons.map(icon => (
                <button
                  key={icon}
                  onClick={() => handleIconClick(icon)}
                  className="group flex flex-col items-center justify-center aspect-square rounded-xl bg-light-bg dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-md transition-all duration-200 border border-transparent hover:border-black/5 dark:hover:border-white/10 relative overflow-hidden"
                  title={icon}
                >
                  <span className="material-symbols-outlined text-3xl text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500 group-hover:scale-110 transition-transform duration-200">
                    {icon}
                  </span>
                  <span className="absolute bottom-1 w-full text-[10px] text-center text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-200 truncate px-1 capitalize">
                      {icon.replace(/_/g, ' ')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                <span className="material-symbols-outlined text-4xl mb-3">sentiment_dissatisfied</span>
                <p>{isFetchingRemote ? 'Searching Google Material Symbols…' : `No icons found for "${searchTerm}"`}</p>
            </div>
          )}
        </div>
        
        <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary mt-4 pt-2 border-t border-black/5 dark:border-white/5 flex-shrink-0">
            Showing {displayedIcons.length} icons
        </div>
      </div>
    </Modal>
  );
};

export default IconPicker;
