
import React, { useState } from 'react';
import { Page, User } from '../types';

interface SettingsProps {
  setCurrentPage: (page: Page) => void;
  user: User;
}

const Settings: React.FC<SettingsProps> = ({ setCurrentPage, user }) => {
  const [profileImageError, setProfileImageError] = useState(false);

  const handleNavigation = (page: Page) => {
    if (window.innerWidth < 768) {
      setTimeout(() => setCurrentPage(page), 150);
    } else {
      setCurrentPage(page);
    }
  };

  const SettingItem = ({ page, icon, title, description, colorClass = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" }: { page: Page; icon: string; title: string; description?: string; colorClass?: string }) => (
    <button
      type="button"
      onClick={() => handleNavigation(page)}
      className="w-full flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group first:rounded-t-xl last:rounded-b-xl text-left"
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <div>
          <h3 className="font-medium text-light-text dark:text-dark-text text-base">{title}</h3>
          {description && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{description}</p>}
        </div>
      </div>
      <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary text-lg group-hover:translate-x-1 transition-transform">chevron_right</span>
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up pb-12">
      {/* Header */}
      <div>
        {/* <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">Settings</h1> */}
        <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Manage your account, preferences, and data.</p>
      </div>

      {/* Profile Section */}
      <button
        type="button"
        onClick={() => handleNavigation('Personal Info')}
        className="w-full text-left bg-white dark:bg-dark-card rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5 flex items-center gap-5 cursor-pointer hover:shadow-md transition-all group"
      >
        <div className="relative">
          {profileImageError || !user.profilePictureUrl ? (
            <div className="w-20 h-20 rounded-full border-2 border-white dark:border-dark-card shadow-sm bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center text-xl font-semibold">
              {user.firstName?.charAt(0)}
              {user.lastName?.charAt(0)}
            </div>
          ) : (
            <img
              src={user.profilePictureUrl}
              alt={`${user.firstName} ${user.lastName}`}
              className="w-20 h-20 rounded-full object-cover border-2 border-white dark:border-dark-card shadow-sm"
              loading="lazy"
              onError={() => setProfileImageError(true)}
            />
          )}
          <div className="absolute bottom-0 right-0 bg-primary-500 text-white p-1 rounded-full border-2 border-white dark:border-dark-card">
             <span className="material-symbols-outlined text-xs block">edit</span>
          </div>
        </div>
        <div className="flex-grow">
          <h2 className="text-xl font-bold text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors">{user.firstName} {user.lastName}</h2>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">{user.email}</p>
          <div className="flex items-center gap-2 mt-2">
             <span className="px-2 py-0.5 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium uppercase tracking-wide">{user.role}</span>
          </div>
        </div>
        <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary text-2xl">chevron_right</span>
      </button>

      {/* App Settings Group */}
      <div>
        <h3 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3 ml-2">App Settings</h3>
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5">
          <SettingItem
            page="Preferences"
            icon="tune"
            title="Preferences"
            description="Theme, currency, language, and regional formats"
            colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <SettingItem
            page="Integrations"
            icon="extension"
            title="Integrations"
            description="Manage API keys and external service connections"
            colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          />
          <SettingItem
            page="Merchants"
            icon="store"
            title="Merchant Logos"
            description="Review detected merchants and customize their logos"
            colorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          />
           <SettingItem
            page="AI Assistant"
            icon="smart_toy"
            title="AI Assistant"
            description="Configure API keys and AI behaviors"
            colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />
        </div>
      </div>

      {/* Organization Group */}
      <div>
        <h3 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3 ml-2">Organization</h3>
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5">
          <SettingItem 
            page="Categories" 
            icon="category" 
            title="Categories" 
            description="Manage income and expense categories"
            colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          />
          <SettingItem 
            page="Tags" 
            icon="label" 
            title="Tags" 
            description="Custom tags for transaction filtering"
            colorClass="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
          />
        </div>
      </div>

       {/* System Group */}
       <div>
        <h3 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3 ml-2">System</h3>
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5">
          <SettingItem 
            page="Data Management" 
            icon="database" 
            title="Data Management" 
            description="Import, export, backup, and reset data"
            colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
          <SettingItem 
            page="Documentation" 
            icon="menu_book" 
            title="Documentation" 
            description="Learn about features and usage"
            colorClass="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          />
        </div>
      </div>

       {/* Version Info */}
       <div className="text-center pt-4">
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Crystal v1.0.0</p>
       </div>

    </div>
  );
};

export default Settings;
