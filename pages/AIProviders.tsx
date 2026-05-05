
import React, { useState } from 'react';
import { AIProvider, AIConfig } from '../types';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE } from '../constants';

interface AIProvidersProps {
    config: AIConfig;
    onUpdateConfig: (config: AIConfig) => void;
}

const AIProviders: React.FC<AIProvidersProps> = ({ config, onUpdateConfig }) => {
    const [isEnabled, setIsEnabled] = useState(config.enabled !== false);
    const [provider, setProvider] = useState<AIProvider>(config.provider);
    const [providerKeys, setProviderKeys] = useState<Record<AIProvider, string>>(config.providerKeys || {
        gemini: '',
        groq: '',
        openrouter: '',
        together: ''
    } as any);
    const [model, setModel] = useState(config.model || '');
    const [statusData, setStatusData] = useState<{label: string, value: string, subValue?: string, status: string} | null>(null);
    const [checkError, setCheckError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    const providers: { id: AIProvider; name: string; description: string; models: string[]; hasKey: boolean; pricing?: string; consoleUrl: string }[] = [
        {
            id: 'gemini',
            name: 'Google Gemini',
            description: 'Native high-performance models (Google AI Studio). Best for accuracy and complex financial tasks.',
            models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
            hasKey: true,
            pricing: 'Free (Spark) / Paid (Pay-as-you-go)',
            consoleUrl: 'https://aistudio.google.com/app/apikey'
        },
        {
            id: 'groq',
            name: 'Groq (Free/Paid)',
            description: 'Ultra-fast inference for open-source models like Llama 3 and Gemma 2. Incredible speed.',
            models: [
                'llama-3.3-70b-versatile', 
                'llama-3.1-70b-versatile',
                'llama-3.1-8b-instant', 
                'gemma2-9b-it', 
                'mixtral-8x7b-32768',
                'deepseek-r1-distill-llama-70b',
                'deepseek-r1-distill-qwen-32b'
            ],
            hasKey: true,
            pricing: 'Generous Free Tier / Paid',
            consoleUrl: 'https://console.groq.com/keys'
        },
        {
            id: 'openrouter',
            name: 'OpenRouter',
            description: 'Unified API for any model. Great for comparing different providers and accessing closed models.',
            models: [
                'meta-llama/llama-3.3-70b-instruct',
                'anthropic/claude-3.5-sonnet', 
                'deepseek/deepseek-r1',
                'deepseek/deepseek-v3',
                'openai/gpt-4o',
                'google/gemini-pro-1.5',
                'google/gemma-2-27b-it'
            ],
            hasKey: true,
            pricing: 'Pay-per-token',
            consoleUrl: 'https://openrouter.ai/settings/keys'
        },
        {
            id: 'together',
            name: 'Together AI',
            description: 'The AI Research Company. High-quality open-source model hosting with great API stability.',
            models: [
                'meta-llama/Llama-3.3-70B-Instruct-Turbo',
                'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
                'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
                'mistralai/Mixtral-8x7B-Instruct-v0.1',
                'deepseek-ai/DeepSeek-V3',
                'deepseek-ai/DeepSeek-R1'
            ],
            hasKey: true,
            pricing: '$5 Free Trial / Pay-per-token',
            consoleUrl: 'https://api.together.ai/settings/api-keys'
        }
    ];

    const checkStatus = async () => {
        const key = providerKeys[provider];
        if (!key && provider !== 'gemini') {
            setCheckError('Please provide an API key first.');
            return;
        }

        setIsChecking(true);
        setCheckError(null);
        setStatusData(null);

        try {
            if (provider === 'openrouter') {
                const res = await fetch('https://openrouter.ai/api/v1/user/key', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (!res.ok) throw new Error('Invalid key or API error');
                const data = await res.json();
                setStatusData({
                    label: 'Credits / Limit',
                    value: `$${data.data?.limit?.toFixed(4) || '0.000'}`,
                    subValue: `Usage: $${data.data?.usage?.toFixed(4) || '0.000'}`,
                    status: 'active'
                });
            } else if (provider === 'groq') {
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (!res.ok) throw new Error('Invalid Groq key');
                setStatusData({
                    label: 'Status',
                    value: 'API Key Verified',
                    subValue: 'Rate limits apply based on tier',
                    status: 'active'
                });
            } else if (provider === 'together') {
                 const res = await fetch('https://api.together.xyz/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (!res.ok) throw new Error('Invalid Together AI key');
                setStatusData({
                    label: 'Status',
                    value: 'API Key Verified',
                    subValue: 'Check console for billing details',
                    status: 'active'
                });
            } else if (provider === 'gemini') {
                setStatusData({
                    label: 'Status',
                    value: 'Ready',
                    subValue: 'Using Google AI Studio',
                    status: 'active'
                });
            }
        } catch (err: any) {
            setCheckError(err.message || 'Failed to check status');
        } finally {
            setIsChecking(false);
        }
    };

    const handleSave = () => {
        onUpdateConfig({ 
            enabled: isEnabled,
            provider, 
            model, 
            providerKeys,
            apiKey: providerKeys[provider] // Set active key for backward compat
        });
    };

    const activeProvider = providers.find(p => p.id === provider);

    return (
        <div className="space-y-8 animate-fade-in-up pb-12">
            <PageHeader 
                markerIcon="psychology"
                markerLabel="Intelligence Engine"
                title="AI Providers" 
                subtitle="Manage your AI intelligence engines. Switch between free open-source models and high-performance LLMs."
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className={`${!isEnabled ? 'opacity-50 grayscale pointer-events-none' : ''} transition-all duration-300`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Select Provider</h3>
                            {!isEnabled && <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded-full">AI Disabled</span>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {providers.map((p) => (
                                <div 
                                    key={p.id}
                                    onClick={() => {
                                        setProvider(p.id);
                                        setModel(p.models[0]);
                                    }}
                                    className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                                        provider === p.id 
                                        ? 'border-primary-500 bg-primary-500/5' 
                                        : 'border-transparent bg-gray-50 dark:bg-dark-fill hover:border-gray-200 dark:hover:border-white/10'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-light-text dark:text-dark-text">{p.name}</h4>
                                        {provider === p.id && (
                                            <span className="material-symbols-outlined text-primary-500">check_circle</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                        {p.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">API Keys Management</h3>
                        <div className="space-y-6">
                            {providers.map(p => (
                                <div key={p.id} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                                            {p.name} Key
                                            {p.id === provider && <span className="text-[10px] bg-primary-500/10 text-primary-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Active Provider</span>}
                                        </label>
                                        <span className="text-[10px] text-gray-500">{p.pricing}</span>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="password"
                                            value={providerKeys[p.id] || ''}
                                            onChange={(e) => setProviderKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                                            placeholder={`Enter ${p.name} API key...`}
                                            className={INPUT_BASE_STYLE}
                                        />
                                        <span className="absolute right-3 top-2.5 material-symbols-outlined text-gray-400">key</span>
                                    </div>
                                    {p.id === 'gemini' && !providerKeys.gemini && (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                            Using system default key. Provide your own to avoid rate limits.
                                        </p>
                                    )}
                                </div>
                            ))}
                            <p className="text-[10px] text-gray-500 italic">Keys are stored locally in your browser and never sent to our servers.</p>
                        </div>
                    </Card>

                    <Card>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">Model Selection</h3>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-light-text dark:text-dark-text">Target Model for {activeProvider?.name}</label>
                                <select 
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className={INPUT_BASE_STYLE}
                                >
                                    {activeProvider?.models.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    <option value="custom">Custom ID...</option>
                                </select>
                                {model === 'custom' && (
                                    <input 
                                        type="text"
                                        placeholder="Enter model string (e.g. gpt-4o)..."
                                        onChange={(e) => setModel(e.target.value)}
                                        className={`${INPUT_BASE_STYLE} mt-2`}
                                    />
                                )}
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button onClick={handleSave} className={BTN_PRIMARY_STYLE}>
                                    Save AI Configuration
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-primary-500/5 border-primary-500/20">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500">power_settings_new</span>
                                <h4 className="font-bold text-light-text dark:text-dark-text">Enable AI Features</h4>
                            </div>
                            <button 
                                onClick={() => {
                                    const next = !isEnabled;
                                    setIsEnabled(next);
                                    // Auto-save this specific toggle for better UX
                                    onUpdateConfig({ ...config, enabled: next });
                                }}
                                className={`w-12 h-6 rounded-full transition-colors relative ${isEnabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                            Turn off to disable all AI-powered suggestions, insights, and predictive forecasting across the application.
                        </p>
                    </Card>

                    <Card className={`bg-primary-500/5 border-primary-500/20 ${!isEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500">analytics</span>
                                <h4 className="font-bold text-light-text dark:text-dark-text">Usage & Status</h4>
                            </div>
                            <button 
                                onClick={checkStatus} 
                                disabled={isChecking}
                                className="text-[10px] font-bold text-primary-500 hover:underline uppercase tracking-wider"
                            >
                                {isChecking ? 'Checking...' : 'Refresh Status'}
                            </button>
                        </div>
                        
                        {statusData ? (
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">{statusData.label}</p>
                                    <p className="text-xl font-bold text-light-text dark:text-dark-text">{statusData.value}</p>
                                    {statusData.subValue && (
                                        <p className="text-xs text-primary-500 font-medium">{statusData.subValue}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Provider Online</span>
                                </div>
                            </div>
                        ) : checkError ? (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-xs text-red-500 font-medium">{checkError}</p>
                            </div>
                        ) : (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">
                                Click "Refresh Status" to verify your {activeProvider?.name} configuration.
                            </p>
                        )}

                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5 space-y-4">
                            <a 
                                href={activeProvider?.consoleUrl}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-light-text dark:text-dark-text font-bold hover:underline flex items-center justify-between"
                            >
                                <span>Go to {activeProvider?.name} Console</span>
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                            </a>
                        </div>
                    </Card>

                    <Card className="bg-primary-500/5 border-primary-500/20">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-primary-500">info</span>
                            <h4 className="font-bold text-light-text dark:text-dark-text">Why use Groq?</h4>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mb-4">
                            Groq provides sub-second inference speeds for open-source models. It's the perfect choice for a "free" local-feeling experience.
                        </p>
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mb-4">
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                <b>Note:</b> Free tier has strict rate limits. If you experience errors, try waiting a minute or switching to a smaller model.
                            </p>
                        </div>
                    </Card>

                    <Card>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-primary-500">shield_lock</span>
                            <h4 className="font-bold text-light-text dark:text-dark-text">Privacy Mode</h4>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                            Financial data sent to LLMs is anonymized (merchant names and amounts only). No personal identification info (names, emails, bank accounts) is ever sent.
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AIProviders;
