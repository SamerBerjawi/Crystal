
import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { Transaction } from '../types';
import Card from './Card';
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
    return transactions
      .filter(tx => tx.latitude !== undefined && tx.latitude !== null && tx.longitude !== undefined && tx.longitude !== null)
      .map(tx => ({
        id: tx.id,
        lat: tx.latitude!,
        lon: tx.longitude!,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        date: tx.date,
        city: tx.city,
        country: tx.country
      }));
  }, [transactions]);

  const coords: [number, number][] = locations.map(l => [l.lat, l.lon]);

  // Tile Layer URL based on theme
  // Using CartoDB Voyager (Light) and Dark Matter (Dark) for a premium look
  const tileLayerUrl = isDarkMode 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  if (locations.length === 0) {
    return (
        <Card className="h-full flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">
            <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2">public_off</span>
                <p>No location data found in transactions.</p>
            </div>
        </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col p-0 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-[400] bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-md px-3 py-1 rounded-lg shadow-md pointer-events-none">
             <h3 className="font-semibold text-sm">Transaction Map</h3>
        </div>
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }} className="z-0 bg-light-bg dark:bg-dark-bg">
            <TileLayer
                attribution={attribution}
                url={tileLayerUrl}
            />
            <BoundsFitter coords={coords} />
            {locations.map(loc => {
                const isExpense = loc.amount < 0;
                const color = isExpense ? '#EF4444' : '#22C55E'; // Red for expense, Green for income
                // Visualize amount magnitude with radius, clamped between 5 and 20
                const radius = Math.min(Math.max(Math.abs(loc.amount) / 50, 5), 20);

                return (
                    <CircleMarker 
                        key={loc.id} 
                        center={[loc.lat, loc.lon]} 
                        radius={radius}
                        pathOptions={{ 
                            color: color, 
                            fillColor: color, 
                            fillOpacity: 0.6, 
                            weight: 1 
                        }}
                    >
                        <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                            <div className="text-center">
                                <p className="font-bold">{loc.description}</p>
                                <p className="text-xs">{loc.city}, {loc.country}</p>
                                <p className={`font-mono ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(loc.amount, loc.currency)}
                                </p>
                                <p className="text-xs text-gray-500">{parseDateAsUTC(loc.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}</p>
                            </div>
                        </Tooltip>
                    </CircleMarker>
                );
            })}
        </MapContainer>
    </Card>
  );
};

export default TransactionMapWidget;
