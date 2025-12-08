
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
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
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
    type GroupedLocation = {
      lat: number;
      lon: number;
      count: number;
      amountTotal: number;
      transactions: Transaction[];
    };
    const grouped = transactions
      .filter(tx => tx.latitude !== undefined && tx.latitude !== null && tx.longitude !== undefined && tx.longitude !== null)
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
      }, new Map<string, GroupedLocation>());

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
  
  const totalSpentInLocations = useMemo(() => {
      return locations.reduce((sum, loc) => sum + Math.abs(loc.amountTotal), 0);
  }, [locations]);

  const getDensityColor = (count: number) => {
    // Normalize count to a 0-1 range and map to a blue -> purple gradient
    const ratio = Math.min(count / maxDensity, 1);
    const hue = 210 + ratio * 60; // 210 (blue) to 270 (purple)
    return `hsl(${hue}, 90%, 60%)`;
  };

  // Tile Layer URL based on theme
  const tileLayerUrl = isDarkMode 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  if (locations.length === 0) {
    return (
        <div className="h-full flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">
            <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">public_off</span>
                <p>No location data found in recent transactions.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden relative z-0 rounded-lg group">
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }} className="z-0 bg-light-bg dark:bg-dark-bg" zoomControl={false}>
            <TileLayer
                attribution={attribution}
                url={tileLayerUrl}
            />
            <BoundsFitter coords={coords} />
            {locations.map(loc => {
                const color = getDensityColor(loc.count);
                // Visualize density with radius that scales slightly with count
                const radius = Math.min(Math.max(6 + Math.log1p(loc.count) * 2, 6), 16);
                const locationLabel = [loc.city, loc.country].filter(Boolean).join(', ') || 'Unknown location';

                return (
                    <CircleMarker
                        key={loc.id}
                        center={[loc.lat, loc.lon]}
                        radius={radius}
                        pathOptions={{
                            color: '#fff',
                            weight: 1,
                            fillColor: color,
                            fillOpacity: 0.8,
                        }}
                    >
                        <Tooltip direction="top" offset={[0, -8]} opacity={1} className="custom-map-tooltip">
                            <div className="text-center space-y-1 min-w-[120px]">
                                <p className="font-bold text-sm">{locationLabel}</p>
                                <p className="text-xs opacity-70">{loc.count} transactions</p>
                                <p className="font-mono font-semibold text-green-600 dark:text-green-400 privacy-blur">{formatCurrency(Math.abs(loc.amountTotal), loc.currency)}</p>
                                <p className="text-[10px] opacity-60 mt-1 border-t border-gray-200 dark:border-gray-700 pt-1">Latest: {loc.description}</p>
                            </div>
                        </Tooltip>
                    </CircleMarker>
                );
            })}
        </MapContainer>
        
        {/* Stats Overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/80 dark:bg-black/60 backdrop-blur-md p-3 rounded-xl shadow-lg border border-white/20 flex flex-col gap-1 min-w-[140px] animate-fade-in-up">
             <div className="flex items-center gap-2 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                 <span className="material-symbols-outlined text-sm">public</span>
                 <span>Explored</span>
             </div>
             <div className="font-bold text-xl text-light-text dark:text-dark-text">
                 {locations.length} <span className="text-sm font-normal opacity-70">places</span>
             </div>
             <div className="text-xs font-medium text-light-text dark:text-dark-text opacity-80 mt-1">
                 Total: <span className="privacy-blur">{formatCurrency(totalSpentInLocations, 'EUR')}</span>
             </div>
        </div>
    </div>
  );
};

export default TransactionMapWidget;
