import React from 'react';
import { Page, User } from '../types';
import Card from '../components/Card';

const settingsLinks = [
  { page: 'Preferences', icon: 'tune', title: 'Preferences', description: 'Customize the look and feel of the app.' },
  { page: 'Personal Info', icon: 'person', title: 'Personal Info', description: 'Update your profile and security settings.' },
  { page: 'AI Assistant', icon: 'smart_toy', title: 'AI Assistant', description: 'Configure AI-powered features.' },
  { page: 'Categories', icon: 'category', title: 'Categories', description: 'Manage your income and expense categories.' },
  { page: 'Data Management', icon: 'database', title: 'Data Management', description: 'Import, export, or reset your account data.' },
  { page: 'Documentation', icon: 'menu_book', title: 'Documentation', description: 'Learn about Finaura\'s features.' },
];

interface SettingsProps {
  setCurrentPage: (page: Page) => void;
  user: User;
}

const Settings: React.FC<SettingsProps> = ({ setCurrentPage, user }) => {
  
  const handleNavigation = (page: Page) => {
    // This provides a smoother perceived navigation on mobile
    if (window.innerWidth < 768) {
      setTimeout(() => setCurrentPage(page), 150);
    } else {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        
        <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Select a category to configure application settings.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsLinks.map(link => {
          return (
            <Card key={link.page} onClick={() => handleNavigation(link.page as Page)} className="cursor-pointer hover:shadow-lg dark:hover:bg-dark-card/60 transition-all duration-200 group hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-primary-100 dark:bg-primary-900/50 p-3 rounded-lg group-hover:bg-primary-200/80 dark:group-hover:bg-primary-900/80 transition-colors">
                    <span className="material-symbols-outlined text-primary-500 text-2xl">{link.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{link.title}</h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{link.description}</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary transform -translate-x-2 group-hover:translate-x-0 transition-transform">chevron_right</span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  );
};

export default Settings;
