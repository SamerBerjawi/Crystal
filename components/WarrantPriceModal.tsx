import React, { useEffect, useRef, useState } from 'react';
import type { SmartPriceBinding } from '../types';
import { CURRENCY_OPTIONS } from '../constants';
import { convertCurrency, toLocalISOString } from '../utils';
import { usePreferencesContext, usePreferencesSelector } from '../contexts/DomainProviders';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { normalizeDecimalString, parsePriceFromText } from '../utils/smartPrice';
import { fetchBestQuote } from '../src/services/twelveDataService';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { AmountInput, DateInput, Radio, RadioGroup, Textarea, TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';

const MODES: SwipeTabItem[] = [{ id: 'single', title: 'One price' }, { id: 'bulk', title: 'Many prices' }];
const SUPPORTED_CURRENCIES = CURRENCY_OPTIONS.map(option => option.split(' ')[0]);

interface WarrantPriceModalProps {
    onClose: () => void;
    onSave: (isin: string, price: number | null | { date: string; price: number }[], date?: string) => void;
    isin: string;
    name: string;
    initialEntry?: { date: string; price: number } | null;
    manualPrice?: number;
}

/** Logs a holding's price by hand, in bulk, from Twelve Data or from a saved web page. Prices are kept in the holding's currency (D-026). */
const WarrantPriceModal: React.FC<WarrantPriceModalProps> = ({ onClose, onSave, isin, name, initialEntry, manualPrice }) => {
    const [mode, setMode] = useState<'single' | 'bulk'>('single');
    const [newPrice, setNewPrice] = useState(
        initialEntry 
            ? String(initialEntry.price) 
            : (manualPrice !== undefined && manualPrice !== null ? String(manualPrice) : '')
    );
    const [date, setDate] = useState(initialEntry ? initialEntry.date : toLocalISOString(new Date()));
    const [bulkData, setBulkData] = useState('');
    const [bulkPreview, setBulkPreview] = useState<{ date: string; price: number }[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isSmartFetcherOpen, setIsSmartFetcherOpen] = useState(false);
    const [smartFetcherUrl, setSmartFetcherUrl] = useState('');
    const [smartFetcherCookies, setSmartFetcherCookies] = useState('');
    const [smartFetcherCandidates, setSmartFetcherCandidates] = useState<{ id: string; value: number; selector: string; context: string }[]>([]);
    const [smartFetcherSelection, setSmartFetcherSelection] = useState<string | null>(null);
    const [smartFetcherStatus, setSmartFetcherStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [smartFetcherError, setSmartFetcherError] = useState<string | null>(null);
    const [smartFetcherBinding, setSmartFetcherBinding] = useState<SmartPriceBinding | null>(null);

    const { preferences, setPreferences } = usePreferencesContext();
    const twelveDataApiKey = usePreferencesSelector(p => p.twelveDataApiKey || '');
    const [twelveDataTicker, setTwelveDataTicker] = useState(preferences.investmentPriceConfigs?.[isin]?.ticker || isin);
    const [exchange, setExchange] = useState(preferences.investmentPriceConfigs?.[isin]?.exchange || '');
    const currency = preferences.investmentPriceConfigs?.[isin]?.currency ?? 'EUR';
    const startPrice = useRef(newPrice);

    // Hydrate saved binding with priority to synced preferences, fallback to localStorage
    useEffect(() => {
        try {
            const syncedBinding = preferences.smartPriceBindings?.[isin] || preferences.investmentPriceConfigs?.[isin]?.binding;
            if (syncedBinding) {
                setSmartFetcherBinding(syncedBinding);
                setSmartFetcherUrl(syncedBinding.url || '');
                setSmartFetcherCookies(syncedBinding.cookies || '');
                return;
            }

            const stored = localStorage.getItem('smartPriceBindings');
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, SmartPriceBinding>;
                const localBinding = parsed[isin];
                if (localBinding) {
                    setSmartFetcherBinding(localBinding);
                    setSmartFetcherUrl(localBinding.url || '');
                    setSmartFetcherCookies(localBinding.cookies || '');
                    // Migrate to cloud preferences
                    persistSmartBinding(localBinding);
                }
            }
        } catch (err) {
            console.error('Failed to parse smart price bindings', err);
        }
    }, [isin, preferences.smartPriceBindings, preferences.investmentPriceConfigs]);

    // Parse Bulk Data
    useEffect(() => {
        if (mode !== 'bulk') return;
        const lines = bulkData.split('\n');
        const parsed: { date: string; price: number }[] = [];
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const parts = trimmed.split(/[\t, ]+/);
            if (parts.length >= 2) {
                const d = parts[0].trim();
                const p = parseFloat(parts[1].trim());
                if (/^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(p)) {
                    parsed.push({ date: d, price: p });
                }
            }
        });
        setBulkPreview(parsed);
    }, [bulkData, mode]);

    const fetchSmartPage = async (url: string, cookies?: string) => {
        const params = new URLSearchParams({ url });
        if (cookies) {
            params.set('cookies', cookies);
        }
        const response = await fetchWithTimeout(`/api/smart-fetch?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Smart fetch failed with status ${response.status}`);
        }
        return response.text();
    };

    const buildSelector = (el: Element | null): string => {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
        const parts: string[] = [];
        let curr: Element | null = el;

        while (curr && curr.nodeType === Node.ELEMENT_NODE && curr.tagName.toLowerCase() !== 'body') {
            const tag = curr.tagName.toLowerCase();
            const id = curr.getAttribute('id');
            const dataTestId = curr.getAttribute('data-testid');

            if (id) {
                parts.unshift(`#${id}`);
                break;
            }
            if (dataTestId) {
                parts.unshift(`[data-testid="${dataTestId}"]`);
                break;
            }

            const classes = Array.from(curr.classList || [])
                .filter(cls => !cls.includes(':') && !cls.includes('/') && !cls.includes('[') && cls.length < 24)
                .slice(0, 2);

            let segment = tag;
            if (classes.length) {
                segment += `.${classes.join('.')}`;
            }

            const parent = curr.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(sibling => sibling.tagName === curr!.tagName);
                if (siblings.length > 1) {
                    const idx = siblings.indexOf(curr) + 1;
                    segment += `:nth-of-type(${idx})`;
                }
            }

            parts.unshift(segment);
            curr = curr.parentElement;
        }

        return parts.length ? parts.join(' > ') : '';
    };

    const persistSmartBinding = (binding: SmartPriceBinding) => {
        try {
            // 1. Persist to App Preferences (synced to server and available on all devices)
            setPreferences(prev => {
                const currentBindings = prev.smartPriceBindings || {};
                const currentConfigs = prev.investmentPriceConfigs || {};
                return {
                    ...prev,
                    smartPriceBindings: {
                        ...currentBindings,
                        [isin]: binding,
                    },
                    investmentPriceConfigs: {
                        ...currentConfigs,
                        [isin]: {
                            ...(currentConfigs[isin] || {}),
                            source: 'web',
                            binding,
                        },
                    },
                };
            });

            // 2. Mirror to localStorage as offline cache
            const stored = localStorage.getItem('smartPriceBindings');
            const parsed = stored ? (JSON.parse(stored) as Record<string, SmartPriceBinding>) : {};
            parsed[isin] = binding;
            localStorage.setItem('smartPriceBindings', JSON.stringify(parsed));
            setSmartFetcherBinding(binding);
        } catch (err) {
            console.error('Failed to persist smart price binding', err);
        }
    };

    const removeSmartBinding = () => {
        try {
            setPreferences(prev => {
                const nextBindings = { ...(prev.smartPriceBindings || {}) };
                delete nextBindings[isin];
                const nextConfigs = { ...(prev.investmentPriceConfigs || {}) };
                if (nextConfigs[isin]) {
                    delete nextConfigs[isin].binding;
                }
                return {
                    ...prev,
                    smartPriceBindings: nextBindings,
                    investmentPriceConfigs: nextConfigs,
                };
            });

            const stored = localStorage.getItem('smartPriceBindings');
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, SmartPriceBinding>;
                delete parsed[isin];
                localStorage.setItem('smartPriceBindings', JSON.stringify(parsed));
            }

            setSmartFetcherBinding(null);
            setSmartFetcherUrl('');
            setSmartFetcherCookies('');
            setSmartFetcherCandidates([]);
            setSmartFetcherSelection(null);
        } catch (err) {
            console.error('Failed to remove smart price binding', err);
        }
    };

    const persistTwelveDataTicker = (ticker: string, tickerExchange: string) => {
        const cleaned = ticker.trim().toUpperCase();
        setTwelveDataTicker(cleaned);
        if (cleaned) {
            setPreferences(prev => {
                const currentConfigs = prev.investmentPriceConfigs || {};
                return {
                    ...prev,
                    investmentPriceConfigs: {
                        ...currentConfigs,
                        [isin]: {
                            ...(currentConfigs[isin] || {}),
                            source: 'twelvedata',
                            ticker: cleaned,
                            exchange: tickerExchange.trim() || undefined,
                        },
                    },
                };
            });
        }
    };

    const hydrateSmartFetcher = (html: string) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const elements = Array.from(doc.querySelectorAll('body *'));
        const candidates: { id: string; value: number; selector: string; context: string; score: number }[] = [];

        const scoreText = (text: string, el: Element) => {
            let score = 0;
            if (/€|eur/i.test(text)) score += 2;
            if (/(last|aktuell|bid|ask|preis|price)/i.test(text)) score += 1;
            if (text.length <= 20) score += 1;
            if (['strong', 'b'].includes(el.tagName.toLowerCase())) score += 1;
            return score;
        };

        const registerCandidate = (el: Element, text: string, scoreBoost = 0) => {
            const price = parsePriceFromText(text);
            if (price === null) return;
            const selector = buildSelector(el);
            const context = text.length > 80 ? `${text.slice(0, 77)}…` : text;
            candidates.push({
                id: `${candidates.length}-${selector || el.tagName}-${Math.random().toString(16).slice(2, 6)}`,
                value: price,
                selector,
                context,
                score: scoreText(text, el) + scoreBoost,
            });
        };

        const attributeSelectors = ['[data-price]', '[data-last]', '[data-value]', '[itemprop="price"]'];
        attributeSelectors.forEach(sel => {
            doc.querySelectorAll(sel).forEach(el => {
                const text = (el.getAttribute('content') || el.getAttribute('data-price') || el.getAttribute('data-last') || el.getAttribute('data-value') || el.textContent || '').trim();
                if (text) registerCandidate(el, text, 2);
            });
        });

        doc.querySelectorAll('meta[itemprop="price"], meta[property="product:price:amount"], meta[name="price"]').forEach(el => {
            const content = el.getAttribute('content') || '';
            if (content) registerCandidate(el, content, 3);
        });

        elements.slice(0, 2000).forEach(el => {
            const text = (el.textContent || '').trim();
            if (!text || text.length > 120) return;
            registerCandidate(el, text);
        });

        const topCandidates = candidates
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        setSmartFetcherCandidates(topCandidates);
        setSmartFetcherSelection(topCandidates[0]?.id || null);
        setSmartFetcherStatus(topCandidates.length ? 'ready' : 'error');
        if (!candidates.length) {
            setSmartFetcherError('No obvious price values were found on that page. Try a different URL or selector.');
        }
    };

    const handleSmartFetcher = async (opts?: { useSavedSelector?: boolean }) => {
        if (!smartFetcherUrl.trim() && !smartFetcherBinding) {
            setSmartFetcherError('Provide a page URL to scan for prices.');
            return;
        }

        const targetUrl = (opts?.useSavedSelector && smartFetcherBinding?.url) || smartFetcherUrl.trim() || smartFetcherBinding?.url || '';
        const cookies = smartFetcherCookies.trim() || smartFetcherBinding?.cookies || '';
        if (!targetUrl) {
            setSmartFetcherError('Provide a page URL to scan for prices.');
            return;
        }
        setSmartFetcherStatus('loading');
        setSmartFetcherError(null);
        setSmartFetcherCandidates([]);

        try {
            const html = await fetchSmartPage(targetUrl, cookies);

            if (opts?.useSavedSelector && smartFetcherBinding) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const element = doc.querySelector(smartFetcherBinding.selector);
                if (element) {
                    const price = parsePriceFromText(element.textContent || '');
                    if (price !== null) {
                        setNewPrice(String(price));
                        setDate(toLocalISOString(new Date()));
                        setSmartFetcherStatus('ready');
                        setSmartFetcherUrl(targetUrl);
                        return;
                    }
                }
                setSmartFetcherError('Saved selector no longer matches that page. Try scanning again.');
            }

            setSmartFetcherUrl(targetUrl);
            if (cookies) {
                setSmartFetcherCookies(cookies);
            }
            hydrateSmartFetcher(html);
        } catch (error) {
            console.error('Smart fetcher failed', error);
            setSmartFetcherStatus('error');
            setSmartFetcherError('Unable to scan that page. Some sites block cross-origin requests—try another URL or use a saved selector.');
        }
    };

    const applySmartSelection = () => {
        if (!smartFetcherSelection) return;
        const selected = smartFetcherCandidates.find(c => c.id === smartFetcherSelection);
        if (!selected) return;

        setNewPrice(String(selected.value));
        setDate(toLocalISOString(new Date()));
        const bindingUrl = smartFetcherUrl.trim() || smartFetcherBinding?.url || '';
        const cookies = smartFetcherCookies.trim() || smartFetcherBinding?.cookies;
        if (bindingUrl) {
            persistSmartBinding({ url: bindingUrl, selector: selected.selector, ...(cookies ? { cookies } : {}) });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSave();
    };

    const handleSave = () => {
        if (mode === 'single') {
            const normalized = normalizeDecimalString(newPrice);
            const parsedPrice = parseFloat(normalized);
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
            setFetchError('Add your Twelve Data API key in Preferences to fetch prices.');
            return;
        }
        setIsFetching(true);
        setFetchError(null);
        try {
            const targetSymbol = (twelveDataTicker.trim() || isin).toUpperCase();
            const quote = await fetchBestQuote(targetSymbol, twelveDataApiKey, exchange.trim() || undefined, SUPPORTED_CURRENCIES);
            setNewPrice(String(convertCurrency(quote.price, quote.currency, currency, preferences.conversionRates)));
            setDate(toLocalISOString(new Date()));
            persistTwelveDataTicker(targetSymbol, exchange);
        } catch (error) {
            console.error('Failed to fetch Twelve Data price', error);
            setFetchError(error instanceof Error ? error.message : "Couldn't reach Twelve Data. Try again.");
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

    const isDirty = mode === 'bulk' ? bulkData.trim() !== '' : newPrice !== startPrice.current;

    return (
        <SidePanel
            isOpen
            onClose={onClose}
            title={initialEntry ? 'Edit price' : 'Log a price'}
            description={`${name}, ${isin}`}
            isDirty={isDirty}
            footer={close => (
                <div className="flex items-center justify-between gap-2">
                    <Button variant="ghost" onPress={handleClear}>{mode === 'bulk' ? 'Clear' : initialEntry ? 'Delete' : 'Reset'}</Button>
                    <div className="flex gap-2">
                        <Button variant="ghost" onPress={close}>Cancel</Button>
                        <Button isDisabled={mode === 'bulk' && bulkPreview.length === 0} onPress={handleSave}>Save</Button>
                    </div>
                </div>
            )}
        >
            <form className="space-y-4" onSubmit={handleSubmit}>
                {!initialEntry && <SmoothTab fullWidth className="w-full" items={MODES} value={mode} onChange={id => setMode(id as 'single' | 'bulk')} label="Price entry mode" />}
                {mode === 'single' ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <DateInput label="Date" value={date} onChange={setDate} isDisabled={!!initialEntry} />
                            <AmountInput label="Price" currency={currency} value={newPrice} onChange={value => setNewPrice(normalizeDecimalString(value))} autoFocus />
                        </div>

                        <section aria-label="Twelve Data" className="space-y-3 rounded-[var(--radius-lg)] bg-inset p-4">
                            <h3 className="type-label text-ink">From Twelve Data</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <TextInput label="Ticker" value={twelveDataTicker} onChange={setTwelveDataTicker} />
                                <TextInput label="Exchange" value={exchange} onChange={setExchange} help="Optional." />
                            </div>
                            <Button variant="secondary" icon="refresh" isBusy={isFetching} onPress={handleFetchLatestPrice}>Fetch price</Button>
                            {fetchError && <p role="alert" className="type-caption text-money-out">{fetchError}</p>}
                        </section>

                        <section aria-label="From a web page" className="space-y-3 rounded-[var(--radius-lg)] bg-inset p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="type-label text-ink">From a web page</h3>
                                {smartFetcherBinding && <Badge tone="positive">Saved</Badge>}
                            </div>
                            {smartFetcherBinding && !isSmartFetcherOpen && (
                                <div className="flex items-center gap-2">
                                    <p className="type-caption min-w-0 flex-1 truncate text-muted" title={smartFetcherBinding.url}>{smartFetcherBinding.url}</p>
                                    <Button variant="secondary" size="sm" isBusy={smartFetcherStatus === 'loading'} onPress={() => handleSmartFetcher({ useSavedSelector: true })}>Fetch</Button>
                                    <IconButton icon="delete-02" label="Remove the saved page" tooltipPlacement="left" onPress={removeSmartBinding} />
                                </div>
                            )}
                            {!isSmartFetcherOpen && <Button variant="secondary" onPress={() => setIsSmartFetcherOpen(true)}>{smartFetcherBinding ? 'Choose another page' : 'Set up a page'}</Button>}
                            {isSmartFetcherOpen && (
                                <>
                                    <TextInput label="Page address" type="url" value={smartFetcherUrl} onChange={setSmartFetcherUrl} />
                                    <TextInput label="Cookies" value={smartFetcherCookies} onChange={setSmartFetcherCookies} help="Optional, for pages behind a sign-in." />
                                    <Button variant="secondary" isBusy={smartFetcherStatus === 'loading'} onPress={() => handleSmartFetcher()}>Scan the page</Button>
                                    {smartFetcherCandidates.length > 0 && (
                                        <>
                                            <RadioGroup label="Which one is the price?" value={smartFetcherSelection ?? ''} onChange={setSmartFetcherSelection}>
                                                {smartFetcherCandidates.map(candidate => <Radio key={candidate.id} value={candidate.id}>{candidate.value} — {candidate.context}</Radio>)}
                                            </RadioGroup>
                                            <Button isDisabled={!smartFetcherSelection} onPress={applySmartSelection}>Use this price</Button>
                                        </>
                                    )}
                                </>
                            )}
                            {smartFetcherError && <p role="alert" className="type-caption text-money-out">{smartFetcherError}</p>}
                        </section>
                    </>
                ) : (
                    <>
                        <Textarea label="Prices" rows={8} value={bulkData} onChange={setBulkData} help="One per line: date, then price. For example 2026-05-10 128.50." autoFocus />
                        {bulkPreview.length > 0 && <p className="type-caption text-muted">{bulkPreview.length} prices ready to save.</p>}
                    </>
                )}
            </form>
        </SidePanel>
    );
};

export default WarrantPriceModal;
