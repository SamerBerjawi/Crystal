
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE } from '../constants';
import { toLocalISOString } from '../utils';
import { usePreferencesSelector } from '../contexts/DomainProviders';

interface WarrantPriceModalProps {
  onClose: () => void;
  onSave: (isin: string, price: number | null | {date: string, price: number}[], date?: string) => void;
  isin: string;
  name: string;
  initialEntry?: { date: string; price: number };
  manualPrice?: number | null | undefined;
}

const WarrantPriceModal: React.FC<WarrantPriceModalProps> = ({ onClose, onSave, isin, name, initialEntry, manualPrice }) => {
    const [mode, setMode] = useState<'single' | 'bulk'>(initialEntry ? 'single' : 'single');
    const twelveDataApiKey = usePreferencesSelector(p => p.twelveDataApiKey || '');

    // Single Entry State
    const [newPrice, setNewPrice] = useState('');
    const [date, setDate] = useState(toLocalISOString(new Date()));

    // Bulk Entry State
    const [bulkData, setBulkData] = useState('');
    const [bulkPreview, setBulkPreview] = useState<{date: string, price: number}[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        if (initialEntry) {
            setNewPrice(String(initialEntry.price));
            setDate(initialEntry.date);
            setMode('single');
        } else {
            setNewPrice(manualPrice !== undefined && manualPrice !== null ? String(manualPrice) : '');
            setDate(toLocalISOString(new Date()));
        }
    }, [initialEntry, manualPrice]);

    // Parse Bulk Data
    useEffect(() => {
        if (mode === 'bulk') {
            const lines = bulkData.split('\n');
            const parsed: {date: string, price: number}[] = [];
            
            lines.forEach(line => {
                // simple parsing: look for date (YYYY-MM-DD) and a number
                const trimmed = line.trim();
                if (!trimmed) return;

                // Match YYYY-MM-DD
                const dateMatch = trimmed.match(/\b\d{4}-\d{2}-\d{2}\b/);
                // Match number (price)
                const priceMatch = trimmed.match(/\b\d+(\.\d+)?\b/);
                
                // Ensure we aren't matching the date parts as price if no other number exists
                // A better approach: split by comma/tab/space
                const parts = trimmed.split(/[\s,;]+/).filter(Boolean);
                
                if (parts.length >= 2) {
                    // Assume Date is one part, Price is another
                    let d = parts.find(p => p.match(/^\d{4}-\d{2}-\d{2}$/));
                    let p = parts.find(p => p !== d && !isNaN(parseFloat(p)));

                    if (d && p) {
                        parsed.push({
                            date: d,
                            price: parseFloat(p)
                        });
                    }
                }
            });
            setBulkPreview(parsed);
        }
    }, [bulkData, mode]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (mode === 'single') {
            const parsedPrice = parseFloat(newPrice);
            if (newPrice.trim() === '' || isNaN(parsedPrice)) {
                // If empty, treat as delete
                onSave(isin, null, date); 
            } else {
                onSave(isin, parsedPrice, date);
            }
        } else {
            if (bulkPreview.length > 0) {
                onSave(isin, bulkPreview);
            }
        }
        onClose();
    };

    const handleFetchLatestPrice = async () => {
        if (!twelveDataApiKey) {
            setFetchError('Add your Twelve Data API key in Preferences to fetch prices automatically.');
            return;
        }

        setIsFetching(true);
        setFetchError(null);

        const fetchPrice = async (query: string) => {
            const response = await fetch(query);
            const data = await response.json();

            if (data.status === 'error' || data.code) {
                throw new Error(data.message || 'Unable to fetch price');
            }

            return data.price;
        };

        try {
            const symbol = isin.toUpperCase();
            const candidates = symbol.includes('/')
                ? [symbol]
                : [
                    `${symbol}/EUR`, // direct EUR quote for crypto pairs
                    `${symbol}/USD`, // USD quote with conversion to EUR
                    symbol // fallback to raw symbol
                ];

            let fetchedPrice: number | null = null;

            for (const candidate of candidates) {
                const queryParams = new URLSearchParams({
                    symbol: candidate,
                    apikey: twelveDataApiKey,
                });

                // Only request conversion when the quote currency is not already EUR to avoid unusable crypto prices.
                if (!candidate.toUpperCase().endsWith('/EUR')) {
                    queryParams.set('currency', 'EUR');
                }

                try {
                    fetchedPrice = await fetchPrice(`https://api.twelvedata.com/price?${queryParams.toString()}`);
                    break;
                } catch (err) {
                    // try next candidate
                    continue;
                }
            }

            if (fetchedPrice) {
                setNewPrice(String(fetchedPrice));
                setDate(toLocalISOString(new Date()));
            } else {
                setFetchError('Price not available for this symbol.');
            }
        } catch (error) {
            console.error('Failed to fetch Twelve Data price', error);
            setFetchError(error instanceof Error ? error.message : 'Unable to connect to Twelve Data. Please try again.');
        } finally {
            setIsFetching(false);
        }
    };
    
    const handleClear = () => {
        if (mode === 'single') {
            onSave(isin, null, date);
            onClose();
        } else {
            setBulkData('');
        }
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
    const title = initialEntry ? `Edit Price for ${initialEntry.date}` : `Log Price for ${name}`;
    
    return (
        <Modal onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {!initialEntry && (
                    <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-lg mb-4">
                        <button
                            type="button"
                            onClick={() => setMode('single')}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${mode === 'single' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Single Entry
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('bulk')}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${mode === 'bulk' ? 'bg-white dark:bg-dark-card shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Bulk Import
                        </button>
                    </div>
                )}

                {mode === 'single' ? (
                    <>
                        <div>
                            <label htmlFor="price-date" className={labelStyle}>Date</label>
                            <input
                                id="price-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={INPUT_BASE_STYLE}
                                required
                                disabled={!!initialEntry}
                            />
                        </div>

                        <div>
                            <label htmlFor="manual-price" className={labelStyle}>Price per Unit (€)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">€</span>
                                <input
                                    id="manual-price"
                                    type="number"
                                    step="any"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                    className={`${INPUT_BASE_STYLE} pl-8`}
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={handleFetchLatestPrice}
                                    className={`${BTN_SECONDARY_STYLE} !py-2 flex items-center gap-2`}
                                    disabled={isFetching}
                                >
                                    <span className="material-symbols-outlined text-lg">cloud_download</span>
                                    {isFetching ? 'Fetching…' : 'Fetch from Twelve Data'}
                                </button>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    Uses your saved Twelve Data API key.
                                </p>
                            </div>
                            {fetchError && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-base">error</span>
                                    {fetchError}
                                </p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-3">
                         <div>
                            <label htmlFor="bulk-data" className={labelStyle}>Data (YYYY-MM-DD Price)</label>
                            <textarea
                                id="bulk-data"
                                value={bulkData}
                                onChange={(e) => setBulkData(e.target.value)}
                                className={`${INPUT_BASE_STYLE} font-mono text-sm`}
                                rows={6}
                                placeholder={`2023-01-01 150.00\n2023-02-01 155.50\n2023-03-01 162.25`}
                                autoFocus
                            />
                             <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                 Paste dates and prices separated by space, comma or tab.
                             </p>
                        </div>
                        {bulkPreview.length > 0 && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/30">
                                <p className="text-sm text-green-700 dark:text-green-300 font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                    {bulkPreview.length} entries recognized
                                </p>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex justify-between items-center pt-4 border-t border-black/5 dark:border-white/5">
                     {mode === 'single' ? (
                        <button type="button" onClick={handleClear} className={BTN_DANGER_STYLE}>
                            {initialEntry ? 'Delete Entry' : 'Clear Value'}
                        </button>
                     ) : (
                         <div /> // Spacer
                     )}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" className={BTN_PRIMARY_STYLE} disabled={mode === 'bulk' && bulkPreview.length === 0}>
                            {mode === 'bulk' ? 'Import Prices' : 'Save Price'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default WarrantPriceModal;
