import React, { useState } from 'react';
import { Page, User } from '../types';
import PageHeader from '../components/PageHeader';

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
      className="w-full flex items-center justify-between p-5 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group first:rounded-t-2xl last:rounded-b-2xl text-left border-b border-black/5 dark:border-white/5 last:border-0"
    >
      <div className="flex items-center gap-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        <div>
          <h3 className="font-bold text-light-text dark:text-dark-text text-lg tracking-tight">{title}</h3>
          {description && <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-0.5 opacity-60 uppercase tracking-tight">{description}</p>}
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
        <span className="material-symbols-outlined text-lg">chevron_right</span>
      </div>
    </button>
  );

  return (
    <div className="w-full space-y-10 animate-fade-in-up pb-12 px-4">
      {/* Header */}
      <PageHeader
        markerIcon="settings"
        markerLabel="Control Center"
        title="Settings"
        subtitle="Manage your account, preferences, and data."
      />

      {/* Profile Section */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-primary-600 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
        <button
          type="button"
          onClick={() => handleNavigation('Personal Info')}
          className="relative w-full text-left bg-white dark:bg-dark-card rounded-2xl p-7 shadow-sm border border-black/5 dark:border-white/5 flex flex-col sm:flex-row items-center gap-6 cursor-pointer hover:shadow-xl transition-all"
        >
          <div className="relative">
            {profileImageError || !user.profilePictureUrl ? (
              <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-dark-card shadow-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center text-3xl font-black uppercase">
                {user.firstName?.charAt(0)}
                {user.lastName?.charAt(0)}
              </div>
            ) : (
              <img
                src={user.profilePictureUrl}
                alt={`${user.firstName} ${user.lastName}`}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white dark:border-dark-card shadow-lg"
                loading="lazy"
                onError={() => setProfileImageError(true)}
              />
            )}
            <div className="absolute -bottom-2 -right-2 bg-primary-500 text-white w-8 h-8 flex items-center justify-center rounded-lg border-4 border-white dark:border-dark-card shadow-md">
              <span className="material-symbols-outlined text-base">edit</span>
            </div>
          </div>
          <div className="flex-grow text-center sm:text-left">
            <h2 className="text-2xl font-black text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors leading-tight">{user.firstName} {user.lastName}</h2>
            <p className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60">{user.email}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-4">
               <span className="px-3 py-1 rounded-lg bg-primary-500 text-white text-[10px] font-black uppercase tracking-widest">{user.role}</span>
               <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800/30">Verified</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-primary-500 font-bold text-sm">
            <span>Manage Profile</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </div>
        </button>
      </div>

      {/* Grid Layout for Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* App Settings Group */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em] ml-2 opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">tune</span>
            Experience
          </h3>
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
            <SettingItem
              page="Preferences"
              icon="palette"
              title="Preferences"
              description="Theme, currency, and formats"
              colorClass="bg-blue-500 text-white shadow-blue-500/20"
            />
            <SettingItem
              page="Integrations"
              icon="extension"
              title="Integrations"
              description="Banks and Market APIs"
              colorClass="bg-indigo-500 text-white shadow-indigo-500/20"
            />
             <SettingItem
              page="Merchants"
              icon="store"
              title="Merchants"
              description="Identity and visibility"
              colorClass="bg-emerald-500 text-white shadow-emerald-500/20"
            />
          </div>
        </div>

        {/* Workspace Organization Group */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em] ml-2 opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">category</span>
            Workspace
          </h3>
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden h-fit">
            <SettingItem 
              page="Categories" 
              icon="grid_view" 
              title="Categories" 
              description="Income & Expense schema"
              colorClass="bg-orange-500 text-white shadow-orange-500/20"
            />
            <SettingItem 
              page="Tags" 
              icon="label" 
              title="Tags" 
              description="Custom filtering labels"
              colorClass="bg-pink-500 text-white shadow-pink-500/20"
            />
            <SettingItem 
              page="Tasks" 
              icon="fact_check" 
              title="Action Board" 
              description="Operational task protocols"
              colorClass="bg-blue-600 text-white shadow-blue-600/20"
            />
          </div>

           {/* System Group inside right col for balance */}
           <div className="pt-4 space-y-4">
            <h3 className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em] ml-2 opacity-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">settings_system_daydream</span>
              Infrastructure
            </h3>
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
              <SettingItem 
                page="Data Management" 
                icon="database" 
                title="Data Desk" 
                description="Import, Export, Sync"
                colorClass="bg-cyan-500 text-white shadow-cyan-500/20"
              />
              <SettingItem 
                page="Documentation" 
                icon="menu_book" 
                title="Knowledge" 
                description="User guide & APIs"
                colorClass="bg-slate-500 text-white shadow-slate-500/20"
              />
            </div>
          </div>
        </div>
      </div>

       {/* Version Info */}
       <div className="flex justify-center items-center gap-4 pt-12">
          <div className="h-px bg-black/5 dark:bg-white/5 flex-grow max-w-[100px]"></div>
          <p className="text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-40">Crystal Edition v1.0.0</p>
          <div className="h-px bg-black/5 dark:bg-white/5 flex-grow max-w-[100px]"></div>
       </div>

    </div>
  );
};

export default Settings;
