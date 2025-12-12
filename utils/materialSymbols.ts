const EXTRA_TAGS: Record<string, string[]> = {
  weekend: ['couch', 'sofa', 'relax', 'sleep'],
  chair: ['seat', 'couch', 'sofa', 'sit'],
  living: ['couch', 'sofa', 'living_room', 'home'],
  event_seat: ['couch', 'sofa', 'seat', 'theater'],
  bed: ['sleep', 'nap', 'bedroom'],
  night_shelter: ['shelter', 'home', 'housing', 'bed', 'couch'],
  crib: ['baby', 'bed', 'infant'],
  baby_changing_station: ['baby', 'infant'],
  family_restroom: ['restroom', 'family', 'bathroom'],
  child_care: ['baby', 'kids', 'childcare'],
  pets: ['dog', 'cat', 'animal'],
  bathtub: ['bathroom', 'tub', 'shower'],
};

const ICON_LIBRARY_INTERNAL: string[] = [
  'account_balance', 'savings', 'credit_card', 'account_balance_wallet', 'wallet', 'paid', 'monetization_on',
  'attach_money', 'price_check', 'payments', 'receipt', 'receipt_long', 'request_quote', 'currency_exchange',
  'currency_bitcoin', 'show_chart', 'trending_up', 'bar_chart', 'pie_chart', 'analytics', 'real_estate_agent',
  'gavel', 'store', 'local_mall', 'shopping_cart', 'shopping_bag', 'shopping_basket', 'sell', 'local_offer',
  'work', 'badge', 'construction', 'build', 'verified', 'security', 'lock', 'key', 'fingerprint', 'help', 'info',
  'home', 'cottage', 'apartment', 'map', 'location_on', 'directions_car', 'electric_car', 'local_gas_station',
  'directions_bus', 'train', 'flight', 'weekend', 'chair', 'living', 'event_seat', 'bed', 'night_shelter', 'crib',
  'baby_changing_station', 'family_restroom', 'child_care', 'pets', 'bathtub', 'local_florist', 'park', 'nature',
  'forest', 'devices', 'smartphone', 'laptop', 'desktop_windows', 'tablet', 'tv', 'router', 'memory', 'cloud',
  'cloud_upload', 'cloud_download', 'download', 'upload', 'sync', 'code', 'terminal', 'camera_alt', 'photo_camera',
  'photo_library', 'image', 'collections', 'music_note', 'mic', 'chat', 'mail', 'send', 'videocam', 'notifications',
  'notifications_active', 'language', 'translate', 'travel_explore', 'calendar_today', 'calendar_month', 'event',
  'schedule', 'alarm', 'timer', 'history', 'watch_later', 'health_and_safety', 'monitor_heart', 'healing',
  'medication', 'medical_services', 'volunteer_activism', 'self_improvement', 'fitness_center', 'sports_esports',
  'sports_tennis', 'sports_soccer', 'sports_basketball', 'run_circle', 'hiking', 'pool', 'restaurant', 'local_cafe',
  'local_bar', 'fastfood', 'emoji_food_beverage', 'liquor', 'cake', 'local_pizza', 'coffee', 'lightbulb',
  'electric_bolt', 'battery_charging_full', 'solar_power', 'eco', 'water_drop', 'wb_sunny', 'tune', 'filter_alt',
  'search', 'apps', 'dashboard', 'grid_view', 'view_list', 'view_kanban', 'view_timeline', 'view_week', 'settings',
  'insights'
];

const fuzzyMatch = (needle: string, haystack: string): boolean => {
  if (!needle) return true;
  if (!haystack) return false;

  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();

  let index = 0;
  for (let i = 0; i < h.length; i++) {
    if (h[i] === n[index]) {
      index++;
    }
    if (index === n.length) return true;
  }
  return false;
};

const buildTags = (name: string): string[] => {
  const base = name.split('_').filter(Boolean);
  const extras = EXTRA_TAGS[name] || [];
  return Array.from(new Set([...base, ...extras]));
};

export const ICON_LIBRARY: string[] = Array.from(new Set(ICON_LIBRARY_INTERNAL));

const MATERIAL_SYMBOL_METADATA = ICON_LIBRARY.map(name => ({
  name,
  tags: buildTags(name),
}));

export const searchMaterialSymbols = (term: string): string[] => {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];

  const matches = MATERIAL_SYMBOL_METADATA.filter(({ name, tags }) =>
    fuzzyMatch(normalized, name) || tags.some(tag => fuzzyMatch(normalized, tag))
  );

  return Array.from(new Set(matches.map(item => item.name)));
};

export default MATERIAL_SYMBOL_METADATA;
