import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { Warrant, ScraperConfig, ScraperResource, ScraperOptions } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE } from '../constants';

interface ScraperConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  warrants: Warrant[];
  scraperConfigs: ScraperConfig[];
  onSave: (config: ScraperConfig) => void;
}

const defaultResource: ScraperResource = {
    url: '',
    method: 'GET',
    authType: 'none',
    username: '',
    password: '',
    verifySsl: true,
    timeout: 10,
    encoding: 'UTF-8',
};

const defaultOptions: ScraperOptions = {
    select: '',
    index: 0,
    attribute: '',
};

const ScraperConfigModal: React.FC<ScraperConfigModalProps> = ({ isOpen, onClose, warrants, scraperConfigs, onSave }) => {
    const [selectedIsin, setSelectedIsin] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [resource, setResource] = useState<ScraperResource>(defaultResource);
    const [options, setOptions] = useState<ScraperOptions>(defaultOptions);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);

    const uniqueIsins = useMemo(() => {
        const isinMap = new Map<string, string>();
        warrants.forEach(w => {
            if (!isinMap.has(w.isin)) {
                isinMap.set(w.isin, w.name);
            }
        });
        return Array.from(isinMap.entries()).map(([isin, name]) => ({ isin, name }));
    }, [warrants]);

    useEffect(() => {
        if (selectedIsin) {
            const existingConfig = scraperConfigs.find(c => c.id === selectedIsin);
            setResource(existingConfig?.resource || { ...defaultResource });
            setOptions(existingConfig?.options || { ...defaultOptions });
            setStep(1);
            setTestResult(null);
        } else if (uniqueIsins.length > 0) {
            setSelectedIsin(uniqueIsins[0].isin);
        }
    }, [selectedIsin, scraperConfigs, uniqueIsins]);

    const handleSave = () => {
        if (!selectedIsin) return;
        onSave({ id: selectedIsin, resource, options });
        onClose();
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        const proxyUrl = 'https://cors.eu.org/';
    
        if (!resource.url || !options.select) {
            setTestResult('Error: URL and Selector are required.');
            setIsTesting(false);
            return;
        }
    
        try {
            const response = await fetch(`${proxyUrl}${resource.url}`);
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const htmlString = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');
    
            const elements = doc.querySelectorAll(options.select);
            if (elements.length === 0 || options.index >= elements.length) {
                throw new Error(`Element not found with selector "${options.select}" and index ${options.index}.`);
            }
            
            const targetElement = elements[options.index];
            const rawValue = options.attribute ? targetElement.getAttribute(options.attribute) : targetElement.textContent;
    
            if (!rawValue) {
                throw new Error('No value or text content found in the selected element.');
            }
    
            // Handle European number format (e.g., "13,61 €" -> 13.61)
            const priceString = rawValue.match(/[0-9.,\s]+/)?.[0]?.trim() || '';
            if (!priceString) {
                throw new Error(`Could not find a number in the raw value: "${rawValue}"`);
            }
            
            // Remove thousand separators (dots), then replace decimal comma with a dot
            const numberString = priceString.replace(/\./g, '').replace(',', '.');
            const price = parseFloat(numberString);
    
            if (isNaN(price)) {
                throw new Error(`Could not parse a valid number from: "${rawValue}"`);
            }
    
            setTestResult(`Successfully scraped value: €${price.toFixed(2)}`);
        } catch (error: any) {
            console.error('Scraping test failed:', error);
            if (error.message.includes('Failed to fetch')) {
                 setTestResult('Error: Failed to fetch the URL. This might be a CORS issue. Check the browser console for more details.');
            } else {
                 setTestResult(`Error: ${error.message}`);
            }
        } finally {
            setIsTesting(false);
        }
    };

    const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

    if (!isOpen) return null;

    const renderResourceForm = () => (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Resource</h3>
            <div><label htmlFor="url" className={labelStyle}>Resource*</label><input id="url" type="text" placeholder="https://www.example.com" value={resource.url} onChange={e => setResource(p => ({...p, url: e.target.value}))} className={INPUT_BASE_STYLE} required /></div>
            <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="method" className={labelStyle}>Method</label><div className={SELECT_WRAPPER_STYLE}><select id="method" value={resource.method} onChange={e => setResource(p => ({...p, method: e.target.value as 'GET'|'POST'}))} className={INPUT_BASE_STYLE}><option>GET</option><option>POST</option></select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
                <div><label htmlFor="auth" className={labelStyle}>Authentication</label><div className={SELECT_WRAPPER_STYLE}><select id="auth" value={resource.authType} onChange={e => setResource(p => ({...p, authType: e.target.value as any}))} className={INPUT_BASE_STYLE}><option value="none">None</option><option value="basic">Basic</option><option value="digest">Digest</option></select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>
            </div>
            {resource.authType !== 'none' && (
                 <div className="grid grid-cols-2 gap-4">
                    <div><label htmlFor="username" className={labelStyle}>Username</label><input id="username" type="text" value={resource.username} onChange={e => setResource(p => ({...p, username: e.target.value}))} className={INPUT_BASE_STYLE} /></div>
                    <div><label htmlFor="password" className={labelStyle}>Password</label><input id="password" type="password" value={resource.password} onChange={e => setResource(p => ({...p, password: e.target.value}))} className={INPUT_BASE_STYLE} /></div>
                </div>
            )}
            <div className="flex items-center justify-between"><label htmlFor="ssl" className="font-medium">Verify SSL certificate</label><div onClick={()=>setResource(p=>({...p, verifySsl: !p.verifySsl}))} className={`w-12 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors ${resource.verifySsl ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}><div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${resource.verifySsl ? 'translate-x-6' : 'translate-x-0'}`}></div></div></div>
             <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="timeout" className={labelStyle}>Timeout (seconds)</label><input id="timeout" type="number" value={resource.timeout} onChange={e => setResource(p => ({...p, timeout: parseInt(e.target.value)}))} className={INPUT_BASE_STYLE} /></div>
                <div><label htmlFor="encoding" className={labelStyle}>Character Encoding</label><input id="encoding" type="text" value={resource.encoding} onChange={e => setResource(p => ({...p, encoding: e.target.value}))} className={INPUT_BASE_STYLE} /></div>
            </div>
        </div>
    );
    
    const renderOptionsForm = () => (
        <div className="space-y-4">
             <h3 className="font-semibold text-lg">Options</h3>
             <div><label htmlFor="select" className={labelStyle}>Select*</label><input id="select" type="text" placeholder="td.first" value={options.select} onChange={e => setOptions(p => ({...p, select: e.target.value}))} className={INPUT_BASE_STYLE} required /></div>
             <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="index" className={labelStyle}>Index</label><input id="index" type="number" value={options.index} onChange={e => setOptions(p => ({...p, index: parseInt(e.target.value)}))} className={INPUT_BASE_STYLE} /></div>
                <div><label htmlFor="attribute" className={labelStyle}>Attribute</label><input id="attribute" type="text" value={options.attribute} onChange={e => setOptions(p => ({...p, attribute: e.target.value}))} className={INPUT_BASE_STYLE} /></div>
            </div>
        </div>
    );

    return (
        <Modal onClose={onClose} title="Manage Price Scrapers">
            <div className="flex gap-6 min-h-[500px]">
                <div className="w-1/3 border-r border-black/10 dark:border-white/10 pr-6">
                    <h3 className="font-semibold mb-2">Warrants (by ISIN)</h3>
                    <ul className="space-y-1">
                        {uniqueIsins.map(({isin, name}) => (
                            <li key={isin}>
                                <button onClick={() => setSelectedIsin(isin)} className={`w-full text-left p-2 rounded-md ${selectedIsin === isin ? 'bg-primary-100 dark:bg-primary-900/50' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                    <p className={`font-semibold ${selectedIsin === isin ? 'text-primary-700 dark:text-primary-200' : ''}`}>{isin}</p>
                                    <p className={`text-xs truncate ${selectedIsin === isin ? 'text-primary-600 dark:text-primary-300' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{name}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="w-2/3 flex flex-col justify-between">
                    {selectedIsin ? (
                        <>
                            <div>
                                {step === 1 ? renderResourceForm() : renderOptionsForm()}
                                {step === 2 && (
                                    <div className="mt-6">
                                        <button type="button" onClick={handleTest} className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`} disabled={isTesting}>
                                            {isTesting ? <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <span className="material-symbols-outlined">science</span>}
                                            Test
                                        </button>
                                        {testResult && <p className={`mt-2 text-sm p-2 rounded-md ${testResult.startsWith('Error') ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200' : 'bg-light-bg dark:bg-dark-bg'}`}>{testResult}</p>}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-black/10 dark:border-white/10 mt-4">
                                <div>{step === 2 && <button type="button" onClick={() => setStep(1)} className={BTN_SECONDARY_STYLE}>Back</button>}</div>
                                <div className="flex gap-4">
                                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                                    {step === 1 
                                        ? <button type="button" onClick={() => setStep(2)} className={BTN_PRIMARY_STYLE}>Next</button>
                                        : <button type="button" onClick={handleSave} className={BTN_PRIMARY_STYLE}>Save</button>
                                    }
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-light-text-secondary dark:text-dark-text-secondary"><p>Select a warrant to configure its price scraper.</p></div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ScraperConfigModal;