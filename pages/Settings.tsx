import React, { useState } from 'react';
import { Page, User } from '../types';
import PageHeader from '../components/PageHeader';
import HeaderButton from '../components/HeaderButton';
import Icon from '../components/ui/Icon';

interface SettingsProps {
  setCurrentPage: (page: Page) => void;
  user: User;
}

interface SettingCardProps {
  page: Page;
  icon: string;
  title: string;
  description: string;
  colorClass: string;
  badge?: string;
  badgeColor?: string;
  onClick: (page: Page) => void;
}

const SettingCard: React.FC<SettingCardProps> = ({
  page,
  icon,
  title,
  description,
  colorClass,
  badge,
  badgeColor = 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20',
  onClick,
}) => (
  <button
    type="button"
    onClick={() => onClick(page)}
    className="w-full flex items-center justify-between p-4 sm:p-5 bg-white dark:bg-dark-card hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 hover:border-primary-500/30 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-left relative overflow-hidden"
  >
    <div className="flex items-center gap-4 min-w-0">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorClass} shadow-sm group-hover:scale-110 transition-transform duration-200 shrink-0`}>
        <Icon name={icon} className="text-xl" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-light-text dark:text-dark-text text-sm sm:text-base tracking-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
            {title}
          </h3>
          {badge && (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5 opacity-70 truncate leading-relaxed">
          {description}
        </p>
      </div>
    </div>
    <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all shrink-0 ml-3">
      <Icon name="chevron_right" className="text-base group-hover:translate-x-0.5 transition-transform" />
    </div>
  </button>
);

const Settings: React.FC<SettingsProps> = ({ setCurrentPage, user }) => {
  const [profileImageError, setProfileImageError] = useState(false);

  const handleNavigation = (page: Page) => {
    if (window.innerWidth < 768) {
      setTimeout(() => setCurrentPage(page), 120);
    } else {
      setCurrentPage(page);
    }
  };

  return (
    <div className="w-full space-y-8 animate-fade-in-up pb-12 px-4">
      {/* Header */}
      <PageHeader
        markerIcon="settings"
        markerLabel="Control Center"
        title="Settings & Governance"
        subtitle="Configure system preferences, security parameters, taxonomy blueprints, and telemetry integrations."
      />

      {/* User Profile Banner Card */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-3xl blur-sm opacity-10 group-hover:opacity-20 transition duration-500"></div>
        <div className="relative bg-white dark:bg-dark-card rounded-2xl p-6 sm:p-7 shadow-sm border border-black/5 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left min-w-0">
            <div className="relative shrink-0">
              {profileImageError || !user.profilePictureUrl ? (
                <div className="w-20 h-20 rounded-2xl border-2 border-white dark:border-dark-card shadow-md bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center text-2xl font-bold">
                  {user.firstName?.charAt(0)}
                  {user.lastName?.charAt(0)}
                </div>
              ) : (
                <img
                  src={user.profilePictureUrl}
                  alt={`${user.firstName} ${user.lastName}`}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white dark:border-dark-card shadow-md"
                  loading="lazy"
                  onError={() => setProfileImageError(true)}
                />
              )}
              <div className="absolute -bottom-1 -right-1 bg-primary-500 text-white w-6 h-6 flex items-center justify-center rounded-lg border-2 border-white dark:border-dark-card shadow-xs">
                <Icon name="edit" className="text-xs" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors leading-tight truncate">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary opacity-70 truncate mt-0.5">
                {user.email}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-bold border border-primary-500/20">
                  {user.role}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                  <Icon name="verified" className="text-[12px]" />
                  Verified Account
                </span>
              </div>
            </div>
          </div>

          <HeaderButton
            variant="secondary"
            icon="fingerprint"
            onClick={() => handleNavigation('Personal Info')}
          >
            Manage Profile
          </HeaderButton>
        </div>
      </div>

      {/* Main Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: System & Environment */}
        <div className="space-y-6">
          {/* Section: Experience & Preferences */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Icon name="tune" className="text-primary-500 text-base" />
              <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-80">
                Experience & Preferences
              </h3>
            </div>
            <div className="space-y-3">
              <SettingCard
                page="Preferences"
                icon="palette"
                title="Preferences"
                description="Theme modes, primary currency, date formats & privacy blur"
                colorClass="bg-blue-500 text-white"
                onClick={handleNavigation}
              />
              <SettingCard
                page="Integrations"
                icon="extension"
                title="Integrations & APIs"
                description="Twelve Data, Brandfetch logos, Open Banking & AI"
                colorClass="bg-indigo-500 text-white"
                onClick={handleNavigation}
              />
            </div>
          </div>

          {/* Section: Automation & Telemetry */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Icon name="smart_toy" className="text-primary-500 text-base" />
              <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-80">
                Automation & Intelligence
              </h3>
            </div>
            <div className="space-y-3">
              <SettingCard
                page="Rules"
                icon="settings_suggest"
                title="Rule Engine"
                description="Custom IF-WHEN-THEN rules for auto-categorization"
                colorClass="bg-teal-500 text-white"
                badge="Active"
                badgeColor="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                onClick={handleNavigation}
              />
              <SettingCard
                page="Merchants"
                icon="storefront"
                title="Merchants & Institutions"
                description="Metadata enrichment, logos, and regex routing rules"
                colorClass="bg-emerald-500 text-white"
                onClick={handleNavigation}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Taxonomy & Infrastructure */}
        <div className="space-y-6">
          {/* Section: Workspace Taxonomy */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Icon name="category" className="text-primary-500 text-base" />
              <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-80">
                Workspace & Taxonomy
              </h3>
            </div>
            <div className="space-y-3">
              <SettingCard
                page="Categories"
                icon="grid_view"
                title="Categories"
                description="Parent & sub-node structure for expenses and income"
                colorClass="bg-orange-500 text-white"
                onClick={handleNavigation}
              />
              <SettingCard
                page="Tags"
                icon="sell"
                title="Tags"
                description="Custom labels, lifestyle markers, and project tagging"
                colorClass="bg-pink-500 text-white"
                onClick={handleNavigation}
              />
            </div>
          </div>

          {/* Section: Infrastructure & Ledger */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Icon name="storage" className="text-primary-500 text-base" />
              <h3 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-80">
                Infrastructure & Ledger
              </h3>
            </div>
            <div className="space-y-3">
              <SettingCard
                page="Data Management"
                icon="database"
                title="Data Management"
                description="Atomic CSV/JSON imports, export ledgers, backups"
                colorClass="bg-cyan-500 text-white"
                onClick={handleNavigation}
              />
              <SettingCard
                page="Documentation"
                icon="menu_book"
                title="Knowledge Base"
                description="Detailed user guide, system design, and API specs"
                colorClass="bg-slate-500 text-white"
                onClick={handleNavigation}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex justify-center items-center gap-4 pt-8">
        <div className="h-px bg-black/5 dark:bg-white/5 flex-grow max-w-[100px]"></div>
        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest opacity-50">
          Crystal Edition v1.0.0
        </p>
        <div className="h-px bg-black/5 dark:bg-white/5 flex-grow max-w-[100px]"></div>
      </div>
    </div>
  );
};

export default Settings;
