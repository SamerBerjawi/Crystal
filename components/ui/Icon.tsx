import React from 'react';
import * as UntitleduiIcons from '@untitledui/icons';

// Mapping from legacy Material Symbol / Lucide icon names to @untitledui/icons component names
export const ICON_NAME_MAP: Record<string, keyof typeof UntitleduiIcons> = {
  // Navigation & Core UI
  space_dashboard: 'LayoutGrid01',
  dashboard: 'LayoutGrid01',
  wallet: 'Wallet01',
  account_balance_wallet: 'Wallet01',
  receipt_long: 'Receipt',
  receipt: 'Receipt',
  analytics: 'TrendUp01',
  show_chart: 'TrendUp01',
  trending_up: 'TrendUp01',
  trending_down: 'TrendDown01',
  bar_chart: 'BarChart01',
  pie_chart: 'PieChart01',
  candlestick_chart: 'LineChartUp01',
  calendar_month: 'Calendar',
  calendar_today: 'Calendar',
  event: 'Calendar',
  schedule: 'Clock',
  loyalty: 'Tag01',
  description: 'File01',
  task_alt: 'CheckSquare',
  emoji_events: 'Trophy01',
  category: 'Grid01',
  sell: 'Tag01',
  storefront: 'Home01',
  store: 'Home01',
  settings_suggest: 'Settings01',
  settings: 'Settings01',
  api: 'Code01',
  database: 'Server01',
  auto_stories: 'BookOpen01',

  // Actions & Controls
  search: 'SearchMd',
  edit: 'Edit02',
  edit_note: 'Edit02',
  edit_square: 'Edit02',
  delete: 'Trash01',
  delete_forever: 'Trash01',
  delete_sweep: 'Trash01',
  add: 'Plus',
  plus: 'Plus',
  close: 'XClose',
  cancel: 'XClose',
  clear: 'XClose',
  refresh: 'RefreshCw01',
  sync: 'RefreshCw01',
  copy: 'Copy01',
  content_copy: 'Copy01',
  repeat: 'Repeat01',
  tune: 'Sliders01',
  filter_alt: 'FilterLines',
  drag_indicator: 'Grid01',
  swap_vert: 'SwitchVertical01',
  more_vert: 'DotsVertical',
  more_horiz: 'DotsHorizontal',
  expand_more: 'ChevronDown',
  expand_less: 'ChevronUp',
  keyboard_double_arrow_up: 'ChevronUp',

  // Directional
  arrow_back: 'ArrowLeft',
  arrow_left: 'ArrowLeft',
  arrow_forward: 'ArrowRight',
  arrow_right: 'ArrowRight',
  arrow_upward: 'ArrowUp',
  arrow_drop_up: 'ArrowUp',
  arrow_downward: 'ArrowDown',
  arrow_drop_down: 'ArrowDown',
  chevron_left: 'ChevronLeft',
  chevron_right: 'ChevronRight',
  chevron_down: 'ChevronDown',
  chevron_up: 'ChevronUp',

  // Finance & Banking
  account_balance: 'Bank',
  savings: 'PiggyBank01',
  credit_card: 'CreditCard01',
  request_quote: 'CurrencyDollar',
  real_estate_agent: 'Home01',
  home: 'Home01',
  payments: 'Coins01',
  monetization_on: 'Coins01',
  attach_money: 'CurrencyDollar',
  paid: 'Coins01',
  price_check: 'ReceiptCheck',
  currency_exchange: 'Coins01',
  currency_bitcoin: 'Coins01',

  // Status & Feedback
  info: 'InfoCircle',
  help: 'HelpCircle',
  help_outline: 'HelpCircle',
  warning: 'AlertTriangle',
  error: 'AlertCircle',
  check: 'Check',
  done: 'Check',
  verified: 'CheckCircle',
  security: 'Shield01',
  shield: 'Shield01',

  // Communications & Auth
  mail: 'Mail01',
  lock: 'Lock01',
  key: 'Key01',
  login: 'LogIn01',
  visibility: 'Eye',
  visibility_off: 'EyeOff',
  science: 'Zap',
  insights: 'TrendUp01',
  notes: 'File01',

  // Vehicles, Assets, Housing
  directions_car: 'Truck01',
  commute: 'Train',
  train: 'Train',
  flight: 'Plane',
  flight_takeoff: 'Plane',
  cottage: 'Home01',
  apartment: 'Home01',
  house: 'Home01',

  // Shopping, Dining, Lifestyle
  shopping_bag: 'ShoppingBag01',
  shopping_cart: 'ShoppingCart01',
  shopping_basket: 'ShoppingBag01',
  local_mall: 'ShoppingBag01',
  local_offer: 'Tag01',
  restaurant: 'ShoppingBag01',
  restaurant_menu: 'ShoppingBag01',
  local_cafe: 'Grid01',
  coffee: 'Grid01',
  fastfood: 'ShoppingBag01',
  delivery_dining: 'Truck01',
  
  // Media, Tech, Devices
  devices: 'Monitor01',
  smartphone: 'Phone01',
  laptop: 'Laptop01',
  desktop_windows: 'Monitor01',
  tablet: 'Tablet01',
  tv: 'Tv01',
  router: 'Wifi',
  cloud: 'Cloud01',
  cloud_download: 'DownloadCloud01',
  cloud_upload: 'UploadCloud01',
  download: 'Download01',
  upload: 'Upload01',
  camera_alt: 'Camera01',
  photo_camera: 'Camera01',
  image: 'Image01',
  music_note: 'MusicNote01',
  mic: 'Microphone01',
  chat: 'MessageSquare01',

  // Miscellaneous
  work: 'Briefcase01',
  badge: 'Passcode',
  construction: 'Tool01',
  build: 'Tool01',
  fingerprint: 'Fingerprint01',
  map: 'Map01',
  location_on: 'MarkerPin01',
  electric_car: 'Truck01',
  local_gas_station: 'Zap',
  directions_bus: 'Truck01',
  weekend: 'Home01',
  chair: 'Home01',
  living: 'Home01',
  event_seat: 'Home01',
  bed: 'Home01',
  night_shelter: 'Home01',
  crib: 'Home01',
  baby_changing_station: 'User01',
  family_restroom: 'Users01',
  child_care: 'User01',
  pets: 'Heart',
  bathtub: 'Home01',
  local_florist: 'Sun',
  park: 'Sun',
  nature: 'Sun',
  forest: 'Sun',
  memory: 'CpuChip01',
  code: 'Code01',
  terminal: 'Terminal',
  photo_library: 'Image01',
  collections: 'Image01',
  videocam: 'VideoRecorder',
  notifications: 'Bell01',
  notifications_active: 'Bell01',
  language: 'Globe01',
  translate: 'Translate01',
  travel_explore: 'Globe01',
  alarm: 'AlarmClock',
  timer: 'Hourglass01',
  history: 'ClockRewind',
  watch_later: 'Clock',
  health_and_safety: 'Shield01',
  monitor_heart: 'Activity',
  healing: 'MedicalCross',
  medication: 'MedicalCircle',
  medical_services: 'MedicalCross',
  volunteer_activism: 'Heart',
  self_improvement: 'Sun',
  fitness_center: 'Activity',
  sports_esports: 'GamingPad01',
  sports_tennis: 'Activity',
  sports_soccer: 'Activity',
  sports_basketball: 'Activity',
  run_circle: 'Activity',
  hiking: 'User01',
  pool: 'Sun',
  local_bar: 'Grid01',
  emoji_food_beverage: 'Grid01',
  liquor: 'Grid01',
  cake: 'Gift01',
  local_pizza: 'ShoppingBag01',
  lightbulb: 'Lightbulb01',
  electric_bolt: 'Zap',
  battery_charging_full: 'BatteryCharging01',
  solar_power: 'Sun',
  eco: 'Sun',
  water_drop: 'Drop',
  wb_sunny: 'Sun',
  search_off: 'SearchMd',
  apps: 'Grid01',
  grid_view: 'Grid01',
  view_list: 'List',
  view_kanban: 'LayoutGrid01',
  view_timeline: 'BarChart01',
  view_week: 'Calendar',

  // Additional Material Symbol fallbacks
  inbox_customize: 'Inbox01',
  transform: 'RefreshCw01',
  edit_calendar: 'Calendar',
  content_paste: 'Clipboard',
  assignment_return: 'ArrowLeft',
  card_giftcard: 'Gift01',
  house_repair_service: 'Tool01',
  home_repair_service: 'Tool01',
  car_crash: 'AlertTriangle',
  car_repair: 'Tool01',
  local_taxi: 'Truck01',
  local_parking: 'MarkerPin01',
  local_police: 'Shield01',
  checkroom: 'ShoppingBag01',
  face: 'FaceSmile',
  bolt: 'Zap',
  cleaning_services: 'Tool01',
  theaters: 'Film01',
  confirmation_number: 'Ticket01',
  stroller: 'User01',
  face_3: 'User01',
  vaccines: 'MedicalCircle',
  cast_for_education: 'Monitor01',
  menu_book: 'BookOpen01',
  school: 'GraduationHat01',
  flight_land: 'Plane',
  hotel: 'Home01',
  tour: 'Compass01',
  atm: 'Bank',
  sentiment_very_dissatisfied: 'AlertCircle',
  sentiment_dissatisfied: 'AlertCircle',
  extension: 'PuzzlePiece01',
  policy: 'FileCheck01',
  diamond: 'Star01',
  handshake: 'Users01',
  assured_workload: 'Bank',
  account_tree: 'Share01',
  engineering: 'Tool01',
};

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name?: string;
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  title?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({
  name,
  className = '',
  size,
  strokeWidth = 2,
  color = 'currentColor',
  style,
  ...props
}) => {
  if (!name) return null;

  // Resolve component name from map or direct match
  const cleanName = name.trim();
  const componentName =
    ICON_NAME_MAP[cleanName] ||
    ICON_NAME_MAP[cleanName.toLowerCase()] ||
    (cleanName in UntitleduiIcons ? (cleanName as keyof typeof UntitleduiIcons) : null);

  const IconComponent = componentName
    ? (UntitleduiIcons[componentName] as React.ComponentType<any>)
    : UntitleduiIcons.Grid01;

  // Standardize sizing: If no explicit width/height in className or size prop, default to inline text scaling (1em x 1em)
  const hasWidthClass = /\b(w-\d+|w-\[.*\]|w-full|w-screen|w-auto)\b/.test(className);
  const hasHeightClass = /\b(h-\d+|h-\[.*\]|h-full|h-screen|h-auto)\b/.test(className);
  
  const defaultSizeClass = !hasWidthClass && !hasHeightClass && !size ? 'w-[1em] h-[1em] inline-block shrink-0 align-middle' : '';

  return (
    <IconComponent
      className={`${defaultSizeClass} ${className}`.trim()}
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      style={style}
      {...props}
    />
  );
};

export default Icon;
