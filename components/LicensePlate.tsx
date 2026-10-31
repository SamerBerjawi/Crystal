import React from 'react';

export const CAR_MAKE_DOMAINS: Record<string, string> = {
  bmw: 'bmw.com',
  tesla: 'tesla.com',
  audi: 'audi.com',
  mercedes: 'mercedes-benz.com',
  'mercedes-benz': 'mercedes-benz.com',
  ford: 'ford.com',
  toyota: 'toyota.com',
  honda: 'honda.com',
  porsche: 'porsche.com',
  volkswagen: 'volkswagen.com',
  vw: 'volkswagen.com',
  nissan: 'nissan-global.com',
  chevrolet: 'chevrolet.com',
  hyundai: 'hyundai.com',
  kia: 'kia.com',
  lexus: 'lexus.com',
  subaru: 'subaru.com',
  mazda: 'mazda.com',
  volvo: 'volvocars.com',
  jaguar: 'jaguar.com',
  landrover: 'landrover.com',
  'land rover': 'landrover.com',
  ferrari: 'ferrari.com',
  lamborghini: 'lamborghini.com',
  jeep: 'jeep.com',
  dodge: 'dodge.com',
  chrysler: 'chrysler.com',
  fiat: 'fiat.com',
  peugeot: 'peugeot.com',
  renault: 'renaultgroup.com',
  citroen: 'citroen.com',
  alfa: 'alfaromeo.com',
  'alfa romeo': 'alfaromeo.com',
  saab: 'saab.com',
  aston: 'astonmartin.com',
  'aston martin': 'astonmartin.com',
  bentley: 'bentleymotors.com',
  maserati: 'maserati.com',
  bugatti: 'bugatti.com',
  byd: 'byd.com',
  rivian: 'rivian.com',
  lucid: 'lucidmotors.com',
  polestar: 'polestar.com',
};

export const LicensePlate: React.FC<{ plate?: string; countryCode?: string }> = ({ plate, countryCode }) => {
  if (!plate || plate.trim() === '') {
    return (
      <div className="inline-flex items-center h-10 bg-black/5 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 rounded-xl px-4 text-xs font-semibold text-light-text-secondary/40 dark:text-dark-text-secondary/40 select-none  tracking-widest">
        No Plate Set
      </div>
    );
  }
  
  const displayCountry = (countryCode || 'EU').toUpperCase().trim().slice(0, 3);
  
  return (
    <div className="inline-flex items-center bg-[#FDFDFD] border border-slate-950 dark:border-slate-800 rounded-md overflow-hidden shadow-md font-mono text-slate-900 select-none h-11 px-0.5 relative shrink-0" style={{ minWidth: '160px' }}>
      {/* EU Blue strip on left */}
      <div className="w-6 h-full bg-[#003399] flex flex-col items-center justify-between py-1 text-white shrink-0">
        <div className="text-2xs text-yellow-300 leading-none font-bold origin-center select-none scale-75">
          ★
        </div>
        <span className="text-2xs font-bold leading-none tracking-tighter">{displayCountry}</span>
      </div>
      
      {/* Plate characters */}
      <div className="px-3 flex-grow flex items-center justify-center font-bold tracking-widest text-sm md:text-base text-[#141414] drop-shadow-[0.5px_0.5px_0px_rgba(255,255,255,0.8)] leading-none">
        {plate}
      </div>
      
      {/* Small sticker decals */}
      <div className="flex flex-col gap-0.5 mr-1.5 shrink-0 select-none">
        <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-600/30 flex items-center justify-center text-2xs font-bold text-amber-950 leading-none shadow-sm scale-75">
          26
        </div>
      </div>
    </div>
  );
};

