
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Account, RecurringTransaction } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import Card from '../components/Card';
import { formatCurrency } from '../utils';
import { getPredictiveCashFlow, getAIConfig } from '../src/services/geminiService';
import PageHeader from '../components/PageHeader';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { RefreshCw, AlertTriangle, TrendingDown, TrendingUp, Calendar, Bot } from 'lucide-react';

interface PredictiveCashFlowProps {
  transactions: Transaction[];
  accounts: Account[];
  recurringTransactions: RecurringTransaction[];
}

interface ForecastResult {
  forecast: { date: string, balance: number, type: 'actual' | 'predicted' }[];
  anomalies: { date: string, description: string, amount: number, riskLevel: 'low' | 'medium' | 'high' }[];
  runwayDays: number;
  shortfallDetected: boolean;
  nextMajorExpense: { date: string, description: string, amount: number } | null;
  insight: string;
  updatedAt?: string;
}

const PredictiveCashFlow: React.FC<PredictiveCashFlowProps> = ({
  transactions,
  accounts,
  recurringTransactions
}) => {
  const [forecast, setForecast] = useState<ForecastResult | null>(() => {
    const cached = localStorage.getItem('crystal_cashflow_forecast');
    return cached ? JSON.parse(cached) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiConfig = getAIConfig();
  const isAIEnabled = aiConfig.enabled !== false;

  const fetchData = async (force = false) => {
    if (!isAIEnabled || isLoading) return;
    if (forecast && !force) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await getPredictiveCashFlow({
        transactions,
        accounts,
        recurring: recurringTransactions
      });
      if (result) {
        const dataWithTime = { ...result, updatedAt: new Date().toISOString() };
        setForecast(dataWithTime);
        localStorage.setItem('crystal_cashflow_forecast', JSON.stringify(dataWithTime));
      }
    } catch (err: any) {
      console.error("Forecasting Error:", err);
      setError(err.message || "Failed to generate predictive cash flow.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!forecast) {
      fetchData();
    }
  }, []);

  const chartData = useMemo(() => {
    if (!forecast?.forecast) return [];
    return forecast.forecast;
  }, [forecast]);

  const currentBalance = useMemo(() => {
    return accounts.reduce((sum, a) => sum + a.balance, 0);
  }, [accounts]);

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      <PageHeader 
        markerIcon="timeline"
        markerLabel="AI Foresight"
        title="Predictive Cash Flow" 
        subtitle="AI-driven balance forecasting based on recurring bills, upcoming expenses, and historical spending patterns."
        actions={
          isAIEnabled && (
            <button 
              onClick={() => fetchData(true)}
              disabled={isLoading}
              className={`${BTN_SECONDARY_STYLE} flex items-center gap-2`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Recalculate Forecast
            </button>
          )
        }
      />

      {!isAIEnabled && (
          <div className="bg-gray-50 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 rounded-3xl p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                      <Bot className="w-10 h-10 text-gray-300 dark:text-gray-700" />
                  </div>
                  <div className="max-w-md">
                      <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-2">Predictive Cash Flow Disabled</h3>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6">
                          Enable AI features in settings to unlock deep cash flow forecasting and anomaly detection.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {isAIEnabled && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Main Forecast Chart */}
          <Card className="p-6 h-[400px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-light-text dark:text-dark-text">30-Day Projected Balance</h3>
              {forecast?.updatedAt && (
                <span className="text-xs text-gray-400">Last updated {new Date(forecast.updatedAt).toLocaleString()}</span>
              )}
            </div>
            
            {isLoading ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-4 animate-pulse">
                <div className="w-full h-48 bg-gray-100 dark:bg-white/5 rounded-2xl"></div>
                <p className="text-sm text-gray-500">Crystal AI is calculating your future cash flow...</p>
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis 
                      dataKey="date" 
                      tick={{fontSize: 10}} 
                      tickFormatter={(str) => {
                        const date = new Date(str);
                        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis 
                      tick={{fontSize: 10}} 
                      tickFormatter={(val) => `€${val}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '12px', color: '#fff' }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      formatter={(val: number) => [formatCurrency(val, 'EUR'), 'Balance']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorBalance)" 
                      animationDuration={1500}
                    />
                    <ReferenceLine y={currentBalance} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Today', position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-2xl">
                <p className="text-gray-500">Run the forecast to see your future balance.</p>
              </div>
            )}
          </Card>

          {/* Anomaly Detection */}
          <div className="space-y-4">
             <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-lg text-light-text dark:text-dark-text">Potential Shortfalls & Anomalies</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forecast?.anomalies && forecast.anomalies.length > 0 ? (
                  forecast.anomalies.map((anomaly, i) => (
                    <Card key={i} className="flex items-center gap-4 border-l-4 border-l-amber-500">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-sm truncate">{anomaly.description}</p>
                          <span className="text-[10px] font-black uppercase text-amber-500">{anomaly.riskLevel} Risk</span>
                        </div>
                        <p className="text-xs text-gray-500">{new Date(anomaly.date).toLocaleDateString()}</p>
                        <p className="text-sm font-black mt-1">{formatCurrency(anomaly.amount, 'EUR')}</p>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="col-span-full py-8 text-center border-dashed">
                    <p className="text-gray-500">Crystal AI hasn't detected any major anomalies for the next 30 days.</p>
                  </Card>
                )}
             </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="bg-indigo-600 text-white border-0 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Calendar className="w-20 h-20" />
             </div>
             <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Financial Runway</p>
                <div className="text-4xl font-black mb-1">{forecast?.runwayDays || '—'} Days</div>
                <p className="text-[10px] opacity-80 leading-relaxed">Based on current cash and projected burn rate.</p>
             </div>
          </Card>

          <Card className={`${forecast?.shortfallDetected ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'} border-0 shadow-lg`}>
             <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Status</p>
             <div className="text-xl font-bold flex items-center gap-2">
                {forecast?.shortfallDetected ? (
                  <>
                    <AlertTriangle className="w-5 h-5" />
                    Shortfall Ahead
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Cash Flow Positive
                  </>
                )}
             </div>
          </Card>

          <Card className="bg-primary-500/5 dark:bg-primary-500/10 border-primary-500/20">
             <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary-500">auto_awesome</span>
                <h4 className="font-bold text-sm">AI Insight</h4>
             </div>
             <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed italic">
                "{forecast?.insight || 'Connect your bank accounts and refresh the forecast to get AI insights.'}"
             </p>
          </Card>

          {forecast?.nextMajorExpense && (
            <Card>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Next Major Hit</p>
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-rose-500">account_balance_wallet</span>
                 </div>
                 <div>
                    <p className="text-sm font-bold truncate">{forecast.nextMajorExpense.description}</p>
                    <p className="text-lg font-black">{formatCurrency(forecast.nextMajorExpense.amount, 'EUR')}</p>
                    <p className="text-[10px] text-gray-500">{new Date(forecast.nextMajorExpense.date).toLocaleDateString()}</p>
                 </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    )}
  </div>
);
};

export default PredictiveCashFlow;
