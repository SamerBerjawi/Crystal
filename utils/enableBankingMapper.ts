import { Currency, EnableBankingAccount, Transaction } from '../types';
import { normalizeMerchantKey } from './brandfetch';
import { parseLocalDate, safeRound, toLocalISOString } from '../utils';

/*
 * Enable Banking data mapping, balance resolution, account reconciliation, and automatic merchant/category detection.
 * Pure functions so the entire pipeline can be unit tested without live bank credentials.
 */

export interface KnownBrand {
  canonicalName: string;
  domain: string;
  defaultCategory?: string;
  keywords: string[];
}

/**
 * Curated global & European merchant brand knowledge base.
 * Maps normalized tokens/keywords to canonical merchant display name, Brandfetch domain, and default Crystal category.
 */
export const KNOWN_BRANDS: readonly KnownBrand[] = [
  // Supermarkets & Groceries (Europe & Global)
  { canonicalName: 'Colruyt', domain: 'colruyt.be', defaultCategory: 'Supermarket', keywords: ['colruyt', 'collect and go', 'collect&go'] },
  { canonicalName: 'Delhaize', domain: 'delhaize.be', defaultCategory: 'Supermarket', keywords: ['delhaize', 'ad delhaize', 'proxy delhaize', 'shop & go', 'shop and go'] },
  { canonicalName: 'Carrefour', domain: 'carrefour.com', defaultCategory: 'Supermarket', keywords: ['carrefour', 'carrefour express', 'carrefour market', 'carrefour hyper'] },
  { canonicalName: 'Albert Heijn', domain: 'ah.nl', defaultCategory: 'Supermarket', keywords: ['albert heijn', 'ah to go', 'ah.nl'] },
  { canonicalName: 'Lidl', domain: 'lidl.com', defaultCategory: 'Supermarket', keywords: ['lidl'] },
  { canonicalName: 'Aldi', domain: 'aldi.com', defaultCategory: 'Supermarket', keywords: ['aldi'] },
  { canonicalName: 'Jumbo', domain: 'jumbo.com', defaultCategory: 'Supermarket', keywords: ['jumbo supermarkten', 'jumbo'] },
  { canonicalName: 'Picnic', domain: 'picnic.app', defaultCategory: 'Supermarket', keywords: ['picnic'] },
  { canonicalName: 'Okay', domain: 'okay.be', defaultCategory: 'Supermarket', keywords: ['okay compact', 'okay'] },
  { canonicalName: 'Bio-Planet', domain: 'bioplanet.be', defaultCategory: 'Supermarket', keywords: ['bio-planet', 'bioplanet'] },
  { canonicalName: 'Intermarché', domain: 'intermarche.com', defaultCategory: 'Supermarket', keywords: ['intermarche', 'intermarché'] },
  { canonicalName: 'E.Leclerc', domain: 'e.leclerc', defaultCategory: 'Supermarket', keywords: ['leclerc', 'e.leclerc'] },
  { canonicalName: 'Auchan', domain: 'auchan.fr', defaultCategory: 'Supermarket', keywords: ['auchan'] },
  { canonicalName: 'Monoprix', domain: 'monoprix.fr', defaultCategory: 'Supermarket', keywords: ['monoprix'] },
  { canonicalName: 'Franprix', domain: 'franprix.fr', defaultCategory: 'Supermarket', keywords: ['franprix'] },
  { canonicalName: 'Picard', domain: 'picard.fr', defaultCategory: 'Supermarket', keywords: ['picard'] },
  { canonicalName: 'Rewe', domain: 'rewe.de', defaultCategory: 'Supermarket', keywords: ['rewe'] },
  { canonicalName: 'Edeka', domain: 'edeka.de', defaultCategory: 'Supermarket', keywords: ['edeka'] },
  { canonicalName: 'Kaufland', domain: 'kaufland.de', defaultCategory: 'Supermarket', keywords: ['kaufland'] },
  { canonicalName: 'Penny', domain: 'penny.de', defaultCategory: 'Supermarket', keywords: ['penny markt', 'penny'] },
  { canonicalName: 'Netto', domain: 'netto-online.de', defaultCategory: 'Supermarket', keywords: ['netto marken-discount', 'netto'] },
  { canonicalName: 'Migros', domain: 'migros.ch', defaultCategory: 'Supermarket', keywords: ['migros'] },
  { canonicalName: 'Coop', domain: 'coop.ch', defaultCategory: 'Supermarket', keywords: ['coop'] },
  { canonicalName: 'K-Market', domain: 'k-ruoka.fi', defaultCategory: 'Supermarket', keywords: ['k-market', 'k-supermarket', 'k-citymarket', 'kesko'] },
  { canonicalName: 'S-Market', domain: 's-kanava.fi', defaultCategory: 'Supermarket', keywords: ['s-market', 'prisma', 'alepa', 'sale'] },
  { canonicalName: 'ICA', domain: 'ica.se', defaultCategory: 'Supermarket', keywords: ['ica nara', 'ica kvantum', 'ica maxi', 'ica supermarket'] },
  { canonicalName: 'Tesco', domain: 'tesco.com', defaultCategory: 'Supermarket', keywords: ['tesco'] },
  { canonicalName: "Sainsbury's", domain: 'sainsburys.co.uk', defaultCategory: 'Supermarket', keywords: ['sainsburys', "sainsbury's"] },
  { canonicalName: 'Waitrose', domain: 'waitrose.com', defaultCategory: 'Supermarket', keywords: ['waitrose'] },
  { canonicalName: 'Marks & Spencer', domain: 'marksandspencer.com', defaultCategory: 'Supermarket', keywords: ['marks & spencer', 'marks and spencer', 'm&s'] },
  { canonicalName: 'Whole Foods', domain: 'wholefoodsmarket.com', defaultCategory: 'Supermarket', keywords: ['whole foods', 'wholefds'] },
  { canonicalName: 'Target', domain: 'target.com', defaultCategory: 'Shopping & Lifestyle', keywords: ['target'] },
  { canonicalName: 'Walmart', domain: 'walmart.com', defaultCategory: 'Supermarket', keywords: ['walmart', 'wal-mart'] },
  { canonicalName: 'Costco', domain: 'costco.com', defaultCategory: 'Supermarket', keywords: ['costco'] },

  // Dining, Coffee & Delivery
  { canonicalName: 'Uber Eats', domain: 'ubereats.com', defaultCategory: 'Delivery & Takeaway', keywords: ['uber eats', 'uber *eats', 'ubereats'] },
  { canonicalName: 'Deliveroo', domain: 'deliveroo.com', defaultCategory: 'Delivery & Takeaway', keywords: ['deliveroo'] },
  { canonicalName: 'Takeaway.com', domain: 'takeaway.com', defaultCategory: 'Delivery & Takeaway', keywords: ['takeaway.com', 'just eat', 'thuisbezorgd', 'lieferando'] },
  { canonicalName: 'Wolt', domain: 'wolt.com', defaultCategory: 'Delivery & Takeaway', keywords: ['wolt'] },
  { canonicalName: 'HelloFresh', domain: 'hellofresh.com', defaultCategory: 'Food & Groceries', keywords: ['hellofresh', 'hello fresh'] },
  { canonicalName: "McDonald's", domain: 'mcdonalds.com', defaultCategory: 'Dining Out', keywords: ['mcdonalds', "mcdonald's", 'mc donalds'] },
  { canonicalName: 'Starbucks', domain: 'starbucks.com', defaultCategory: 'Cafes & Snacks', keywords: ['starbucks'] },
  { canonicalName: 'Burger King', domain: 'bk.com', defaultCategory: 'Dining Out', keywords: ['burger king'] },
  { canonicalName: 'KFC', domain: 'kfc.com', defaultCategory: 'Dining Out', keywords: ['kfc', 'kentucky fried chicken'] },
  { canonicalName: 'Subway', domain: 'subway.com', defaultCategory: 'Dining Out', keywords: ['subway'] },
  { canonicalName: "Domino's Pizza", domain: 'dominos.com', defaultCategory: 'Delivery & Takeaway', keywords: ['dominos', "domino's"] },
  { canonicalName: 'Panos', domain: 'panos.be', defaultCategory: 'Cafes & Snacks', keywords: ['panos'] },
  { canonicalName: 'Exki', domain: 'exki.com', defaultCategory: 'Cafes & Snacks', keywords: ['exki'] },
  { canonicalName: 'Paul', domain: 'paul.fr', defaultCategory: 'Cafes & Snacks', keywords: ['boulangerie paul'] },
  { canonicalName: 'Pret A Manger', domain: 'pret.co.uk', defaultCategory: 'Cafes & Snacks', keywords: ['pret a manger'] },

  // Transport, Mobility & Fuel
  { canonicalName: 'Uber', domain: 'uber.com', defaultCategory: 'Ride-Hailing', keywords: ['uber *trip', 'uber trip', 'uber bv', 'uber'] },
  { canonicalName: 'Bolt', domain: 'bolt.eu', defaultCategory: 'Ride-Hailing', keywords: ['bolt.eu', 'bolt operations'] },
  { canonicalName: 'SNCB / NMBS', domain: 'belgiantrain.be', defaultCategory: 'Public Transport', keywords: ['sncb', 'nmbs', 'belgiantrain'] },
  { canonicalName: 'STIB / MIVB', domain: 'stib-mivb.be', defaultCategory: 'Public Transport', keywords: ['stib', 'mivb'] },
  { canonicalName: 'De Lijn', domain: 'delijn.be', defaultCategory: 'Public Transport', keywords: ['de lijn', 'delijn'] },
  { canonicalName: 'TEC', domain: 'letec.be', defaultCategory: 'Public Transport', keywords: ['infotec', 'letec'] },
  { canonicalName: 'NS', domain: 'ns.nl', defaultCategory: 'Public Transport', keywords: ['ns groep', 'ns reizigers', 'nederlandse spoorwegen'] },
  { canonicalName: 'SNCF', domain: 'sncf-connect.com', defaultCategory: 'Public Transport', keywords: ['sncf'] },
  { canonicalName: 'RATP', domain: 'ratp.fr', defaultCategory: 'Public Transport', keywords: ['ratp'] },
  { canonicalName: 'Deutsche Bahn', domain: 'bahn.de', defaultCategory: 'Public Transport', keywords: ['deutsche bahn', 'db vertrieb', 'bahn.de'] },
  { canonicalName: 'VR', domain: 'vr.fi', defaultCategory: 'Public Transport', keywords: ['vr-yhtymä', 'vr matkalla'] },
  { canonicalName: 'HSL', domain: 'hsl.fi', defaultCategory: 'Public Transport', keywords: ['hsl', 'helsingin seudun liikenne'] },
  { canonicalName: 'Eurostar', domain: 'eurostar.com', defaultCategory: 'Public Transport', keywords: ['eurostar', 'thalys'] },
  { canonicalName: 'Shell', domain: 'shell.com', defaultCategory: 'Fuel / Charging', keywords: ['shell'] },
  { canonicalName: 'TotalEnergies', domain: 'totalenergies.com', defaultCategory: 'Fuel / Charging', keywords: ['totalenergies', 'total energies', 'total serv'] },
  { canonicalName: 'Q8', domain: 'q8.be', defaultCategory: 'Fuel / Charging', keywords: ['q8 easy', 'kuwait petroleum', 'q8'] },
  { canonicalName: 'Esso', domain: 'esso.com', defaultCategory: 'Fuel / Charging', keywords: ['esso', 'exxon'] },
  { canonicalName: 'BP', domain: 'bp.com', defaultCategory: 'Fuel / Charging', keywords: ['bp ', 'british petroleum'] },
  { canonicalName: 'Texaco', domain: 'texaco.com', defaultCategory: 'Fuel / Charging', keywords: ['texaco', 'chevron'] },
  { canonicalName: 'Lukoil', domain: 'lukoil.be', defaultCategory: 'Fuel / Charging', keywords: ['lukoil'] },
  { canonicalName: 'DATS 24', domain: 'dats24.be', defaultCategory: 'Fuel / Charging', keywords: ['dats 24', 'dats24'] },
  { canonicalName: 'Fastned', domain: 'fastned.nl', defaultCategory: 'Fuel / Charging', keywords: ['fastned'] },
  { canonicalName: 'Tesla', domain: 'tesla.com', defaultCategory: 'Fuel / Charging', keywords: ['tesla supercharger', 'tesla inc', 'tesla'] },
  { canonicalName: '4411', domain: '4411.be', defaultCategory: 'Parking & Tolls', keywords: ['4411', 'be-mobile'] },
  { canonicalName: 'EasyPark', domain: 'easypark.com', defaultCategory: 'Parking & Tolls', keywords: ['easypark'] },
  { canonicalName: 'Q-Park', domain: 'q-park.com', defaultCategory: 'Parking & Tolls', keywords: ['q-park', 'qpark'] },
  { canonicalName: 'Interparking', domain: 'interparking.com', defaultCategory: 'Parking & Tolls', keywords: ['interparking'] },

  // Shopping, E-Commerce & Retail
  { canonicalName: 'Amazon', domain: 'amazon.com', defaultCategory: 'Shopping & Lifestyle', keywords: ['amazon', 'amzn mktp', 'amzn.com', 'amzn'] },
  { canonicalName: 'Bol.com', domain: 'bol.com', defaultCategory: 'Shopping & Lifestyle', keywords: ['bol.com', 'bol com'] },
  { canonicalName: 'Coolblue', domain: 'coolblue.be', defaultCategory: 'Electronics & Gadgets', keywords: ['coolblue'] },
  { canonicalName: 'MediaMarkt', domain: 'mediamarkt.com', defaultCategory: 'Electronics & Gadgets', keywords: ['mediamarkt', 'media markt'] },
  { canonicalName: 'Fnac', domain: 'fnac.com', defaultCategory: 'Electronics & Gadgets', keywords: ['fnac'] },
  { canonicalName: 'Vanden Borre', domain: 'vandenborre.be', defaultCategory: 'Electronics & Gadgets', keywords: ['vanden borre', 'vandenborre'] },
  { canonicalName: 'Krëfel', domain: 'krefel.be', defaultCategory: 'Electronics & Gadgets', keywords: ['krefel', 'krëfel'] },
  { canonicalName: 'IKEA', domain: 'ikea.com', defaultCategory: 'Home & Garden', keywords: ['ikea'] },
  { canonicalName: 'Brico', domain: 'brico.be', defaultCategory: 'Home & Garden', keywords: ['brico', 'brico plan-it'] },
  { canonicalName: 'Gamma', domain: 'gamma.be', defaultCategory: 'Home & Garden', keywords: ['gamma'] },
  { canonicalName: 'Hubo', domain: 'hubo.be', defaultCategory: 'Home & Garden', keywords: ['hubo'] },
  { canonicalName: 'Action', domain: 'action.com', defaultCategory: 'Home & Garden', keywords: ['action '] },
  { canonicalName: 'HEMA', domain: 'hema.com', defaultCategory: 'Shopping & Lifestyle', keywords: ['hema'] },
  { canonicalName: 'Kruidvat', domain: 'kruidvat.be', defaultCategory: 'Beauty & Personal Care', keywords: ['kruidvat'] },
  { canonicalName: 'Di', domain: 'di.be', defaultCategory: 'Beauty & Personal Care', keywords: ['di beauty'] },
  { canonicalName: 'Etos', domain: 'etos.nl', defaultCategory: 'Beauty & Personal Care', keywords: ['etos'] },
  { canonicalName: 'dm', domain: 'dm.de', defaultCategory: 'Beauty & Personal Care', keywords: ['dm-drogerie'] },
  { canonicalName: 'Decathlon', domain: 'decathlon.com', defaultCategory: 'Sports & Recreation', keywords: ['decathlon'] },
  { canonicalName: 'AS Adventure', domain: 'asadventure.com', defaultCategory: 'Sports & Recreation', keywords: ['as adventure', 'a.s.adventure'] },
  { canonicalName: 'Zara', domain: 'zara.com', defaultCategory: 'Clothing & Apparel', keywords: ['zara'] },
  { canonicalName: 'H&M', domain: 'hm.com', defaultCategory: 'Clothing & Apparel', keywords: ['h&m', 'hennes & mauritz'] },
  { canonicalName: 'Uniqlo', domain: 'uniqlo.com', defaultCategory: 'Clothing & Apparel', keywords: ['uniqlo'] },
  { canonicalName: 'Zalando', domain: 'zalando.com', defaultCategory: 'Clothing & Apparel', keywords: ['zalando'] },
  { canonicalName: 'Vinted', domain: 'vinted.com', defaultCategory: 'Clothing & Apparel', keywords: ['vinted'] },
  { canonicalName: 'Nike', domain: 'nike.com', defaultCategory: 'Clothing & Apparel', keywords: ['nike'] },
  { canonicalName: 'Adidas', domain: 'adidas.com', defaultCategory: 'Clothing & Apparel', keywords: ['adidas'] },

  // Subscriptions, Digital & Software
  { canonicalName: 'Netflix', domain: 'netflix.com', defaultCategory: 'Streaming Services', keywords: ['netflix'] },
  { canonicalName: 'Spotify', domain: 'spotify.com', defaultCategory: 'Streaming Services', keywords: ['spotify'] },
  { canonicalName: 'Disney+', domain: 'disneyplus.com', defaultCategory: 'Streaming Services', keywords: ['disney plus', 'disney+'] },
  { canonicalName: 'YouTube', domain: 'youtube.com', defaultCategory: 'Streaming Services', keywords: ['youtube', 'google *youtube'] },
  { canonicalName: 'Apple', domain: 'apple.com', defaultCategory: 'Apps & Software', keywords: ['apple.com/bill', 'itunes.com/bill', 'apple store', 'apple'] },
  { canonicalName: 'Google AI Pro', domain: 'google.com', defaultCategory: 'Apps & Software', keywords: ['google ai pro', 'google *ai pro'] },
  { canonicalName: 'Google', domain: 'google.com', defaultCategory: 'Apps & Software', keywords: ['google *', 'google storage', 'google one', 'google play', 'google cloud'] },
  { canonicalName: 'Microsoft', domain: 'microsoft.com', defaultCategory: 'Apps & Software', keywords: ['microsoft', 'msbill.info'] },
  { canonicalName: 'OpenAI', domain: 'openai.com', defaultCategory: 'Apps & Software', keywords: ['openai', 'chatgpt'] },
  { canonicalName: 'Anthropic', domain: 'anthropic.com', defaultCategory: 'Apps & Software', keywords: ['anthropic', 'claude.ai'] },
  { canonicalName: 'GitHub', domain: 'github.com', defaultCategory: 'Apps & Software', keywords: ['github'] },
  { canonicalName: 'Adobe', domain: 'adobe.com', defaultCategory: 'Apps & Software', keywords: ['adobe'] },
  { canonicalName: 'Figma', domain: 'figma.com', defaultCategory: 'Apps & Software', keywords: ['figma'] },
  { canonicalName: 'Notion', domain: 'notion.so', defaultCategory: 'Apps & Software', keywords: ['notion labs', 'notion.so'] },
  { canonicalName: 'Slack', domain: 'slack.com', defaultCategory: 'Apps & Software', keywords: ['slack'] },
  { canonicalName: 'Zoom', domain: 'zoom.us', defaultCategory: 'Apps & Software', keywords: ['zoom.us', 'zoom video'] },
  { canonicalName: 'Discord', domain: 'discord.com', defaultCategory: 'Apps & Software', keywords: ['discord'] },
  { canonicalName: 'Steam', domain: 'steampowered.com', defaultCategory: 'Entertainment', keywords: ['steampowered', 'steam games', 'valve corp'] },
  { canonicalName: 'PlayStation', domain: 'playstation.com', defaultCategory: 'Entertainment', keywords: ['playstation', 'sony interactive'] },
  { canonicalName: 'Nintendo', domain: 'nintendo.com', defaultCategory: 'Entertainment', keywords: ['nintendo'] },
  { canonicalName: 'Patreon', domain: 'patreon.com', defaultCategory: 'Software & Subscriptions', keywords: ['patreon'] },
  { canonicalName: 'Substack', domain: 'substack.com', defaultCategory: 'Software & Subscriptions', keywords: ['substack'] },
  { canonicalName: 'Starlink', domain: 'starlink.com', defaultCategory: 'Internet & TV', keywords: ['starlink'] },

  // Telecom & Utilities (Belgium, NL, FR, DE, Nordics)
  { canonicalName: 'Proximus', domain: 'proximus.be', defaultCategory: 'Internet & TV', keywords: ['proximus'] },
  { canonicalName: 'Telenet', domain: 'telenet.be', defaultCategory: 'Internet & TV', keywords: ['telenet'] },
  { canonicalName: 'Orange', domain: 'orange.be', defaultCategory: 'Mobile Phone', keywords: ['orange belgium', 'orange sa', 'orange'] },
  { canonicalName: 'Mobile Vikings', domain: 'mobilevikings.be', defaultCategory: 'Mobile Phone', keywords: ['mobile vikings', 'unleashed nv'] },
  { canonicalName: 'Digi', domain: 'digi-belgium.be', defaultCategory: 'Mobile Phone', keywords: ['digi belgium', 'digi communications'] },
  { canonicalName: 'VOO', domain: 'voo.be', defaultCategory: 'Internet & TV', keywords: ['voo sa'] },
  { canonicalName: 'KPN', domain: 'kpn.com', defaultCategory: 'Internet & TV', keywords: ['kpn'] },
  { canonicalName: 'Ziggo', domain: 'ziggo.nl', defaultCategory: 'Internet & TV', keywords: ['ziggo', 'vodafoneziggo'] },
  { canonicalName: 'Engie', domain: 'engie.be', defaultCategory: 'Utilities (Gas, Water, Elec)', keywords: ['engie electrabel', 'engie'] },
  { canonicalName: 'Luminus', domain: 'luminus.be', defaultCategory: 'Utilities (Gas, Water, Elec)', keywords: ['luminus', 'edf luminus'] },
  { canonicalName: 'Eneco', domain: 'eneco.be', defaultCategory: 'Utilities (Gas, Water, Elec)', keywords: ['eneco'] },
  { canonicalName: 'Vattenfall', domain: 'vattenfall.com', defaultCategory: 'Utilities (Gas, Water, Elec)', keywords: ['vattenfall'] },
  { canonicalName: 'Vivaqua', domain: 'vivaqua.be', defaultCategory: 'Utilities (Gas, Water, Elec)', keywords: ['vivaqua'] },
  { canonicalName: 'De Watergroep', domain: 'dewatergroep.be', defaultCategory: 'Utilities (Gas, Water, Elec)', keywords: ['de watergroep'] },
  { canonicalName: 'Water-link', domain: 'water-link.be', defaultCategory: 'Utilities (Gas, Water, Elec)', keywords: ['water-link'] },

  // Travel & Hospitality
  { canonicalName: 'Airbnb', domain: 'airbnb.com', defaultCategory: 'Accommodation', keywords: ['airbnb'] },
  { canonicalName: 'Booking.com', domain: 'booking.com', defaultCategory: 'Accommodation', keywords: ['booking.com', 'booking com'] },
  { canonicalName: 'Ryanair', domain: 'ryanair.com', defaultCategory: 'Flights', keywords: ['ryanair'] },
  { canonicalName: 'Brussels Airlines', domain: 'brusselsairlines.com', defaultCategory: 'Flights', keywords: ['brussels airlines'] },
  { canonicalName: 'KLM', domain: 'klm.com', defaultCategory: 'Flights', keywords: ['klm'] },
  { canonicalName: 'Air France', domain: 'airfrance.com', defaultCategory: 'Flights', keywords: ['air france', 'airfrance'] },
  { canonicalName: 'Lufthansa', domain: 'lufthansa.com', defaultCategory: 'Flights', keywords: ['lufthansa'] },
  { canonicalName: 'easyJet', domain: 'easyjet.com', defaultCategory: 'Flights', keywords: ['easyjet'] },
  { canonicalName: 'Finnair', domain: 'finnair.com', defaultCategory: 'Flights', keywords: ['finnair'] },

  // Health & Fitness
  { canonicalName: 'Basic-Fit', domain: 'basic-fit.com', defaultCategory: 'Fitness / Gym', keywords: ['basic-fit', 'basic fit'] },
  { canonicalName: 'FitLife Gym', domain: 'fitlife.com', defaultCategory: 'Fitness / Gym', keywords: ['fitlife gym', 'fitlife'] },

  // Financial Services
  { canonicalName: 'Revolut', domain: 'revolut.com', defaultCategory: 'Finances', keywords: ['revolut'] },
  { canonicalName: 'Wise', domain: 'wise.com', defaultCategory: 'Finances', keywords: ['wise europe', 'transferwise', 'wise.com'] },
  { canonicalName: 'PayPal', domain: 'paypal.com', defaultCategory: 'Shopping & Lifestyle', keywords: ['paypal'] },
  { canonicalName: 'Stripe', domain: 'stripe.com', defaultCategory: 'Services', keywords: ['stripe'] },
];

/**
 * ISO 18245 Merchant Category Code (MCC) to Crystal category mapping.
 */
export function mapMccToCategory(mcc?: string | number | null): string | undefined {
  if (!mcc) return undefined;
  const code = Number(String(mcc).trim());
  if (!Number.isFinite(code)) return undefined;

  if (code === 5411 || code === 5422 || code === 5441 || code === 5451 || code === 5462 || code === 5499) return 'Supermarket';
  if (code === 5812 || code === 5813) return 'Dining Out';
  if (code === 5814) return 'Cafes & Snacks';
  if (code === 4111 || code === 4112 || code === 4131) return 'Public Transport';
  if (code === 4121) return 'Ride-Hailing';
  if (code === 5541 || code === 5542 || code === 5552) return 'Fuel / Charging';
  if (code === 7523 || code === 4784) return 'Parking & Tolls';
  if (code >= 3000 && code <= 3299 || code === 4511) return 'Flights';
  if (code >= 3500 && code <= 3999 || code === 7011) return 'Accommodation';
  if (code === 5912) return 'Pharmacy';
  if (code === 8011 || code === 8021 || code === 8062 || code === 8099) return 'Medical & Dental';
  if (code === 7997) return 'Fitness / Gym';
  if (code === 4812 || code === 4814) return 'Mobile Phone';
  if (code === 4899) return 'Internet & TV';
  if (code === 4900) return 'Utilities (Gas, Water, Elec)';
  if (code === 5732 || code === 5734) return 'Electronics & Gadgets';
  if (code === 5611 || code === 5621 || code === 5641 || code === 5651 || code === 5661 || code === 5691 || code === 5699) return 'Clothing & Apparel';
  if (code === 5200 || code === 5211 || code === 5251 || code === 5261 || code === 5712) return 'Home & Garden';
  if (code === 5815 || code === 5816 || code === 5817 || code === 5818) return 'Streaming Services';
  if (code === 6010 || code === 6011) return 'Cash Withdrawals & ATM';
  return undefined;
}

/**
 * Mobile wallets show up in card remittance text as the payment method ("... via Apple Pay"), not the merchant.
 * Left in, "Apple Pay" matches the Apple brand and every tap-to-pay purchase becomes an Apple purchase.
 */
const PAYMENT_WALLET_PATTERN = /(?:\b(?:via|met|with|using|par|mit|door|per)\s+)?\b(?:apple|google|samsung|garmin|fitbit|curve|paypal\s+in\s+store)\s*pay\b|\bg[\s-]?pay\b|\bapple\s+wallet\b/gi;

/** Removes mobile-wallet payment method wording and tidies the separators left behind. */
export function stripPaymentWallet(text: string): string {
  return text
    .replace(PAYMENT_WALLET_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-:*/,]+|[\s\-:*/,]+$/g, '')
    .trim();
}

/**
 * Matches a merchant name or raw description against the known brand knowledge base.
 */
export function matchKnownBrand(text?: string | null): KnownBrand | undefined {
  if (!text) return undefined;
  const lower = stripPaymentWallet(text).toLowerCase();
  if (!lower || lower.length < 2) return undefined;

  for (const brand of KNOWN_BRANDS) {
    if (lower === brand.canonicalName.toLowerCase()) return brand;
    for (const kw of brand.keywords) {
      // Match whole word or clear boundary so short keywords like 'bp' or 'ns' don't match substrings inside words
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
      if (regex.test(lower)) {
        return brand;
      }
    }
  }
  return undefined;
}

/**
 * Looks up a Brandfetch domain for a merchant name using KNOWN_BRANDS or a clean domain heuristic.
 */
export function guessBrandDomain(name: string): string | null {
  const matched = matchKnownBrand(name);
  if (matched) return matched.domain;

  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanName || cleanName.length < 2) return null;
  return `${cleanName}.com`;
}

/**
 * Resolves account balance from an Enable Banking `/accounts/{id}/balances` response.
 * Supports both ISO 20022 4-letter codes (`CLBD`, `XPCD`, `ITAV`, `ITBD`, `OPBD`) and camelCase equivalents.
 */
export function resolveEnableBankingBalance(balances: any): { amount: number; currency: string | undefined; balanceType: string | undefined } {
  const balanceEntries: any[] = Array.isArray(balances)
    ? balances
    : balances?.balances || balances?.account?.balances || [];
  if (!Array.isArray(balanceEntries) || balanceEntries.length === 0) {
    return { amount: 0, currency: undefined, balanceType: undefined };
  }

  const getType = (entry: any): string => String(entry?.balance_type || entry?.balanceType || '').trim();

  const priorityOrder = [
    ['CLBD', 'closingBooked'],
    ['XPCD', 'expected'],
    ['ITAV', 'interimAvailable'],
    ['ITBD', 'interimBooked'],
    ['FWAV', 'forwardAvailable'],
    ['OPBD', 'openingBooked'],
  ];

  let prioritizedBalance: any = undefined;
  for (const group of priorityOrder) {
    prioritizedBalance = balanceEntries.find(entry => group.includes(getType(entry)));
    if (prioritizedBalance) break;
  }
  if (!prioritizedBalance) {
    prioritizedBalance = balanceEntries[0];
  }

  const amountRaw = prioritizedBalance?.balance_amount?.amount
    ?? prioritizedBalance?.balanceAmount?.amount
    ?? prioritizedBalance?.amount?.amount
    ?? prioritizedBalance?.amount;
  const parsedAmount = Number(amountRaw);
  const currency = prioritizedBalance?.balance_amount?.currency
    ?? prioritizedBalance?.balanceAmount?.currency
    ?? prioritizedBalance?.amount?.currency;

  return {
    amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    currency: typeof currency === 'string' ? currency : undefined,
    balanceType: getType(prioritizedBalance) || undefined,
  };
}

/**
 * Extracts the session-level `uid` (used for `/accounts/{uid}/balances` and `/transactions` calls)
 * as well as stable cross-session identifiers (`identificationHash` and `accountNumber` / IBAN).
 */
export function extractProviderAccountIdentifiers(account: any, details?: any): {
  uid: string | undefined;
  identificationHash: string | undefined;
  accountNumber: string | undefined;
} {
  if (typeof account === 'string') {
    return { uid: account, identificationHash: undefined, accountNumber: undefined };
  }
  if (!account) {
    return { uid: undefined, identificationHash: undefined, accountNumber: undefined };
  }

  const uid =
    (typeof account.uid === 'string' && account.uid)
    || (typeof account.account_id === 'string' && account.account_id)
    || account?.account_id?.id
    || account?.accountId
    || account?.account?.id
    || account?.resource_id
    || account?.id;

  const identificationHash =
    (typeof account.identification_hash === 'string' && account.identification_hash)
    || (typeof account.identificationHash === 'string' && account.identificationHash)
    || (Array.isArray(account.identification_hashes) && typeof account.identification_hashes[0] === 'string' ? account.identification_hashes[0] : undefined)
    || (typeof details?.identification_hash === 'string' ? details.identification_hash : undefined);

  const rawAccountNumber =
    account?.account_id?.iban
    || account?.account_id?.other?.identification
    || account?.iban
    || details?.account_id?.iban
    || details?.account_id?.other?.identification
    || details?.iban
    || (typeof account?.account_number === 'string' ? account.account_number : undefined);

  const accountNumber = typeof rawAccountNumber === 'string' && rawAccountNumber.trim()
    ? rawAccountNumber.replace(/\s+/g, '').trim()
    : undefined;

  return { uid, identificationHash, accountNumber };
}

/**
 * Finds an existing `EnableBankingAccount` across session renewals even when the bank/Enable Banking
 * assigns a brand-new `uid` to the account. Matches by `id` (`uid`), `identificationHash`, or `accountNumber` (IBAN).
 */
export function matchExistingProviderAccount(
  existingAccounts: EnableBankingAccount[] | undefined,
  identifiers: { uid?: string; identificationHash?: string; accountNumber?: string },
): EnableBankingAccount | undefined {
  if (!existingAccounts || existingAccounts.length === 0) return undefined;
  if (identifiers.uid) {
    const byId = existingAccounts.find(a => a.id === identifiers.uid);
    if (byId) return byId;
  }
  if (identifiers.identificationHash) {
    const byHash = existingAccounts.find(a => a.identificationHash && a.identificationHash === identifiers.identificationHash);
    if (byHash) return byHash;
  }
  if (identifiers.accountNumber) {
    const normIban = identifiers.accountNumber.replace(/\s+/g, '').toUpperCase();
    const byIban = existingAccounts.find(a => a.accountNumber && a.accountNumber.replace(/\s+/g, '').toUpperCase() === normIban);
    if (byIban) return byIban;
  }
  return undefined;
}

/**
 * Computes the `date_from` query parameter for transaction fetching.
 * In `incremental` mode, applies a 5-day lookback buffer so weekend/delayed-settlement bookings are never missed.
 */
export function computeSyncDateFrom(options: {
  transactionMode?: 'full' | 'incremental' | 'none';
  syncStartDate?: string;
  accountSyncStartDate?: string;
  accountLastSyncedAt?: string;
}): string | undefined {
  const mode = options.transactionMode || 'full';
  const earliestAllowed = options.accountSyncStartDate;

  if (mode === 'incremental' && options.accountLastSyncedAt) {
    const lastDateStr = options.accountLastSyncedAt.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(lastDateStr)) {
      const parsed = parseLocalDate(lastDateStr);
      parsed.setDate(parsed.getDate() - 5);
      const buffered = toLocalISOString(parsed);
      if (earliestAllowed && buffered < earliestAllowed) {
        return earliestAllowed;
      }
      return buffered;
    }
  }

  return options.syncStartDate || options.accountSyncStartDate;
}

const ACRONYMS = new Set(['SNCB', 'NMBS', 'STIB', 'MIVB', 'SNCF', 'RATP', 'HSL', 'KBC', 'ING', 'BNP', 'CBC', 'AXA', 'IKEA', 'H&M', 'KFC', 'BP', 'Q8', 'NS', 'VR', 'KPN', 'VOO', 'DIY', 'ATM', 'TV', 'UK', 'US', 'EU']);

/**
 * Formats ALL-CAPS bank merchant strings into readable Title Case while keeping known acronyms intact.
 */
export function formatMerchantCasing(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  // Only re-case if the string is predominantly uppercase (e.g. "BAKKERIJ JANSSENS")
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 3 || letters !== letters.toUpperCase()) {
    return trimmed;
  }
  return trimmed
    .split(/\s+/)
    .map(word => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      if (word.length <= 2 && /^[A-Z0-9&]+$/.test(word)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Extracts merchant name (and optional city) from European bank POS/SEPA structured sentence templates
 * (e.g., KBC/BNP/ING "Betaling met bankkaart bij BAKKERIJ JANSSENS te GENT", "Paiement par carte chez ...").
 */
export function parseEuropeanBankRemittance(text?: string): { merchant?: string; city?: string } {
  if (!text || typeof text !== 'string') return {};
  const singleLine = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!singleLine) return {};

  // Dutch/Flemish: "Betaling met bankkaart bij <MERCHANT> te <CITY>..." or "Aankoop met bankkaart bij <MERCHANT>"
  const nlMatch = singleLine.match(/(?:betaling|aankoop)\s+(?:met\s+(?:bankkaart|debetkaart|kredietkaart|kaart)(?:\s*\([^)]*\))?\s+)?(?:\([^)]*\)\s+)?(?:bij|aan)\s+(.+?)(?:\s+te\s+([A-Za-zÀ-ÿ-]+))?(?:\s+(?:op\s+)?\d{2}[/.-]\d{2}[/.-]\d{2,4}|\s+om\s+\d{2}[:.]\d{2}|\s+met\s+kaart|$)/i);
  if (nlMatch?.[1]) {
    return { merchant: nlMatch[1].trim(), city: nlMatch[2]?.trim() };
  }

  // French: "Paiement par carte chez <MERCHANT> à <CITY>..." or "Achat par carte chez <MERCHANT>"
  const frMatch = singleLine.match(/(?:paiement|achat)\s+(?:par\s+carte(?:\s+bancaire)?(?:\s*\([^)]*\))?\s+)?(?:\([^)]*\)\s+)?(?:chez|auprès\s+de)\s+(.+?)(?:\s+[àa]\s+([A-Za-zÀ-ÿ-]+))?(?:\s+(?:le\s+)?\d{2}[/.-]\d{2}|\s+\d{2}[/.-]\d{2}[/.-]\d{2,4}|$)/i);
  if (frMatch?.[1]) {
    return { merchant: frMatch[1].trim(), city: frMatch[2]?.trim() };
  }

  // German: "Kartenzahlung bei <MERCHANT> in <CITY>..."
  const deMatch = singleLine.match(/(?:kartenzahlung|lastschrift|zahlung)\s+bei\s+(.+?)(?:\s+in\s+([A-Za-zÀ-ÿ-]+))?(?:\s+(?:am\s+)?\d{2}[/.-]\d{2}|$)/i);
  if (deMatch?.[1]) {
    return { merchant: deMatch[1].trim(), city: deMatch[2]?.trim() };
  }

  return {};
}

const GENERIC_PROCESSOR_NAMES = new Set([
  'sumup', 'zettle', 'izettle', 'mollie', 'adyen', 'stripe', 'paypal', 'worldline', 'ccv', 'vivawallet', 'viva wallet', 'square', 'buckaroo', 'multisafepay', 'payconiq', 'bancontact', 'klarna',
]);

/**
 * Cleans and normalizes a raw merchant candidate string.
 * Filters out raw IBANs, user's own name (self-transfers), payment processor prefixes, and bank boilerplate.
 */
export function sanitizeBankMerchant(
  candidate?: string,
  options?: {
    accountDisplayName?: string;
    ownerName?: string;
    userFullName?: string;
    demoUserFullName?: string;
    existingMerchantNames?: string[];
  },
): string | undefined {
  if (!candidate || typeof candidate !== 'string') return undefined;
  // "Apple Pay" / "Google Pay" is how the card was used, never who was paid.
  const trimmed = stripPaymentWallet(candidate);
  if (!trimmed) return undefined;

  // Filter out raw IBANs and long numeric IDs
  const cleanedForIbanCheck = trimmed.replace(/\s+/g, '');
  if (/^([A-Z]{2}\d{2}[A-Z0-9]{8,30}|\d{6,})$/i.test(cleanedForIbanCheck)) return undefined;

  // Filter out generic invoice/reference lines that are not merchant names
  if (/^(invoice|factuur|facture|rechnung|ref|reference|mededeling|communication|structured\s+ref|sepa\s+transfer|overschrijving|virement)\b[\s:#0-9/-]*$/i.test(trimmed)) {
    return undefined;
  }

  const normalized = trimmed.toLowerCase();

  // Filter out user's own identity
  const identities = [
    options?.accountDisplayName?.trim().toLowerCase(),
    options?.ownerName?.trim().toLowerCase(),
    options?.userFullName?.trim().toLowerCase(),
    options?.demoUserFullName?.trim().toLowerCase(),
  ].filter(Boolean) as string[];

  for (const identity of identities) {
    if (normalized === identity) return undefined;
    if (identity.length > 3 && (normalized.startsWith(`transfer to ${identity}`) || normalized.startsWith(`transfer from ${identity}`) || normalized === `payment to ${identity}`)) {
      return undefined;
    }
    const nameParts = identity.split(/\s+/).filter(p => p.length > 2);
    if (nameParts.length >= 2) {
      const hasAllParts = nameParts.every(part => normalized.includes(part));
      if (hasAllParts && normalized.length < identity.length + 8) {
        return undefined;
      }
    }
  }

  // First check if it's a European structured bank template
  const templateParsed = parseEuropeanBankRemittance(trimmed);
  let cleaned = templateParsed.merchant || trimmed;

  // Iteratively strip payment facilitators & bank transaction boilerplate prefixes
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(/^(BE-|NL-|FR-|DE-|FI-|PURCHASE\s*|AANKOOP\s*|PAIEMENT\s*|BETALING\s*|WWW\.|HTTP[S]?:\/\/)/i, '');
    cleaned = cleaned.replace(/^(CARD\s+PAYMENT|CARD\s+PURCHASE|CARD|POS|DIRECT\s+DEBIT|SEPA\s+DIRECT\s+DEBIT|SEPA\s+CREDIT\s+TRANSFER|SEPA|DOMICILIERING|DOMICILIATION|SOFORT|IDEAL\s*\*?|BANCONTACT\s*\*?|MAESTRO\s*\*?|RECURRING\s+PAYMENT|RECURRING|SUBSCRIPTION|BILL\s+PAYMENT|PAYMENT\s+TO|PAYMENT|STATEMENT)\s*[-:/*]?\s*/i, '');
    cleaned = cleaned.replace(/^(PAYPAL[\s_-]*\*|SUMUP[\s_-]*\*|ZETTLE[\s_-]*\*|IZETTLE[\s_-]*\*|MOLLIE[\s_-]*\*|ADYEN[\s_-]*\*|STRIPE[\s_-]*\*|CCV[\s_-]*\*|WL[\s_-]*\*|WORLDLINE[\s_-]*\*|VIVA\s*WALLET[\s_-]*\*|BUCKAROO[\s_-]*\*|PAYCONIQ[\s_-]*\*|SQ[\s_-]*\*|TST[\s_-]*\*|SP[\s_-]*\*|PY[\s_-]*\*|APPLE\s+BILL|GOOGLE[\s_-]*\*|AMZN[\s_-]*\*|AMAZON[\s_-]*\*|G\.CO\/HELPPAY#?)\s*[-_:]?\s*/i, '');
  }

  // Remove specific bank routing text like "RETAIL BRUSSELS BE "
  cleaned = cleaned.replace(/RETAIL\s+[a-zA-Z\s]+\s+[A-Z]{2}\s+/i, '');
  // Remove trailing helpline/web URLs
  cleaned = cleaned.replace(/\s+G\.CO\/(HELPPAY|PAYHELP|BILL).*/i, '');
  cleaned = cleaned.replace(/\s+AMZN\.COM\/(BILL|PAY).*/i, '');
  // Remove trailing reference codes after * (e.g. AMZN MKTP*29384 -> AMZN MKTP)
  cleaned = cleaned.replace(/\*[A-Z0-9_\-\s]+$/i, '');
  // Remove embedded dates
  cleaned = cleaned.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');
  cleaned = cleaned.replace(/\b\d{2}[/.-]\d{2}[/.-]\d{2,4}\b/g, '');
  // Remove obvious reference IDs, terminal numbers, or long hashes
  cleaned = cleaned.replace(/#\d+/g, '');
  cleaned = cleaned.replace(/\b(?:TERM|TERMINAL|PAS|CARD|KAART|NR)\s*\d+\b/gi, '');
  cleaned = cleaned.replace(/\b(?:[A-Z0-9]{10,})\b/g, '');
  // Strip trailing corporate legal entity suffixes (e.g., "Colruyt NV", "Spotify AB", "Uber BV")
  cleaned = cleaned.replace(/\s+(?:B\.?V\.?|N\.?V\.?|S\.?A\.?|S\.?R\.?L\.?|S\.?P\.?R\.?L\.?|GMBH|A\.?G\.?|O\.?Y\.?|A\.?B\.?|A\.?P\.?S\.?|L\.?T\.?D\.?|I\.?N\.?C\.?|L\.?L\.?C\.?|P\.?L\.?C\.?)$/i, '');

  // Check against known brands before stripping TLDs (so "BOL.COM" or "BOOKING.COM" matches directly)
  const earlyKnown = matchKnownBrand(cleaned);
  if (earlyKnown) {
    return earlyKnown.canonicalName;
  }

  // Remove generic TLDs at the end
  cleaned = cleaned.replace(/\.(COM|NET|ORG|BE|NL|EU|CO\.UK|FR|DE|IT|ES|FI|SE|IO|APP)$/i, '');

  // Normalize whitespace and underscores
  cleaned = cleaned.replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim();
  // Remove trailing store/branch numbers (e.g. "Carrefour Express 4029" -> "Carrefour Express")
  cleaned = cleaned.replace(/\s+\d{3,}$/, '').trim();

  if (!cleaned || cleaned.length < 2 || /^\d+$/.test(cleaned)) return undefined;

  // Check against known brands dictionary
  const known = matchKnownBrand(cleaned);
  if (known) {
    return known.canonicalName;
  }

  // Legacy specific normalizations
  if (/^GYM\s*SUBSCRIPTION/i.test(cleaned) || /^FITNESS\s*GYM/i.test(cleaned)) {
    return 'Gym Subscription';
  }

  // Check against user's existing canonical merchants (exact case-insensitive or prefix match)
  if (options?.existingMerchantNames?.length) {
    const lowerCleaned = cleaned.toLowerCase();
    for (const existing of options.existingMerchantNames) {
      const lowerExisting = existing.trim().toLowerCase();
      if (!lowerExisting || lowerExisting.length < 3) continue;
      if (lowerCleaned === lowerExisting || lowerCleaned.startsWith(`${lowerExisting} `)) {
        return existing.trim();
      }
    }
  }

  return formatMerchantCasing(cleaned);
}

/**
 * Resolves the transaction date from an Enable Banking transaction payload.
 * Prefers explicit purchase/transaction dates, then embedded European dates in remittance text,
 * then booking date, then value date (clamped to today so future settlement dates don't appear in the future).
 */
export function resolveEnableBankingTransactionDate(providerTx: any, todayOverride?: string): string {
  const todayStr = todayOverride || toLocalISOString(new Date());

  const pickFirstText = (...values: any[]): string | undefined => {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      if (Array.isArray(value)) {
        const nested = pickFirstText(...value);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  const normalizeDateStr = (val: any): string | undefined => {
    if (!val || typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.includes('T') || trimmed.includes(':')) {
      try {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) return toLocalISOString(parsed);
      } catch { /* ignore */ }
      const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    return undefined;
  };

  const rawBookingDate = pickFirstText(
    providerTx?.booking_date,
    providerTx?.bookingDate,
    providerTx?.booking_date_time,
    providerTx?.bookingDateTime,
    providerTx?.book_date,
    providerTx?.bookDate,
    providerTx?.entry_date,
    providerTx?.entryDate,
    providerTx?.entry_date_time,
    providerTx?.entryDateTime,
  );
  const bookingDateStr = normalizeDateStr(rawBookingDate);
  const maxAllowedDateStr = bookingDateStr && bookingDateStr <= todayStr ? bookingDateStr : todayStr;

  const rawExplicitDate = pickFirstText(
    providerTx?.transaction_date,
    providerTx?.transactionDate,
    providerTx?.transaction_date_time,
    providerTx?.transactionDateTime,
    providerTx?.authorized_date,
    providerTx?.authorizedDate,
    providerTx?.authorized_date_time,
    providerTx?.authorizedDateTime,
    providerTx?.purchase_date,
    providerTx?.purchaseDate,
    providerTx?.purchase_date_time,
    providerTx?.purchaseDateTime,
    providerTx?.origination_date,
    providerTx?.originationDate,
    providerTx?.origination_date_time,
    providerTx?.originationDateTime,
    providerTx?.user_transaction_date,
    providerTx?.userTransactionDate,
    providerTx?.card_transaction?.transaction_date,
    providerTx?.card_transaction?.transaction_date_time,
    providerTx?.card_transaction?.authorized_date,
    providerTx?.card_transaction?.authorized_date_time,
    providerTx?.card_transaction_details?.transaction_date,
    providerTx?.card_transaction_details?.transaction_date_time,
    providerTx?.card_acceptor?.transaction_date,
  );

  const explicitDateStr = normalizeDateStr(rawExplicitDate);
  if (explicitDateStr && explicitDateStr <= maxAllowedDateStr) {
    return explicitDateStr;
  }

  const combinedText = [
    providerTx?.remittance_information_unstructured,
    providerTx?.remittanceInformationUnstructured,
    providerTx?.remittance_information,
    providerTx?.remittanceInformation,
    providerTx?.booking_text,
    providerTx?.bookingText,
    providerTx?.additional_information,
    providerTx?.additionalInformation,
    providerTx?.description,
  ]
    .flatMap(item => (Array.isArray(item) ? item : [item]))
    .filter(Boolean)
    .join(' ');

  if (combinedText) {
    const checkExtracted = (extractedStr: string): string | undefined => {
      if (extractedStr <= maxAllowedDateStr) {
        try {
          const candMs = parseLocalDate(extractedStr).getTime();
          const maxMs = parseLocalDate(maxAllowedDateStr).getTime();
          const diffDays = (maxMs - candMs) / (1000 * 60 * 60 * 24);
          if (diffDays >= 0 && diffDays <= 90) return extractedStr;
        } catch { /* ignore */ }
      }
      return undefined;
    };

    const dmyMatch = combinedText.match(/\b(0[1-9]|[12]\d|3[01])[/.-](0[1-9]|1[0-2])[/.-](20\d{2})\b/);
    if (dmyMatch) {
      const hit = checkExtracted(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`);
      if (hit) return hit;
    }

    const ymdMatch = combinedText.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
    if (ymdMatch) {
      const hit = checkExtracted(`${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`);
      if (hit) return hit;
    }

    const dmyShortMatch = combinedText.match(/\b(0[1-9]|[12]\d|3[01])[/.-](0[1-9]|1[0-2])[/.-](2[0-9])\b/);
    if (dmyShortMatch) {
      const hit = checkExtracted(`20${dmyShortMatch[3]}-${dmyShortMatch[2]}-${dmyShortMatch[1]}`);
      if (hit) return hit;
    }
  }

  if (bookingDateStr && bookingDateStr <= todayStr) {
    return bookingDateStr;
  }

  const rawValueDate = pickFirstText(
    providerTx?.value_date,
    providerTx?.valueDate,
    providerTx?.value_date_time,
    providerTx?.valueDateTime,
  );
  const valueDateStr = normalizeDateStr(rawValueDate);
  if (valueDateStr && valueDateStr <= todayStr) {
    return valueDateStr;
  }

  const fallback = normalizeDateStr(providerTx?.date) || todayStr;
  return fallback > todayStr ? todayStr : fallback;
}

/**
 * Maps a raw Enable Banking transaction into a Crystal `Transaction`.
 * Prioritizes structured counterparty fields (`card_acceptor`, `ultimate_creditor`/`debtor`, `creditor`/`debtor`)
 * over unstructured remittance text, unwraps payment processors, and detects MCC / brand categories.
 */
export function mapEnableBankingTransaction(
  providerTx: any,
  options: {
    linkedAccountId: string | undefined;
    providerAccountId: string;
    currency: Currency;
    connectionId: string;
    accountDisplayName?: string;
    ownerName?: string;
    userFullName?: string;
    demoUserFullName?: string;
    userIdentities?: string[];
    existingMerchantNames?: string[];
    linkedIbanToAccountName?: Map<string, string> | Record<string, string>;
    ownAccountNumbers?: string[];
    todayOverride?: string;
  },
): Transaction | null {
  const { linkedAccountId, providerAccountId, currency, connectionId } = options;
  const amountRaw =
    providerTx?.transaction_amount?.amount ??
    providerTx?.transaction_amount?.value ??
    providerTx?.amount?.amount ??
    providerTx?.amount?.value ??
    providerTx?.transactionAmount?.amount ??
    providerTx?.transactionAmount?.value;
  if (amountRaw === undefined || amountRaw === null || !linkedAccountId) return null;

  const creditDebit = providerTx?.credit_debit_indicator || providerTx?.creditDebitIndicator;
  const isCredit = creditDebit === 'CRDT' || (typeof amountRaw === 'string' && !amountRaw.startsWith('-') && creditDebit !== 'DBIT');
  const signedAmount = Math.abs(Number(amountRaw)) * (isCredit ? 1 : -1);
  const rawSignedAmount = (signedAmount === Math.abs(Number(amountRaw)) && typeof amountRaw === 'string' && amountRaw.startsWith('-'))
    ? Number(amountRaw)
    : signedAmount;
  const finalAmount = safeRound(rawSignedAmount, currency === 'BTC' ? 8 : 2);

  if (Number.isNaN(finalAmount)) return null;

  const pickFirstText = (...values: any[]): string | undefined => {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      if (Array.isArray(value)) {
        const nested = pickFirstText(...value);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  const pickJoinedText = (...values: any[]): string | undefined => {
    const segments: string[] = [];
    const visit = (value: any) => {
      if (!value) return;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && !segments.includes(trimmed)) segments.push(trimmed);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (typeof value === 'object') {
        visit(value?.remittance_line);
        visit(value?.remittanceLine);
        visit(value?.reference);
      }
    };
    values.forEach(visit);
    return segments.length > 0 ? segments.join(' / ') : undefined;
  };

  const sanitizeOpts = {
    accountDisplayName: options.accountDisplayName,
    ownerName: options.ownerName,
    userFullName: options.userFullName || options.userIdentities?.[0],
    demoUserFullName: options.demoUserFullName || options.userIdentities?.[1],
    existingMerchantNames: options.existingMerchantNames,
  };

  const isGenericProcessor = (name?: string) => {
    if (!name) return false;
    const lower = name.trim().toLowerCase();
    if (GENERIC_PROCESSOR_NAMES.has(lower)) return true;
    for (const proc of GENERIC_PROCESSOR_NAMES) {
      if (lower.includes(proc) && /\b(payments?|stichting|europe|services?|bv|nv|ltd|sa|gmbh)\b/i.test(lower)) {
        return true;
      }
    }
    return false;
  };

  const pickFirstValidMerchant = (skipProcessors: boolean, ...values: any[]): string | undefined => {
    for (const value of values) {
      if (!value) continue;
      if (typeof value === 'string') {
        const sanitized = sanitizeBankMerchant(value, sanitizeOpts);
        if (sanitized && (!skipProcessors || !isGenericProcessor(sanitized))) {
          return sanitized;
        }
      }
      if (Array.isArray(value)) {
        const nested = pickFirstValidMerchant(skipProcessors, ...value);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  // Counterparty fields in priority order:
  // 1. Explicit merchant / card acceptor fields
  // 2. Ultimate creditor/debtor (unwraps payment facilitators when bank provides ultimate party)
  // 3. Direct creditor (for outflows) / debtor (for inflows)
  // 4. Remittance information (for embedded brand or template merchant)
  const structuredCandidates = [
    providerTx?.merchant_name,
    providerTx?.merchantName,
    providerTx?.merchant?.name,
    providerTx?.merchant?.display_name,
    providerTx?.merchant?.displayName,
    providerTx?.card_acceptor?.name,
    providerTx?.cardAcceptor?.name,
    ...(isCredit
      ? [
          providerTx?.ultimate_debtor?.name,
          providerTx?.ultimate_debtor,
          providerTx?.ultimateDebtor?.name,
          providerTx?.ultimateDebtor,
          providerTx?.debtor_name,
          providerTx?.debtorName,
          providerTx?.debtor?.name,
          providerTx?.debtor?.account?.name,
          providerTx?.debtorAccount?.name,
          providerTx?.counterparty_name,
          providerTx?.counterpartyName,
          providerTx?.counterparty?.name,
          providerTx?.creditor_name,
          providerTx?.creditorName,
          providerTx?.creditor?.name,
        ]
      : [
          providerTx?.ultimate_creditor?.name,
          providerTx?.ultimate_creditor,
          providerTx?.ultimateCreditor?.name,
          providerTx?.ultimateCreditor,
          providerTx?.creditor_name,
          providerTx?.creditorName,
          providerTx?.creditor?.name,
          providerTx?.creditor?.account?.name,
          providerTx?.creditorAccount?.name,
          providerTx?.counterparty_name,
          providerTx?.counterpartyName,
          providerTx?.counterparty?.name,
          providerTx?.debtor_name,
          providerTx?.debtorName,
          providerTx?.debtor?.name,
        ]),
  ];

  const remittanceCandidates = [
    providerTx?.remittance_information_unstructured,
    providerTx?.remittanceInformationUnstructured,
    providerTx?.remittance_information,
    providerTx?.remittance_information_unstructured_array,
    providerTx?.remittanceInformationUnstructuredArray,
    providerTx?.remittance_information_structured,
    providerTx?.remittanceInformationStructured,
    providerTx?.booking_text,
    providerTx?.bookingText,
    providerTx?.additional_information,
    providerTx?.additionalInformation,
  ];

  // First pass: try structured fields, skipping bare payment processors ("PayPal", "SumUp") in case remittance has the actual store
  let merchant = pickFirstValidMerchant(true, ...structuredCandidates);

  // If remittance text contains a known brand or structured bank POS template, check it
  if (!merchant) {
    const remJoined = pickJoinedText(...remittanceCandidates);
    const knownInRemittance = matchKnownBrand(remJoined);
    if (knownInRemittance) {
      merchant = knownInRemittance.canonicalName;
    } else {
      const templateParsed = parseEuropeanBankRemittance(remJoined);
      if (templateParsed.merchant) {
        merchant = sanitizeBankMerchant(templateParsed.merchant, sanitizeOpts);
      }
    }
  }

  // Second pass: allow payment processor name from structured fields or fall back to sanitized remittance line
  if (!merchant) {
    merchant = pickFirstValidMerchant(false, ...structuredCandidates, ...remittanceCandidates);
  }

  const desc = pickFirstText(
    pickJoinedText(
      providerTx?.remittance_information_unstructured,
      providerTx?.remittanceInformationUnstructured,
      providerTx?.remittance_information,
      providerTx?.remittance_information_unstructured_array,
      providerTx?.remittanceInformationUnstructuredArray,
      providerTx?.remittance_information_structured,
      providerTx?.remittanceInformationStructured,
      providerTx?.remittance_information_structured_array,
      providerTx?.remittanceInformationStructuredArray,
      providerTx?.remittance_information_reference,
      providerTx?.remittanceInformationReference,
    ),
    providerTx?.additional_information,
    providerTx?.additionalInformation,
    providerTx?.booking_text,
    providerTx?.bookingText,
    providerTx?.description,
    providerTx?.bank_transaction_code?.description,
    providerTx?.proprietary_bank_transaction_code?.description,
    providerTx?.proprietaryBankTransactionCode?.description,
    providerTx?.reference_number,
    merchant,
  ) || 'Transaction';

  // Detect internal transfer via counterparty IBAN matching another linked account
  const counterpartyIbanRaw = isCredit
    ? (providerTx?.debtor_account?.iban || providerTx?.debtorAccount?.iban || providerTx?.debtor?.account?.iban)
    : (providerTx?.creditor_account?.iban || providerTx?.creditorAccount?.iban || providerTx?.creditor?.account?.iban);
  const counterpartyIban = typeof counterpartyIbanRaw === 'string' ? counterpartyIbanRaw.replace(/\s+/g, '').toUpperCase() : undefined;
  const matchedOwnAccountName = counterpartyIban
    ? (options.linkedIbanToAccountName instanceof Map
        ? options.linkedIbanToAccountName.get(counterpartyIban)
        : options.linkedIbanToAccountName?.[counterpartyIban])
    : undefined;

  let finalDesc = desc;
  if (matchedOwnAccountName && finalDesc === 'Transaction') {
    finalDesc = isCredit ? `Transfer from ${matchedOwnAccountName}` : `Transfer to ${matchedOwnAccountName}`;
  }

  // Determine automatic category:
  // 1. Internal transfer if counterparty IBAN belongs to another user account
  // 2. Known Brand default category
  // 3. ISO 18245 Merchant Category Code (`merchant_category_code` / `mcc`)
  // 4. Fallback to 'Uncategorized' (user rules in `applySavedRules` will run on top of this)
  const mcc =
    providerTx?.merchant_category_code
    ?? providerTx?.merchantCategoryCode
    ?? providerTx?.card_acceptor?.merchant_category_code
    ?? providerTx?.cardAcceptor?.merchantCategoryCode;
  const knownBrand = matchKnownBrand(merchant) || matchKnownBrand(desc);
  if (!merchant && knownBrand) {
    merchant = knownBrand.canonicalName;
  }

  let autoCategory = 'Uncategorized';
  if (matchedOwnAccountName) {
    autoCategory = 'Transfer';
    if (!merchant) merchant = matchedOwnAccountName;
  } else if (knownBrand?.defaultCategory) {
    autoCategory = knownBrand.defaultCategory;
  } else {
    const mccCategory = mapMccToCategory(mcc);
    if (mccCategory) autoCategory = mccCategory;
  }

  // Extract optional city/country from card_acceptor or European template
  const remTemplate = parseEuropeanBankRemittance(desc);
  const rawCity = pickFirstText(
    providerTx?.card_acceptor?.city,
    providerTx?.cardAcceptor?.city,
    providerTx?.card_acceptor?.address?.city,
    remTemplate.city,
  );
  const city = rawCity ? formatMerchantCasing(rawCity) : undefined;
  const country = pickFirstText(
    providerTx?.card_acceptor?.country,
    providerTx?.cardAcceptor?.country,
    providerTx?.card_acceptor?.address?.country,
  );

  // Extract foreign exchange details into notes if present
  const fx = Array.isArray(providerTx?.exchange_rate) ? providerTx.exchange_rate[0] : (providerTx?.exchange_rate || providerTx?.exchangeRate);
  const instructedAmount = fx?.instructed_amount?.amount ?? fx?.instructedAmount?.amount ?? providerTx?.instructed_amount?.amount;
  const instructedCurrency = fx?.instructed_amount?.currency ?? fx?.instructedAmount?.currency ?? fx?.unit_currency ?? providerTx?.instructed_amount?.currency;
  const exchangeRateVal = fx?.exchange_rate ?? fx?.exchangeRate;
  let notes: string | undefined;
  if (instructedAmount && instructedCurrency && instructedCurrency !== currency) {
    notes = `Original amount: ${instructedAmount} ${instructedCurrency}${exchangeRateVal ? ` (rate: ${exchangeRateVal})` : ''}`;
  }

  // The note the account holder wrote at their bank (`note` in the API) is kept alongside any FX details.
  const psuNote = pickFirstText(providerTx?.note);
  if (psuNote) notes = notes ? `${psuNote}\n${notes}` : psuNote;

  const date = resolveEnableBankingTransactionDate(providerTx, options.todayOverride);

  const stableIdFromFallback = (...parts: (string | number | undefined)[]) => {
    const input = parts.filter(Boolean).join('|');
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return `fallback-${Math.abs(hash)}`;
  };

  // `entry_reference` is stable across retrievals and sessions; `transaction_id` can change between fetches,
  // so it is only a fallback. See getLegacyEnableBankingTransactionId for rows imported before this change.
  const providerTransactionId = pickFirstText(
    providerTx?.entry_reference,
    providerTx?.entryReference,
    providerTx?.transaction_id,
    providerTx?.transactionId,
    providerTx?.end_to_end_id,
    providerTx?.endToEndId,
    providerTx?.internal_transaction_id,
    providerTx?.internalTransactionId,
  ) || stableIdFromFallback(providerAccountId, amountRaw, creditDebit, date, desc, merchant);

  return {
    id: `eb-${connectionId}-${providerAccountId}-${providerTransactionId}`,
    sureId: providerTransactionId,
    accountId: linkedAccountId,
    date,
    description: finalDesc,
    merchant,
    amount: finalAmount,
    category: autoCategory,
    type: finalAmount >= 0 ? 'income' : 'expense',
    currency,
    importId: `enable-banking-${connectionId}-${linkedAccountId}`,
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
    ...(notes ? { notes } : {}),
  };
}

/**
 * The id the mapper produced before `entry_reference` was preferred (it used `transaction_id` first).
 * Returns undefined when it would be identical to the current id. Callers use it to keep already-imported
 * rows matched instead of importing them a second time.
 */
export function getLegacyEnableBankingTransactionId(
  providerTx: any,
  connectionId: string,
  providerAccountId: string,
): string | undefined {
  const pick = (...values: any[]) => values.find(v => typeof v === 'string' && v.trim())?.trim() as string | undefined;
  const legacy = pick(providerTx?.transaction_id, providerTx?.transactionId);
  const current = pick(providerTx?.entry_reference, providerTx?.entryReference);
  if (!legacy || !current || legacy === current) return undefined;
  return `eb-${connectionId}-${providerAccountId}-${legacy}`;
}

/**
 * Crystal account type suggested for a bank account. Uses ISO 20022 `cash_account_type`
 * (CARD, SVGS, LOAN, ...) and falls back to wording in the product name, since many banks omit the type.
 */
export function suggestAccountType(account: { cash_account_type?: string; cashAccountType?: string; product?: string; name?: string } | undefined): 'Checking' | 'Savings' | 'Credit Card' | 'Loan' {
  const type = String(account?.cash_account_type ?? account?.cashAccountType ?? '').toUpperCase();
  if (type === 'SVGS') return 'Savings';
  if (type === 'CARD') return 'Credit Card';
  if (type === 'LOAN') return 'Loan';
  if (type) return 'Checking';
  const label = `${account?.product ?? ''} ${account?.name ?? ''}`.toLowerCase();
  if (/\b(savings?|spaar|épargne|epargne|sparen|sparkonto)\b/.test(label)) return 'Savings';
  if (/\b(credit\s*card|kredietkaart|carte\s+de\s+cr[ée]dit|visa|mastercard|amex)\b/.test(label)) return 'Credit Card';
  return 'Checking';
}
