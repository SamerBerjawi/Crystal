/**
 * Phosphor Icons Catalog & Search Index
 * 1,200+ Duotone Icons from @phosphor-icons/react (https://phosphoricons.com/?weight=duotone)
 */

export interface PhosphorIconItem {
  name: string;
  label: string;
  category: string;
  tags: string[];
}

export const PHOSPHOR_CATEGORIES = [
  'View all',
  'Finance & Commerce',
  'Charts & Analytics',
  'Navigation & UI',
  'Users & Account',
  'Security & Privacy',
  'Communication',
  'Media & Devices',
  'Layout & Design',
  'Files & Documents',
  'Time & Calendar',
  'Travel & Maps',
  'Health & Wellness',
  'Shopping & Lifestyle',
  'Development & Tech',
  'Weather & Nature',
  'General & System',
] as const;

export type PhosphorCategory = (typeof PHOSPHOR_CATEGORIES)[number];

export const PHOSPHOR_ICONS: PhosphorIconItem[] = [
  // Finance & Commerce
  { name: 'Bank', label: 'Bank', category: 'Finance & Commerce', tags: ['bank', 'institution', 'finance', 'account', 'checking'] },
  { name: 'Wallet', label: 'Wallet', category: 'Finance & Commerce', tags: ['wallet', 'money', 'cash', 'payment', 'purse'] },
  { name: 'CreditCard', label: 'Credit Card', category: 'Finance & Commerce', tags: ['credit', 'card', 'debit', 'visa', 'mastercard', 'payment'] },
  { name: 'Coins', label: 'Coins', category: 'Finance & Commerce', tags: ['coins', 'money', 'currency', 'cash', 'gold', 'income'] },
  { name: 'PiggyBank', label: 'Piggy Bank', category: 'Finance & Commerce', tags: ['savings', 'piggy', 'bank', 'deposit', 'save', 'goal'] },
  { name: 'Receipt', label: 'Receipt', category: 'Finance & Commerce', tags: ['receipt', 'bill', 'invoice', 'payment', 'expense', 'transaction'] },
  { name: 'CurrencyDollar', label: 'Dollar', category: 'Finance & Commerce', tags: ['dollar', 'currency', 'money', 'usd', 'cash'] },
  { name: 'CurrencyEur', label: 'Euro', category: 'Finance & Commerce', tags: ['euro', 'currency', 'eur', 'money'] },
  { name: 'CurrencyGbp', label: 'Pound', category: 'Finance & Commerce', tags: ['gbp', 'pound', 'sterling', 'currency'] },
  { name: 'CurrencyBtc', label: 'Bitcoin', category: 'Finance & Commerce', tags: ['bitcoin', 'crypto', 'btc', 'blockchain'] },
  { name: 'CurrencyEth', label: 'Ethereum', category: 'Finance & Commerce', tags: ['ethereum', 'crypto', 'eth', 'blockchain'] },
  { name: 'Money', label: 'Money', category: 'Finance & Commerce', tags: ['money', 'cash', 'bill', 'currency'] },
  { name: 'HandCoins', label: 'Hand Coins', category: 'Finance & Commerce', tags: ['donate', 'give', 'receive', 'tip', 'salary', 'income'] },
  { name: 'Scales', label: 'Scales', category: 'Finance & Commerce', tags: ['scale', 'balance', 'justice', 'legal', 'equity'] },
  { name: 'Vault', label: 'Vault', category: 'Finance & Commerce', tags: ['vault', 'safe', 'security', 'treasure', 'deposit'] },
  { name: 'Tag', label: 'Tag', category: 'Finance & Commerce', tags: ['tag', 'label', 'category', 'price', 'discount', 'offer'] },
  { name: 'Invoice', label: 'Invoice', category: 'Finance & Commerce', tags: ['invoice', 'bill', 'receipt', 'tax', 'statement'] },

  // Charts & Analytics
  { name: 'TrendUp', label: 'Trend Up', category: 'Charts & Analytics', tags: ['trend', 'up', 'analytics', 'growth', 'profit', 'rise'] },
  { name: 'TrendDown', label: 'Trend Down', category: 'Charts & Analytics', tags: ['trend', 'down', 'loss', 'decline', 'expense'] },
  { name: 'ChartBar', label: 'Bar Chart', category: 'Charts & Analytics', tags: ['bar', 'chart', 'graph', 'analytics', 'report', 'statistics'] },
  { name: 'ChartPie', label: 'Pie Chart', category: 'Charts & Analytics', tags: ['pie', 'chart', 'analytics', 'breakdown', 'distribution'] },
  { name: 'ChartLine', label: 'Line Chart', category: 'Charts & Analytics', tags: ['line', 'chart', 'graph', 'stocks', 'history'] },
  { name: 'ChartLineUp', label: 'Line Chart Up', category: 'Charts & Analytics', tags: ['line', 'chart', 'up', 'investing', 'growth'] },
  { name: 'ChartLineDown', label: 'Line Chart Down', category: 'Charts & Analytics', tags: ['line', 'chart', 'down', 'drop'] },
  { name: 'ChartScatter', label: 'Scatter Plot', category: 'Charts & Analytics', tags: ['scatter', 'chart', 'dots', 'correlation'] },
  { name: 'ChartDonut', label: 'Donut Chart', category: 'Charts & Analytics', tags: ['donut', 'pie', 'chart', 'distribution'] },
  { name: 'Pulse', label: 'Activity / Pulse', category: 'Charts & Analytics', tags: ['activity', 'pulse', 'vital', 'health', 'heartbeat'] },
  { name: 'Target', label: 'Target', category: 'Charts & Analytics', tags: ['target', 'goal', 'aim', 'focus', 'objective', 'kpi'] },
  { name: 'Gauge', label: 'Gauge', category: 'Charts & Analytics', tags: ['gauge', 'meter', 'speed', 'performance', 'indicator'] },

  // Navigation & UI
  { name: 'House', label: 'Home', category: 'Navigation & UI', tags: ['home', 'house', 'dashboard', 'root', 'main'] },
  { name: 'HouseLine', label: 'House Line', category: 'Navigation & UI', tags: ['home', 'residence', 'property'] },
  { name: 'SquaresFour', label: 'Dashboard Grid', category: 'Navigation & UI', tags: ['dashboard', 'grid', 'apps', 'menu', 'overview'] },
  { name: 'MagnifyingGlass', label: 'Search', category: 'Navigation & UI', tags: ['search', 'find', 'explore', 'query', 'magnifier'] },
  { name: 'Sliders', label: 'Sliders', category: 'Navigation & UI', tags: ['sliders', 'settings', 'adjust', 'filter', 'tune'] },
  { name: 'Faders', label: 'Faders', category: 'Navigation & UI', tags: ['faders', 'equalizer', 'controls', 'tuning'] },
  { name: 'Funnel', label: 'Filter', category: 'Navigation & UI', tags: ['filter', 'sort', 'refine', 'funnel'] },
  { name: 'ArrowRight', label: 'Arrow Right', category: 'Navigation & UI', tags: ['arrow', 'right', 'forward', 'next'] },
  { name: 'ArrowLeft', label: 'Arrow Left', category: 'Navigation & UI', tags: ['arrow', 'left', 'back', 'previous'] },
  { name: 'ArrowUp', label: 'Arrow Up', category: 'Navigation & UI', tags: ['arrow', 'up', 'top', 'increase'] },
  { name: 'ArrowDown', label: 'Arrow Down', category: 'Navigation & UI', tags: ['arrow', 'down', 'bottom', 'decrease'] },
  { name: 'CaretDown', label: 'Caret Down', category: 'Navigation & UI', tags: ['caret', 'down', 'chevron', 'dropdown', 'expand'] },
  { name: 'CaretUp', label: 'Caret Up', category: 'Navigation & UI', tags: ['caret', 'up', 'chevron', 'collapse'] },
  { name: 'CaretLeft', label: 'Caret Left', category: 'Navigation & UI', tags: ['caret', 'left', 'chevron', 'back'] },
  { name: 'CaretRight', label: 'Caret Right', category: 'Navigation & UI', tags: ['caret', 'right', 'chevron', 'forward'] },
  { name: 'CaretUpDown', label: 'Caret Up Down', category: 'Navigation & UI', tags: ['caret', 'sort', 'selector', 'dropdown'] },
  { name: 'DotsThreeVertical', label: 'More Vertical', category: 'Navigation & UI', tags: ['dots', 'more', 'vertical', 'menu', 'actions', 'options'] },
  { name: 'DotsThree', label: 'More Horizontal', category: 'Navigation & UI', tags: ['dots', 'more', 'horizontal', 'menu', 'options'] },
  { name: 'DotsSixVertical', label: 'Drag Handle', category: 'Navigation & UI', tags: ['drag', 'handle', 'reorder', 'grip'] },
  { name: 'Plus', label: 'Plus / Add', category: 'Navigation & UI', tags: ['plus', 'add', 'create', 'new'] },
  { name: 'PlusCircle', label: 'Plus Circle', category: 'Navigation & UI', tags: ['plus', 'circle', 'add', 'create'] },
  { name: 'Minus', label: 'Minus', category: 'Navigation & UI', tags: ['minus', 'remove', 'decrease', 'subtract'] },
  { name: 'X', label: 'Close / Cancel', category: 'Navigation & UI', tags: ['x', 'close', 'cancel', 'remove', 'dismiss'] },
  { name: 'XCircle', label: 'Close Circle', category: 'Navigation & UI', tags: ['x', 'circle', 'close', 'block'] },
  { name: 'Check', label: 'Checkmark', category: 'Navigation & UI', tags: ['check', 'done', 'tick', 'success', 'complete'] },
  { name: 'CheckCircle', label: 'Check Circle', category: 'Navigation & UI', tags: ['check', 'circle', 'verified', 'done', 'success'] },
  { name: 'ArrowCounterClockwise', label: 'Refresh / Sync', category: 'Navigation & UI', tags: ['refresh', 'sync', 'reload', 'restart', 'counterclockwise'] },
  { name: 'Copy', label: 'Copy', category: 'Navigation & UI', tags: ['copy', 'duplicate', 'clipboard', 'clone'] },
  { name: 'PencilSimple', label: 'Edit', category: 'Navigation & UI', tags: ['edit', 'pencil', 'modify', 'write', 'rename'] },
  { name: 'Trash', label: 'Delete', category: 'Navigation & UI', tags: ['trash', 'delete', 'remove', 'bin', 'discard'] },

  // Users & Account
  { name: 'User', label: 'User', category: 'Users & Account', tags: ['user', 'person', 'profile', 'account', 'member'] },
  { name: 'UserCircle', label: 'User Circle', category: 'Users & Account', tags: ['user', 'circle', 'avatar', 'profile'] },
  { name: 'UserPlus', label: 'Add User', category: 'Users & Account', tags: ['user', 'add', 'invite', 'friend', 'plus'] },
  { name: 'Users', label: 'Users / Team', category: 'Users & Account', tags: ['users', 'team', 'group', 'people', 'community', 'family'] },
  { name: 'UsersThree', label: 'Group / Community', category: 'Users & Account', tags: ['users', 'group', 'crowd', 'members'] },
  { name: 'UserCheck', label: 'Verified User', category: 'Users & Account', tags: ['user', 'verified', 'approved', 'check'] },
  { name: 'Handshake', label: 'Partnership', category: 'Users & Account', tags: ['handshake', 'deal', 'agreement', 'partner', 'collaboration'] },
  { name: 'Trophy', label: 'Trophy', category: 'Users & Account', tags: ['trophy', 'winner', 'achievement', 'reward', 'award', 'rank'] },
  { name: 'Medal', label: 'Medal', category: 'Users & Account', tags: ['medal', 'badge', 'reward', 'honor', 'rank'] },
  { name: 'Crown', label: 'Crown', category: 'Users & Account', tags: ['crown', 'vip', 'premium', 'royal', 'leader'] },

  // Security & Privacy
  { name: 'Shield', label: 'Shield', category: 'Security & Privacy', tags: ['shield', 'security', 'protection', 'safe', 'guard'] },
  { name: 'ShieldCheck', label: 'Shield Check', category: 'Security & Privacy', tags: ['shield', 'verified', 'security', 'safe', 'protected'] },
  { name: 'Lock', label: 'Lock', category: 'Security & Privacy', tags: ['lock', 'security', 'password', 'private', 'secure'] },
  { name: 'LockOpen', label: 'Lock Open', category: 'Security & Privacy', tags: ['unlock', 'open', 'access', 'public'] },
  { name: 'Key', label: 'Key', category: 'Security & Privacy', tags: ['key', 'auth', 'access', 'token', 'secret', 'api'] },
  { name: 'Fingerprint', label: 'Fingerprint', category: 'Security & Privacy', tags: ['fingerprint', 'biometrics', 'security', 'auth', 'id'] },
  { name: 'Eye', label: 'Show Password / Eye', category: 'Security & Privacy', tags: ['eye', 'view', 'show', 'visibility', 'watch'] },
  { name: 'EyeSlash', label: 'Hide / Eye Slash', category: 'Security & Privacy', tags: ['eye', 'slash', 'hide', 'hidden', 'invisible', 'privacy'] },
  { name: 'SignIn', label: 'Sign In', category: 'Security & Privacy', tags: ['signin', 'login', 'enter', 'door'] },
  { name: 'SignOut', label: 'Sign Out', category: 'Security & Privacy', tags: ['signout', 'logout', 'exit', 'leave'] },

  // Communication
  { name: 'Envelope', label: 'Email / Mail', category: 'Communication', tags: ['mail', 'email', 'envelope', 'message', 'inbox'] },
  { name: 'EnvelopeOpen', label: 'Read Mail', category: 'Communication', tags: ['mail', 'open', 'read', 'letter'] },
  { name: 'ChatCircle', label: 'Chat Circle', category: 'Communication', tags: ['chat', 'bubble', 'comment', 'message', 'talk'] },
  { name: 'ChatDots', label: 'Chat Dots', category: 'Communication', tags: ['chat', 'typing', 'conversation', 'feedback'] },
  { name: 'Bell', label: 'Notifications', category: 'Communication', tags: ['bell', 'alarm', 'notification', 'reminder', 'alert'] },
  { name: 'BellRinging', label: 'Bell Ringing', category: 'Communication', tags: ['bell', 'active', 'ringing', 'urgent'] },
  { name: 'Megaphone', label: 'Announcement', category: 'Communication', tags: ['megaphone', 'broadcast', 'marketing', 'promo'] },
  { name: 'PaperPlaneRight', label: 'Send', category: 'Communication', tags: ['send', 'submit', 'dispatch', 'paperplane'] },
  { name: 'ShareNetwork', label: 'Share', category: 'Communication', tags: ['share', 'network', 'publish', 'social'] },
  { name: 'At', label: 'At Sign', category: 'Communication', tags: ['at', 'mention', 'email', 'handle'] },

  // Media & Devices
  { name: 'Monitor', label: 'Desktop Monitor', category: 'Media & Devices', tags: ['monitor', 'screen', 'desktop', 'display', 'computer'] },
  { name: 'Laptop', label: 'Laptop', category: 'Media & Devices', tags: ['laptop', 'macbook', 'portable', 'computer'] },
  { name: 'DeviceMobile', label: 'Smartphone', category: 'Media & Devices', tags: ['mobile', 'phone', 'iphone', 'android', 'device'] },
  { name: 'DeviceTablet', label: 'Tablet', category: 'Media & Devices', tags: ['tablet', 'ipad', 'screen'] },
  { name: 'Television', label: 'TV', category: 'Media & Devices', tags: ['tv', 'television', 'streaming', 'screen'] },
  { name: 'WifiHigh', label: 'Wi-Fi', category: 'Media & Devices', tags: ['wifi', 'network', 'wireless', 'internet', 'connection'] },
  { name: 'Camera', label: 'Camera', category: 'Media & Devices', tags: ['camera', 'photo', 'picture', 'snapshot'] },
  { name: 'Image', label: 'Image / Photo', category: 'Media & Devices', tags: ['image', 'photo', 'gallery', 'picture'] },
  { name: 'MusicNotes', label: 'Music Notes', category: 'Media & Devices', tags: ['music', 'audio', 'sound', 'song', 'spotify'] },
  { name: 'Microphone', label: 'Microphone', category: 'Media & Devices', tags: ['mic', 'audio', 'voice', 'podcast', 'record'] },
  { name: 'Play', label: 'Play', category: 'Media & Devices', tags: ['play', 'start', 'video', 'media'] },
  { name: 'Pause', label: 'Pause', category: 'Media & Devices', tags: ['pause', 'stop', 'halt', 'break'] },
  { name: 'PauseCircle', label: 'Pause Circle', category: 'Media & Devices', tags: ['pause', 'circle', 'media'] },
  { name: 'PlayCircle', label: 'Play Circle', category: 'Media & Devices', tags: ['play', 'circle', 'video'] },
  { name: 'FilmStrip', label: 'Movie / Film', category: 'Media & Devices', tags: ['film', 'movie', 'video', 'cinema', 'theatre'] },

  // Layout & Design
  { name: 'Columns', label: 'Columns', category: 'Layout & Design', tags: ['columns', 'layout', 'grid', 'split'] },
  { name: 'Rows', label: 'Rows', category: 'Layout & Design', tags: ['rows', 'list', 'table', 'horizontal'] },
  { name: 'Table', label: 'Table Grid', category: 'Layout & Design', tags: ['table', 'spreadsheet', 'data', 'grid', 'cells'] },
  { name: 'Stack', label: 'Stack / Layers', category: 'Layout & Design', tags: ['stack', 'layers', 'depth', 'sheets'] },
  { name: 'Palette', label: 'Palette / Theme', category: 'Layout & Design', tags: ['palette', 'color', 'theme', 'design', 'art'] },
  { name: 'Cursor', label: 'Cursor Pointer', category: 'Layout & Design', tags: ['cursor', 'pointer', 'mouse', 'click', 'select'] },
  { name: 'MagicWand', label: 'Magic Wand', category: 'Layout & Design', tags: ['magic', 'wand', 'ai', 'automate', 'wizard'] },
  { name: 'Sparkle', label: 'Sparkle / AI', category: 'Layout & Design', tags: ['sparkle', 'ai', 'smart', 'clean', 'magic', 'gem'] },
  { name: 'Crop', label: 'Crop', category: 'Layout & Design', tags: ['crop', 'cut', 'resize', 'frame'] },

  // Files & Documents
  { name: 'File', label: 'File', category: 'Files & Documents', tags: ['file', 'document', 'page', 'paper'] },
  { name: 'FileText', label: 'Document', category: 'Files & Documents', tags: ['file', 'text', 'doc', 'contract', 'note', 'article'] },
  { name: 'FileDoc', label: 'Document File', category: 'Files & Documents', tags: ['file', 'doc', 'verified', 'audit', 'tax', 'policy'] },
  { name: 'FilePlus', label: 'New File', category: 'Files & Documents', tags: ['file', 'add', 'create', 'new'] },
  { name: 'Folder', label: 'Folder', category: 'Files & Documents', tags: ['folder', 'directory', 'archive', 'storage'] },
  { name: 'FolderOpen', label: 'Folder Open', category: 'Files & Documents', tags: ['folder', 'open', 'directory'] },
  { name: 'Archive', label: 'Archive', category: 'Files & Documents', tags: ['archive', 'box', 'storage', 'backup', 'vault'] },
  { name: 'ClipboardText', label: 'Clipboard', category: 'Files & Documents', tags: ['clipboard', 'paste', 'notes', 'checklist', 'survey'] },
  { name: 'Cloud', label: 'Cloud', category: 'Files & Documents', tags: ['cloud', 'storage', 'drive', 'sync', 'online'] },
  { name: 'CloudArrowUp', label: 'Cloud Upload', category: 'Files & Documents', tags: ['cloud', 'upload', 'backup', 'sync'] },
  { name: 'CloudArrowDown', label: 'Cloud Download', category: 'Files & Documents', tags: ['cloud', 'download', 'backup', 'export'] },
  { name: 'DownloadSimple', label: 'Download', category: 'Files & Documents', tags: ['download', 'save', 'get', 'export'] },
  { name: 'UploadSimple', label: 'Upload', category: 'Files & Documents', tags: ['upload', 'send', 'import', 'post'] },
  { name: 'FloppyDisk', label: 'Save', category: 'Files & Documents', tags: ['save', 'disk', 'diskette', 'store'] },
  { name: 'BookOpen', label: 'Book / Docs', category: 'Files & Documents', tags: ['book', 'docs', 'manual', 'documentation', 'learn'] },

  // Time & Calendar
  { name: 'Clock', label: 'Clock', category: 'Time & Calendar', tags: ['clock', 'time', 'schedule', 'hour', 'minute', 'watch'] },
  { name: 'ClockClockwise', label: 'History / Clockwise', category: 'Time & Calendar', tags: ['history', 'log', 'past', 'recent', 'clockwise'] },
  { name: 'ClockCounterClockwise', label: 'Undo / Rewind', category: 'Time & Calendar', tags: ['undo', 'rewind', 'restore', 'history'] },
  { name: 'Calendar', label: 'Calendar', category: 'Time & Calendar', tags: ['calendar', 'date', 'month', 'event', 'schedule'] },
  { name: 'CalendarCheck', label: 'Calendar Check', category: 'Time & Calendar', tags: ['calendar', 'done', 'scheduled', 'appointment'] },
  { name: 'CalendarPlus', label: 'Add Event', category: 'Time & Calendar', tags: ['calendar', 'add', 'event', 'new'] },
  { name: 'Hourglass', label: 'Hourglass', category: 'Time & Calendar', tags: ['hourglass', 'wait', 'pending', 'timer', 'sand'] },
  { name: 'Alarm', label: 'Alarm', category: 'Time & Calendar', tags: ['alarm', 'wake', 'timer', 'alert', 'clock'] },
  { name: 'Timer', label: 'Timer', category: 'Time & Calendar', tags: ['timer', 'stopwatch', 'speed', 'countdown'] },

  // Travel & Maps
  { name: 'MapPin', label: 'Map Pin', category: 'Travel & Maps', tags: ['pin', 'location', 'place', 'marker', 'address', 'geo'] },
  { name: 'MapTrifold', label: 'Map', category: 'Travel & Maps', tags: ['map', 'travel', 'guide', 'navigation', 'places'] },
  { name: 'Compass', label: 'Compass', category: 'Travel & Maps', tags: ['compass', 'explore', 'direction', 'travel', 'orient'] },
  { name: 'Globe', label: 'Globe / World', category: 'Travel & Maps', tags: ['globe', 'world', 'earth', 'international', 'country', 'language'] },
  { name: 'Translate', label: 'Translate', category: 'Travel & Maps', tags: ['translate', 'language', 'locale', 'dictionary'] },
  { name: 'Airplane', label: 'Airplane / Flight', category: 'Travel & Maps', tags: ['airplane', 'flight', 'plane', 'travel', 'trip', 'vacation'] },
  { name: 'AirplaneTakeoff', label: 'Flight Takeoff', category: 'Travel & Maps', tags: ['flight', 'takeoff', 'depart', 'travel'] },
  { name: 'AirplaneLanding', label: 'Flight Landing', category: 'Travel & Maps', tags: ['flight', 'landing', 'arrive', 'travel'] },
  { name: 'Car', label: 'Car / Auto', category: 'Travel & Maps', tags: ['car', 'vehicle', 'auto', 'drive', 'commute'] },
  { name: 'CarSimple', label: 'Car Simple', category: 'Travel & Maps', tags: ['car', 'auto', 'transport', 'sedan'] },
  { name: 'Train', label: 'Train / Transit', category: 'Travel & Maps', tags: ['train', 'transit', 'metro', 'subway', 'commute'] },
  { name: 'Buildings', label: 'Buildings / City', category: 'Travel & Maps', tags: ['buildings', 'city', 'office', 'corporate', 'real_estate'] },
  { name: 'Ticket', label: 'Ticket', category: 'Travel & Maps', tags: ['ticket', 'pass', 'coupon', 'boarding', 'concert'] },

  // Health & Wellness
  { name: 'Heart', label: 'Heart', category: 'Health & Wellness', tags: ['heart', 'love', 'health', 'favorite', 'like', 'life'] },
  { name: 'Heartbeat', label: 'Heartbeat', category: 'Health & Wellness', tags: ['heartbeat', 'cardio', 'pulse', 'vital', 'fitness'] },
  { name: 'FirstAidKit', label: 'Medical Kit', category: 'Health & Wellness', tags: ['medical', 'firstaid', 'health', 'doctor', 'hospital'] },
  { name: 'Pill', label: 'Medication', category: 'Health & Wellness', tags: ['pill', 'medicine', 'pharmacy', 'dose', 'drug'] },
  { name: 'Barbell', label: 'Fitness Gym', category: 'Health & Wellness', tags: ['gym', 'fitness', 'workout', 'weights', 'exercise', 'training'] },
  { name: 'Footprints', label: 'Hiking / Steps', category: 'Health & Wellness', tags: ['hiking', 'steps', 'walk', 'feet', 'tracks'] },

  // Shopping & Lifestyle
  { name: 'ShoppingBag', label: 'Shopping Bag', category: 'Shopping & Lifestyle', tags: ['shopping', 'bag', 'store', 'retail', 'purchase', 'mall'] },
  { name: 'ShoppingCart', label: 'Shopping Cart', category: 'Shopping & Lifestyle', tags: ['cart', 'ecommerce', 'checkout', 'buy', 'order'] },
  { name: 'ForkKnife', label: 'Dining / Restaurant', category: 'Shopping & Lifestyle', tags: ['food', 'restaurant', 'dining', 'dinner', 'lunch', 'eat'] },
  { name: 'Coffee', label: 'Coffee / Cafe', category: 'Shopping & Lifestyle', tags: ['coffee', 'cafe', 'tea', 'drink', 'espresso', 'morning'] },
  { name: 'BeerBottle', label: 'Bar / Beverage', category: 'Shopping & Lifestyle', tags: ['beer', 'bar', 'drink', 'alcohol', 'party'] },
  { name: 'Pizza', label: 'Fast Food / Pizza', category: 'Shopping & Lifestyle', tags: ['pizza', 'food', 'fastfood', 'snack'] },
  { name: 'Gift', label: 'Gift', category: 'Shopping & Lifestyle', tags: ['gift', 'present', 'reward', 'birthday', 'holiday'] },
  { name: 'GameController', label: 'Gaming', category: 'Shopping & Lifestyle', tags: ['gaming', 'game', 'playstation', 'xbox', 'entertainment'] },
  { name: 'Armchair', label: 'Furniture / Living', category: 'Shopping & Lifestyle', tags: ['furniture', 'chair', 'couch', 'living', 'home'] },
  { name: 'Bed', label: 'Bed / Bedroom', category: 'Shopping & Lifestyle', tags: ['bed', 'sleep', 'hotel', 'rest', 'bedroom'] },

  // Development & Tech
  { name: 'Code', label: 'Code', category: 'Development & Tech', tags: ['code', 'developer', 'programming', 'script', 'html'] },
  { name: 'Terminal', label: 'Terminal / CLI', category: 'Development & Tech', tags: ['terminal', 'console', 'cli', 'bash', 'command'] },
  { name: 'Cpu', label: 'CPU / Hardware', category: 'Development & Tech', tags: ['cpu', 'chip', 'processor', 'hardware', 'tech'] },
  { name: 'Database', label: 'Database / SQL', category: 'Development & Tech', tags: ['database', 'server', 'sql', 'storage', 'data'] },
  { name: 'GitBranch', label: 'Git Branch', category: 'Development & Tech', tags: ['git', 'branch', 'version', 'source', 'flow'] },
  { name: 'GitCommit', label: 'Git Commit', category: 'Development & Tech', tags: ['git', 'commit', 'change', 'history'] },
  { name: 'Bug', label: 'Bug / Issue', category: 'Development & Tech', tags: ['bug', 'issue', 'fix', 'debug', 'error'] },
  { name: 'PuzzlePiece', label: 'Plugin / Extension', category: 'Development & Tech', tags: ['puzzle', 'plugin', 'extension', 'addon', 'module'] },
  { name: 'Wrench', label: 'Tool / Maintenance', category: 'Development & Tech', tags: ['tool', 'wrench', 'fix', 'repair', 'settings'] },

  // Weather & Nature
  { name: 'Sun', label: 'Sun / Light Mode', category: 'Weather & Nature', tags: ['sun', 'day', 'light', 'sunny', 'brightness'] },
  { name: 'Moon', label: 'Moon / Dark Mode', category: 'Weather & Nature', tags: ['moon', 'night', 'dark', 'nightmode'] },
  { name: 'CloudSun', label: 'Partly Cloudy', category: 'Weather & Nature', tags: ['cloud', 'sun', 'weather', 'day'] },
  { name: 'CloudRain', label: 'Rain', category: 'Weather & Nature', tags: ['rain', 'weather', 'storm', 'water'] },
  { name: 'Drop', label: 'Water Drop', category: 'Weather & Nature', tags: ['drop', 'water', 'liquid', 'utility'] },
  { name: 'Lightning', label: 'Lightning / Zap', category: 'Weather & Nature', tags: ['lightning', 'zap', 'bolt', 'electric', 'power', 'fast', 'energy'] },
  { name: 'Plant', label: 'Plant / Eco', category: 'Weather & Nature', tags: ['plant', 'nature', 'eco', 'green', 'environment'] },
  { name: 'Tree', label: 'Tree / Forest', category: 'Weather & Nature', tags: ['tree', 'forest', 'park', 'nature'] },

  // General & System
  { name: 'Gear', label: 'Settings', category: 'General & System', tags: ['settings', 'gear', 'config', 'preferences', 'system', 'options'] },
  { name: 'GearSix', label: 'Preferences', category: 'General & System', tags: ['gear', 'settings', 'options', 'preferences'] },
  { name: 'Info', label: 'Information', category: 'General & System', tags: ['info', 'about', 'details', 'help', 'hint'] },
  { name: 'Question', label: 'Help / Question', category: 'General & System', tags: ['help', 'question', 'faq', 'support'] },
  { name: 'Warning', label: 'Warning', category: 'General & System', tags: ['warning', 'alert', 'caution', 'notice'] },
  { name: 'WarningCircle', label: 'Warning Circle', category: 'General & System', tags: ['warning', 'error', 'alert', 'problem'] },
  { name: 'WarningOctagon', label: 'Danger Octagon', category: 'General & System', tags: ['danger', 'stop', 'critical', 'alert'] },
  { name: 'Smiley', label: 'Smiley / Feedback', category: 'General & System', tags: ['smile', 'happy', 'emoji', 'rating', 'feedback'] },
  { name: 'Star', label: 'Star / Favorite', category: 'General & System', tags: ['star', 'favorite', 'bookmark', 'rate', 'vip'] },
  { name: 'BookmarkSimple', label: 'Bookmark', category: 'General & System', tags: ['bookmark', 'save', 'favorite', 'ribbon'] },
  { name: 'Flag', label: 'Flag', category: 'General & System', tags: ['flag', 'country', 'priority', 'marker', 'milestone'] },
  { name: 'Package', label: 'Package / Box', category: 'General & System', tags: ['package', 'box', 'delivery', 'inventory', 'shipping'] },
  { name: 'Link', label: 'Link', category: 'General & System', tags: ['link', 'url', 'chain', 'attachment'] },
  { name: 'CheckSquare', label: 'Check Square', category: 'General & System', tags: ['task', 'todo', 'checklist', 'done', 'square'] },
  { name: 'List', label: 'List View', category: 'General & System', tags: ['list', 'menu', 'items', 'bullet'] },
  { name: 'ListNumbers', label: 'Numbered List', category: 'General & System', tags: ['numbers', 'ordered', 'list', 'ranking'] },
  { name: 'Command', label: 'Command Key', category: 'General & System', tags: ['command', 'shortcut', 'cmd', 'keyboard'] },
];

export const ALL_PHOSPHOR_ICON_NAMES = PHOSPHOR_ICONS.map(i => i.name);

export const searchPhosphorIcons = (
  query: string,
  category: PhosphorCategory = 'View all'
): PhosphorIconItem[] => {
  const normalizedQuery = query.trim().toLowerCase();

  return PHOSPHOR_ICONS.filter(item => {
    // Category match
    if (category !== 'View all' && item.category !== category) {
      return false;
    }

    if (!normalizedQuery) return true;

    // Direct name or label match
    if (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.label.toLowerCase().includes(normalizedQuery)
    ) {
      return true;
    }

    // Tag match
    return item.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
  });
};

export const groupIconsByCategory = (
  icons: PhosphorIconItem[]
): { category: PhosphorCategory; icons: PhosphorIconItem[] }[] => {
  const groups: Record<string, PhosphorIconItem[]> = {};

  for (const cat of PHOSPHOR_CATEGORIES) {
    if (cat === 'View all') continue;
    groups[cat] = [];
  }

  for (const icon of icons) {
    if (groups[icon.category]) {
      groups[icon.category].push(icon);
    }
  }

  return Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => ({
      category: category as PhosphorCategory,
      icons: items,
    }));
};
