
import React, { useMemo } from 'react';
import { Account, MileageLog } from '../types';
import { formatCurrency, parseDateAsUTC } from '../utils';
import Card from './Card';
import VehicleMileageChart from './VehicleMileageChart';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, ACCOUNT_TYPE_STYLES } from '../constants';

interface VehicleAccountViewProps {
  account: Account;
  onAddTransaction: () => void;
  onAddLog: () => void;
  onEditLog: (log: MileageLog) => void;
  onDeleteLog: (id: string) => void;
  onBack: () => void;
}

const VehicleAccountView: React.FC<VehicleAccountViewProps> = ({
  account,
  onAddTransaction,
  onAddLog,
  onEditLog,
  onDeleteLog,
  onBack
}) => {
  const isLeased = account.ownership === 'Leased';
  
  const currentMileage = useMemo(() => {
    if (!account.mileageLogs || account.mileageLogs.length === 0) return 0;
    return Math.max(...account.mileageLogs.map(l => l.reading));
  }, [account.mileageLogs]);

  const leaseStats = useMemo(() => {
    if (account.ownership !== 'Leased' || !account.leaseStartDate || !account.leaseEndDate) return null;
    const start = parseDateAsUTC(account.leaseStartDate);
    const end = parseDateAsUTC(account.leaseEndDate);
    const now = new Date();
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    
    let mileageStatus: 'Over Budget' | 'Under Budget' | 'On Track' = 'On Track';
    let mileageDiff = 0;
    let projectedMileage = 0;
    let totalAllowance = 0;
    
    if (account.annualMileageAllowance) {
        const dailyAllowance = account.annualMileageAllowance / 365;
        const expectedMileage = elapsedDays * dailyAllowance;
        const years = totalDays / 365;
        totalAllowance = account.annualMileageAllowance * years;

        mileageDiff = currentMileage - expectedMileage;
        projectedMileage = elapsedDays > 0 ? (currentMileage / elapsedDays) * totalDays : 0;
        
        if (mileageDiff > 1000) mileageStatus = 'Over Budget';
        else if (mileageDiff < -1000) mileageStatus = 'Under Budget';
    }
    
    return { start, end, progress, mileageStatus, mileageDiff, daysRemaining: Math.max(0, Math.ceil(totalDays - elapsedDays)), projectedMileage, totalAllowance };
  }, [account, currentMileage]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full">
          <button onClick={onBack} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-4 w-full">
            {account.imageUrl ? (
              <img src={account.imageUrl} alt="Vehicle" className="w-16 h-16 rounded-xl object-cover border border-black/10 dark:border-white/10" />
            ) : (
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ACCOUNT_TYPE_STYLES['Vehicle'].color} bg-current/10 border border-current/20`}>
                <span className="material-symbols-outlined text-4xl">directions_car</span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{account.name}</h1>
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span>{account.year} {account.make} {account.model}</span>
                {account.licensePlate && <><span>•</span><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">{account.licensePlate}</span></>}
              </div>
            </div>
            <div className="ml-auto">
              <button onClick={onAddTransaction} className={BTN_PRIMARY_STYLE}>Add Transaction</button>
            </div>
          </div>
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {isLeased && leaseStats ? (
            <Card>
              <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Lease Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Days Remaining</p><p className="text-2xl font-bold">{leaseStats.daysRemaining}</p></div>
                <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Mileage Balance</p><p className={`text-2xl font-bold ${leaseStats.mileageDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>{leaseStats.mileageDiff > 0 ? '+' : ''}{Math.round(leaseStats.mileageDiff).toLocaleString()} km</p></div>
                <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Projected End</p><p className="text-2xl font-bold">{Math.round(leaseStats.projectedMileage).toLocaleString()} km</p></div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>Time Elapsed</span><span>{Math.round(leaseStats.progress)}%</span></div>
                  <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2"><div className="bg-primary-500 h-2 rounded-full" style={{ width: `${leaseStats.progress}%` }}></div></div>
                </div>
                {account.annualMileageAllowance && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Mileage Usage ({currentMileage.toLocaleString()} / {leaseStats.totalAllowance.toLocaleString()})</span>
                      <span className={leaseStats.mileageStatus === 'Over Budget' ? 'text-red-500 font-bold' : 'text-green-500'}>{leaseStats.mileageStatus}</span>
                    </div>
                    <div className="w-full bg-light-fill dark:bg-dark-fill rounded-full h-2 relative">
                      {/* Expected mileage marker */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-black dark:bg-white z-10" style={{ left: `${Math.min((leaseStats.progress), 100)}%` }} title="Expected Usage"></div>
                      <div className={`h-2 rounded-full ${leaseStats.mileageStatus === 'Over Budget' ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min((currentMileage / leaseStats.totalAllowance) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <h3 className="text-base font-semibold text-light-text dark:text-dark-text mb-4">Overview</h3>
              <div className="grid grid-cols-2 gap-6">
                <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Current Value</p><p className="text-2xl font-bold">{formatCurrency(account.balance, account.currency)}</p></div>
                <div><p className="text-xs uppercase text-light-text-secondary dark:text-dark-text-secondary font-semibold mb-1">Odometer</p><p className="text-2xl font-bold">{currentMileage.toLocaleString()} km</p></div>
              </div>
            </Card>
          )}
          <VehicleMileageChart logs={account.mileageLogs || []} />
        </div>
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-light-text dark:text-dark-text">Log History</h3>
              <button onClick={onAddLog} className={`${BTN_SECONDARY_STYLE} !py-1 !px-2 text-xs`}>Add Log</button>
            </div>
            <div className="flex-grow overflow-y-auto max-h-[400px]">
              {account.mileageLogs && account.mileageLogs.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/5 text-light-text-secondary dark:text-dark-text-secondary">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-right py-2 font-medium">Mileage</th>
                      <th className="text-right py-2 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {[...account.mileageLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                      <tr key={log.id} className="group hover:bg-black/5 dark:hover:bg-white/5">
                        <td className="py-2">{parseDateAsUTC(log.date).toLocaleDateString()}</td>
                        <td className="py-2 text-right font-mono">{log.reading.toLocaleString()}</td>
                        <td className="py-2 text-right">
                          <div className="opacity-0 group-hover:opacity-100 flex justify-end gap-1">
                            <button onClick={() => onEditLog(log)} className="p-1 text-light-text-secondary hover:text-primary-500"><span className="material-symbols-outlined text-sm">edit</span></button>
                            <button onClick={() => onDeleteLog(log.id)} className="p-1 text-light-text-secondary hover:text-red-500"><span className="material-symbols-outlined text-sm">delete</span></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-light-text-secondary text-sm py-8">No mileage logs recorded.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VehicleAccountView;
