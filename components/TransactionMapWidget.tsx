
import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { Transaction } from '../types';
import { formatCurrency, parseDateAsUTC } from '../utils';
import L from 'leaflet';

interface TransactionMapWidgetProps {
  transactions: Transaction[];
}

// Component to auto-fit map bounds
const BoundsFitter: React.FC<{ coords: [number, number][] }> = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords.length > 0) {
            const bounds = L.latLngBounds(coords);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        }
    }, [coords, map]);
    return null;
};

const TransactionMapWidget: React.FC<TransactionMapWidgetProps> = ({ transactions }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => document.documentElement.classList.contains('dark');
    setIsDarkMode(checkDarkMode());
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const locations = useMemo(() => {
// FIX: Define a specific type for the grouped location data to avoid 'unknown' type errors.
    type GroupedLocation = {
      lat: number;
      lon: number;
      count: number;
      amountTotal: number;
      transactions: Transaction[];
    };
    const grouped = transactions
      .filter(tx => tx.latitude !== undefined && tx.latitude !== null && tx.longitude !== undefined && tx.longitude !== null)
// FIX: Explicitly type the accumulator in the reduce function to ensure type safety.
      .reduce((map: Map<string, GroupedLocation>, tx) => {
        const key = `${tx.latitude},${tx.longitude}`;
        const current = map.get(key);

        if (current) {
          current.count += 1;
          current.amountTotal += tx.amount;
          current.transactions.push(tx);
        } else {
          map.set(key, {
            lat: tx.latitude!,
            lon: tx.longitude!,
            count: 1,
            amountTotal: tx.amount,
            transactions: [tx],
          });
        }

        return map;
// FIX: Explicitly type the initial value of the reduce function.
      }, new Map<string, GroupedLocation>());

// FIX: Explicitly type the 'group' parameter in the map function.
    return Array.from(grouped.values()).map((group: GroupedLocation) => {
      const representative = group.transactions[0];

      return {
        id: `${group.lat}-${group.lon}`,
        lat: group.lat,
        lon: group.lon,
        count: group.count,
        amountTotal: group.amountTotal,
        currency: representative.currency,
        description: representative.description,
        date: representative.date,
        city: representative.city,
        country: representative.country,
        transactions: group.transactions,
      };
    });
  }, [transactions]);

  const coords: [number, number][] = locations.map(l => [l.lat, l.lon]);

  const maxDensity = useMemo(() => {
    return locations.reduce((max, loc) => Math.max(max, loc.count), 0) || 1;
  }, [locations]);

  const getDensityColor = (count: number) => {
    // Normalize count to a 0-1 range and map to a blue -> yellow -> red gradient
    const ratio = Math.min(count / maxDensity, 1);
    const hue = 200 - ratio * 180; // 200 (blue) to 20 (red)
    return `hsl(${hue}, 85%, 50%)`;
  };

  // Tile Layer URL based on theme
  // Using CartoDB Voyager (Light) and Dark Matter (Dark) for a premium look
  const tileLayerUrl = isDarkMode 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  if (locations.length === 0) {
    return (
        <div className="h-full flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">
            <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2">public_off</span>
                <p>No location data found in transactions.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="h-full w-full rounded-lg overflow-hidden relative z-0">
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }} className="z-0 bg-light-bg dark:bg-dark-bg">
            <TileLayer
                attribution={attribution}
                url={tileLayerUrl}
            />
            <BoundsFitter coords={coords} />
            {locations.map(loc => {
                const color = getDensityColor(loc.count);
                // Visualize density with radius that scales with count
                const radius = Math.min(Math.max(6 + Math.log1p(loc.count) * 4, 8), 24);
                const locationLabel = [loc.city, loc.country].filter(Boolean).join(', ') || 'Unknown location';

                return (
                    <CircleMarker
                        key={loc.id}
                        center={[loc.lat, loc.lon]}
                        radius={radius}
                        pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.55 + Math.min(loc.count / maxDensity, 0.35),
                            weight: 1.5,
                        }}
                    >
                        <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                            <div className="text-center space-y-1">
                                <p className="font-bold">{locationLabel}</p>
                                <p className="text-xs text-gray-500">Transactions: {loc.count}</p>
                                <p className="text-xs">Most recent: {loc.description}</p>
                                <p className="text-xs text-gray-500">{parseDateAsUTC(loc.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}</p>
                                <p className="font-mono">Total: {formatCurrency(loc.amountTotal, loc.currency)}</p>
                            </div>
                        </Tooltip>
                    </CircleMarker>
                );
            })}
        </MapContainer>
    </div>
  );
};

export default TransactionMapWidget;