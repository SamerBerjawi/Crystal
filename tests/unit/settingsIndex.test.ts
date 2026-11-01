import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETTINGS_INDEX } from '../../utils/settingsIndex';
import { HUBS } from '../../utils/navigation';

test('every setting has a unique id and label', () => {
  assert.equal(new Set(SETTINGS_INDEX.map(entry => entry.id)).size, SETTINGS_INDEX.length);
  assert.equal(new Set(SETTINGS_INDEX.map(entry => entry.label)).size, SETTINGS_INDEX.length);
});

test('every setting points at a Settings tab', () => {
  const settings = HUBS.find(hub => hub.id === 'settings')!;
  const pages = settings.tabs.map(tab => tab.page);
  for (const entry of SETTINGS_INDEX) assert.ok(pages.includes(entry.page), entry.label);
});

test('every anchor exists on its page', () => {
  const sources: Record<string, string> = {
    'Personal Info': readFileSync('pages/PersonalInfo.tsx', 'utf8'),
    Preferences: readFileSync('pages/Preferences.tsx', 'utf8'),
    'Data Management': readFileSync('pages/DataImportExport.tsx', 'utf8'),
  };
  for (const entry of SETTINGS_INDEX.filter(item => item.anchor)) {
    assert.ok(sources[entry.page]?.includes(`id="${entry.anchor}"`), entry.label);
  }
});
