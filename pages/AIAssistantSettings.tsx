
import React from 'react';
import { Page } from '../types';
import Card from '../components/Card';
import { BTN_SECONDARY_STYLE } from '../constants';

interface AIAssistantSettingsProps {
  setCurrentPage: (page: Page) => void;
}

const AIAssistantSettings: React.FC<AIAssistantSettingsProps> = ({ setCurrentPage }) => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 animate-fade-in-up">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
          <button onClick={() => setCurrentPage('Settings')} className="hover:text-primary-500 flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                <span>Settings</span>
          </button>
          <span>/</span>
          <span className="font-medium text-light-text dark:text-dark-text">AI Assistant</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">AI Assistant</h1>
           <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Power up your finance dashboard with Google Gemini.</p>
        </div>
        <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className={`${BTN_SECONDARY_STYLE} flex items-center gap-2 no-underline`}
        >
            <span className="material-symbols-outlined text-lg">key</span>
            Get API Key
        </a>
      </header>

      {/* Content */}
      <div className="grid gap-6">
          <Card>
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">smart_toy</span>
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">About the Integration</h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                      Crystal uses Google's powerful Gemini models to provide AI-powered features like the chat assistant and smart financial planning.
                      These features allow you to analyze your finances, get budget advice, and generate plans by simply asking questions in natural language.
                    </p>
                </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">lock</span>
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">Configuration</h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                      To use these features, a Google Gemini API key is required. This application is designed to securely access the key from your environment variables.
                    </p>
                    
                    <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5">
                      <p className="font-semibold text-sm mb-2">How to set up:</p>
                      <ol className="list-decimal list-inside text-sm space-y-2 text-light-text-secondary dark:text-dark-text-secondary">
                        <li>
                          Obtain a Gemini API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">Google AI Studio</a>.
                        </li>
                        <li>
                          Create a file named <code className="bg-white dark:bg-white/10 px-1.5 py-0.5 rounded text-xs border border-black/5 dark:border-white/5">.env.local</code> in the root directory.
                        </li>
                        <li>
                          Add the following line to the file:
                        </li>
                      </ol>
                      <div className="mt-3 relative group">
                          <pre className="bg-white dark:bg-black/40 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-black/5 dark:border-white/5 text-light-text dark:text-dark-text">
                            <code>GEMINI_API_KEY=your_key_here</code>
                          </pre>
                      </div>
                       <div className="flex items-start gap-2 mt-4 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg">
                           <span className="material-symbols-outlined text-sm">info</span>
                           <p>
                             For security, the application does not allow entering the API key directly in the browser. It must be configured in the environment before starting the app.
                           </p>
                       </div>
                    </div>
                </div>
            </div>
          </Card>
      </div>
    </div>
  );
};

export default AIAssistantSettings;
