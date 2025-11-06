import React from 'react';
import { Page } from '../types';
import Card from '../components/Card';

interface AIAssistantSettingsProps {
  setCurrentPage: (page: Page) => void;
}

const AIAssistantSettings: React.FC<AIAssistantSettingsProps> = ({ setCurrentPage }) => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                <span> / </span>
                <span className="text-light-text dark:text-dark-text font-medium">AI Assistant</span>
            </div>
        </div>
        <div className="mt-4">
            <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Configure and learn about the AI-powered features in Finaura.</p>
        </div>
      </header>

      <Card>
        <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">About the AI Assistant</h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          Finaura uses Google's powerful Gemini family of models to provide AI-powered features like the chat assistant and smart financial planning. These features help you analyze your finances and get insights by asking questions in natural language.
        </p>
      </Card>

      <Card>
        <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">API Key Configuration</h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
          To use the AI features, a Google Gemini API key must be provided. This application is designed to securely access the key from an environment variable.
        </p>
        <div className="p-4 bg-light-bg dark:bg-dark-bg rounded-lg">
          <p className="font-semibold">How to set the API Key:</p>
          <ol className="list-decimal list-inside text-sm mt-2 space-y-2">
            <li>
              Obtain a Gemini API key from <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">Google AI Studio</a>.
            </li>
            <li>
              When running this application locally, create a file named <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded text-xs">.env.local</code> in the root directory.
            </li>
            <li>
              Add the following line to the file, replacing <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded text-xs">YOUR_API_KEY</code> with your actual key:
            </li>
          </ol>
          <pre className="bg-gray-200 dark:bg-gray-900 p-3 rounded-md mt-2 text-sm overflow-x-auto">
            <code>GEMINI_API_KEY=YOUR_API_KEY</code>
          </pre>
           <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-4">
             Note: The application does not provide an input field for the API key for security reasons. The key must be configured in the execution environment before starting the app.
           </p>
        </div>
      </Card>
    </div>
  );
};

export default AIAssistantSettings;
