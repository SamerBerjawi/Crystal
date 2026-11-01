import type { Page } from '../types';

export interface SettingEntry {
  id: string;
  label: string;
  page: Page;
  /** Where it lives, shown under the label. */
  where: string;
  /** The element to scroll to on that page. */
  anchor?: string;
}

const preference = (id: string, label: string, anchor: string): SettingEntry => ({ id, label, page: 'Preferences', where: 'Preferences', anchor });

export const SETTINGS_INDEX: SettingEntry[] = [
  { id: 'name', label: 'Name', page: 'Personal Info', where: 'Profile', anchor: 'profile-details' },
  { id: 'picture', label: 'Profile picture', page: 'Personal Info', where: 'Profile', anchor: 'profile-details' },
  { id: 'phone', label: 'Phone number', page: 'Personal Info', where: 'Profile', anchor: 'profile-details' },
  { id: 'city', label: 'Default city', page: 'Personal Info', where: 'Profile', anchor: 'profile-details' },
  { id: 'address', label: 'Address', page: 'Personal Info', where: 'Profile', anchor: 'profile-details' },
  { id: 'password', label: 'Change password', page: 'Personal Info', where: 'Profile', anchor: 'profile-security' },
  { id: 'pin', label: 'PIN lock', page: 'Personal Info', where: 'Profile', anchor: 'profile-security' },
  { id: 'auto-lock', label: 'Auto-lock', page: 'Personal Info', where: 'Profile', anchor: 'profile-security' },
  preference('theme', 'Theme', 'preferences-appearance'),
  preference('typeface', 'Typeface', 'preferences-appearance'),
  preference('currency', 'Main currency', 'preferences-region'),
  preference('country', 'Country', 'preferences-region'),
  preference('timezone', 'Timezone', 'preferences-region'),
  preference('date-format', 'Date format', 'preferences-calendar'),
  preference('fiscal-year', 'Financial year start', 'preferences-calendar'),
  preference('default-period', 'Default Overview period', 'preferences-defaults'),
  preference('forecast-horizon', 'Default forecast length', 'preferences-defaults'),
  preference('account-order', 'Default account order', 'preferences-defaults'),
  preference('transfers', 'Leave transfers out of charts', 'preferences-calculations'),
  preference('adjustments', 'Show balance adjustments', 'preferences-calculations'),
  preference('privacy', 'Hide balances at startup', 'preferences-calculations'),
  { id: 'banks', label: 'Bank connections', page: 'Integrations', where: 'Connections' },
  { id: 'twelve-data', label: 'Twelve Data key', page: 'Integrations', where: 'Connections' },
  { id: 'brandfetch', label: 'Brandfetch client ID', page: 'Integrations', where: 'Connections' },
  { id: 'categories', label: 'Categories', page: 'Categories', where: 'Categories' },
  { id: 'tags', label: 'Tags', page: 'Tags', where: 'Tags' },
  { id: 'import', label: 'Import data', page: 'Data Management', where: 'Data' },
  { id: 'export', label: 'Export data', page: 'Data Management', where: 'Data' },
  { id: 'backup', label: 'Back up and restore', page: 'Data Management', where: 'Data' },
  { id: 'reset', label: 'Erase all data', page: 'Data Management', where: 'Data', anchor: 'data-erase' },
  { id: 'help', label: 'Help', page: 'Documentation', where: 'Help' },
];
