
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
    const [provider, setProvider] = useState<AIProvider>(config.provider);
    const [apiKey, setApiKey] = useState(config.apiKey || '');
    const [model, setModel] = useState(config.model || '');

    const providers: { id: AIProvider; name: string; description: string; models: string[]; hasKey: boolean }[] = [
        {
            id: 'gemini',
            name: 'Google Gemini',
            description: 'Native high-performance models (Google AI Studio). No configuration needed by default.',
            models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
            hasKey: false
        },
        {
            id: 'groq',
            name: 'Groq (Free/Paid)',
            description: 'Ultra-fast inference for open-source models like Llama 3, Gemma 2, and Mixtral.',
            models: [
                'llama-3.3-70b-versatile', 
                'llama-3.1-8b-instant', 
                'gemma2-9b-it', 
                'mixtral-8x7b-32768',
                'deepseek-r1-distill-llama-70b',
                'deepseek-r1-distill-qwen-32b',
                'deepseek-r1-distill-llama-8b'
            ],
            hasKey: true
        },
        {
            id: 'openrouter',
            name: 'OpenRouter',
            description: 'Unified API for any model. Great for comparing different providers.',
            models: [
                'meta-llama/llama-3.3-70b-instruct',
                'anthropic/claude-3.5-sonnet', 
                'deepseek/deepseek-r1',
                'deepseek/deepseek-v3',
                'openai/gpt-4o',
                'google/gemini-pro-1.5',
                'google/gemma-2-27b-it'
            ],
            hasKey: true
        }
    ];

    const handleSave = () => {
        onUpdateConfig({ provider, apiKey, model });
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
                    <Card>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">Select Provider</h3>
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
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">Configuration</h3>
                        <div className="space-y-6">
                            {activeProvider?.hasKey && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-light-text dark:text-dark-text">API Key</label>
                                    <div className="relative">
                                        <input 
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder={`Enter your ${activeProvider.name} API key...`}
                                            className={INPUT_BASE_STYLE}
                                        />
                                        <span className="absolute right-3 top-2.5 material-symbols-outlined text-gray-400">key</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500">Keys are stored locally in your browser and never sent to our servers.</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-light-text dark:text-dark-text">Target Model</label>
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
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-primary-500">info</span>
                            <h4 className="font-bold text-light-text dark:text-dark-text">Why use Groq?</h4>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mb-4">
                            Groq provides sub-second inference speeds for open-source models like <b>Llama 3</b> and <b>Gemma 2</b>. 
                            It has a very generous free tier, making it the perfect choice for a "free" local-feeling experience.
                        </p>
                        <a 
                            href="https://console.groq.com/keys" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary-500 font-bold hover:underline flex items-center gap-1"
                        >
                            Get Groq Key <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </a>
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
