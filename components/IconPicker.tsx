
import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { INPUT_BASE_STYLE } from '../constants';
import { fuzzySearch } from '../utils';
import { searchMaterialSymbols } from '../utils/materialSymbols';
import Icon from './ui/Icon';

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
    const term = searchTerm.trim();

    if (!term || localMatches.length > 0) {
      setRemoteIcons([]);
      setIsFetchingRemote(false);
      return;
    }

    let cancelled = false;
    setIsFetchingRemote(true);

    Promise.resolve().then(() => {
      const matches = searchMaterialSymbols(term);
      if (!cancelled) {
        setRemoteIcons(matches);
      }
    }).catch((error) => {
      if (!cancelled) {
        console.error('Unable to search Material Symbols metadata', error);
        setRemoteIcons([]);
      }
    }).finally(() => {
      if (!cancelled) {
        setIsFetchingRemote(false);
      }
    });

    return () => {
      cancelled = true;
    };
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
    <Modal onClose={onClose} title="Select Icon" zIndexClass="z-[10000]" size="xl">
      <div className="flex flex-col h-[60vh] max-h-[600px]">
        {/* Search Bar */}
        <div className="mb-4 relative flex-shrink-0">
          <Icon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none text-xl"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search icons..."
            className={`${INPUT_BASE_STYLE} h-12 pl-11 pr-10`}
            autoFocus
          />
           {searchTerm && (
            <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                title="Clear search"
            >
                <Icon name="close" className="text-sm block" />
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
                  className="group flex flex-col items-center justify-center aspect-square rounded-2xl bg-light-fill dark:bg-dark-fill/50 hover:bg-white dark:hover:bg-dark-card hover:shadow-md transition-all duration-200 border border-black/5 dark:border-white/5 hover:border-primary-500/30 relative overflow-hidden active:scale-95 cursor-pointer"
                  title={icon}
                >
                  <Icon
                    name={icon}
                    className="text-3xl text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500 group-hover:scale-110 transition-transform duration-200"
                  />
                  <span className="absolute bottom-1 w-full text-2xs text-center text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-200 truncate px-1 capitalize">
                      {icon.replace(/_/g, ' ')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                <Icon name="sentiment_dissatisfied" className="text-4xl mb-3" />
                <p>{isFetchingRemote ? 'Searching Material Symbols catalog…' : `No icons found for "${searchTerm}"`}</p>
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
