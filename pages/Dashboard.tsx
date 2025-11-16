import React, { useMemo, useState, useCallback, useEffect } from 'react';
// FIX: Import 'RecurringTransaction' to resolve 'Cannot find name' error.
import { User, Transaction, Account, Category, Duration, CategorySpending, Widget, WidgetConfig, DisplayTransaction, FinancialGoal, RecurringTransaction, BillPayment, Tag, Budget } from '../types';
import { formatCurrency, getDateRange, calculateAccountTotals, convertToEur, calculateStatementPeriods, generateBalanceForecast, parseDateAsUTC, getCreditCardStatementDetails } from '../utils';
import AddTransactionModal from '../components/AddTransactionModal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, LIQUID_ACCOUNT_TYPES, ASSET_TYPES, DEBT_TYPES, ACCOUNT_TYPE_STYLES, INVESTMENT_SUB_TYPE_STYLES } from '../constants';
import TransactionDetailModal from '../components/TransactionDetailModal';
import WidgetWrapper from '../components/WidgetWrapper';
import OutflowsChart from '../components/OutflowsChart';
import DurationFilter from '../components/DurationFilter';
import BalanceCard from '../components/BalanceCard';
import NetBalanceCard from '../components/SpendingChart';
import NetWorthChart from '../components/NetWorthChart';
import AssetDebtDonutChart from '../components/AssetDebtDonutChart';
import TransactionList from '../components/TransactionList';
import MultiAccountFilter from '../components/MultiAccountFilter';
import CurrentBalanceCard from '../components/CurrentBalanceCard';
import useLocalStorage from '../hooks/useLocalStorage';
import AddWidgetModal from '../components/AddWidgetModal';
import { useTransactionMatcher } from '../hooks/useTransactionMatcher';
import TransactionMatcherModal from '../components/TransactionMatcherModal';
import Card from '../components/Card';
import CreditCardStatementCard from '../components/CreditCardStatementCard';
import LowestBalanceForecastCard from '../components/LowestBalanceForecastCard';
import BudgetOverviewWidget from '../components/BudgetOverviewWidget';
import AccountBreakdownCard from '../components/AccountBreakdownCard';


interface DashboardProps {
  user: User;
  transactions: Transaction[];
  accounts: Account[];
  saveTransaction: (transactions: (Omit<Transaction, 'id'> & { id?: string })[], idsToDelete?: string[]) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  financialGoals: FinancialGoal[];
  recurringTransactions: RecurringTransaction[];
  billsAndPayments: BillPayment[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  duration: Duration;
  setDuration: (duration: Duration) => void;
  tags: Tag[];
  budgets: Budget[];
}

const findCategoryDetails = (name: string, categories: Category[]): Category | undefined => {
  for (const cat of categories) {
    if (cat.name === name) return cat;
    if (cat.subCategories.length > 0) {
      const found = findCategoryDetails(name, cat.subCategories);
      if (found) return found;
    }
  }
  return undefined;
};

const findCategoryById = (id: string, categories: Category[]): Category | undefined => {
    for (const cat of categories) {
        if (cat.id === id) return cat;
        if (cat.subCategories?.length) {
            const found = findCategoryById(id, cat.subCategories);
            if (found) return found;
        }
    }
    return undefined;
}

const toYYYYMMDD = (date: Date) => {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const Dashboard: React.FC<DashboardProps> = ({ user, transactions, accounts, saveTransaction, incomeCategories, expenseCategories, financialGoals, recurringTransactions, billsAndPayments, selectedAccountIds, setSelectedAccountIds, duration, setDuration, tags, budgets }) => {
  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [modalTransactions, setModalTransactions] = useState<Transaction[]>([]);
  const [modalTitle, setModalTitle] = useState('');

  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMatcherModalOpen, setIsMatcherModalOpen] = useState(false);

  const { suggestions, confirmMatch, dismissSuggestion, confirmAllMatches, dismissAllSuggestions } = useTransactionMatcher(transactions, accounts, saveTransaction);

  const allCategories = useMemo(() => [...incomeCategories, ...expenseCategories], [incomeCategories, expenseCategories]);

  const selectedAccounts = useMemo(() => 
      accounts.filter(a => selectedAccountIds.includes(a.id)),
  [accounts, selectedAccountIds]);

  const handleOpenTransactionModal = (tx?: Transaction) => {
    setEditingTransaction(tx || null);
    setTransactionModalOpen(true);
  };
  
  const handleCloseTransactionModal = () => {
    setEditingTransaction(null);
    setTransactionModalOpen(false);
  };

  const handleTransactionClick = useCallback((clickedTx: DisplayTransaction) => {
    if (clickedTx.isTransfer && clickedTx.transferId) {
        const pair = transactions.filter(t => t.transferId === clickedTx.transferId);
        setModalTransactions(pair);
        setModalTitle('Transfer Details');
    } else {
        const originalTx = transactions.find(t => t.id === clickedTx.id);
        if (originalTx) {
            setModalTransactions([originalTx]);
            setModalTitle('Transaction Details');
        }
    }
    setDetailModalOpen(true);
  }, [transactions]);

  const { filteredTransactions, income, expenses } = useMemo(() => {
    const { start, end } = getDateRange(duration, transactions);
    const txsInPeriod = transactions.filter(tx => {
        const txDate = parseDateAsUTC(tx.date);
        return txDate >= start && txDate <= end;
    });

    const processedTransferIds = new Set<string>();
    let calculatedIncome = 0;
    let calculatedExpenses = 0;

    txsInPeriod.forEach(tx => {
        if (!selectedAccountIds.includes(tx.accountId)) {
            return; // Skip transactions not in selected accounts for calculation.
        }

        const convertedAmount = convertToEur(tx.amount, tx.currency);

        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) return;

            const counterpart = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
            processedTransferIds.add(tx.transferId);

            if (counterpart) {
                const counterpartSelected = selectedAccountIds.includes(counterpart.accountId);
                
                // If counterpart is NOT selected, this is a real in/outflow for the selected group.
                if (!counterpartSelected) {
                    if (tx.type === 'income') {
                        calculatedIncome += convertedAmount;
                    } else {
                        calculatedExpenses += Math.abs(convertedAmount);
                    }
                }
            } else { // Orphaned transfer part, treat as regular transaction.
                if (tx.type === 'income') calculatedIncome += convertedAmount;
                else calculatedExpenses += Math.abs(convertedAmount);
            }
        } else { // Regular transaction.
            if (tx.type === 'income') calculatedIncome += convertedAmount;
            else calculatedExpenses += Math.abs(convertedAmount);
        }
    });

    return { 
        filteredTransactions: txsInPeriod.filter(tx => selectedAccountIds.includes(tx.accountId)),
        income: calculatedIncome,
        expenses: calculatedExpenses,
    };
  }, [transactions, duration, selectedAccountIds]);

  const { incomeChange, expenseChange } = useMemo(() => {
    const { start, end } = getDateRange(duration, transactions);
    const diff = end.getTime() - start.getTime();

    if (duration === 'ALL' || diff <= 0) {
      return { incomeChange: null, expenseChange: null };
    }

    const prevStart = new Date(start.getTime() - diff);
    const prevEnd = new Date(start.getTime() - 1);

    const txsInPrevPeriod = transactions.filter(tx => {
      const txDate = parseDateAsUTC(tx.date);
      return txDate >= prevStart && txDate <= prevEnd;
    });

    let prevIncome = 0;
    let prevExpenses = 0;

    const processedTransferIds = new Set<string>();
    txsInPrevPeriod.forEach(tx => {
      if (!selectedAccountIds.includes(tx.accountId)) return;

      const convertedAmount = convertToEur(tx.amount, tx.currency);

      if (tx.transferId) {
        if (processedTransferIds.has(tx.transferId)) return;
        const counterpart = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
        processedTransferIds.add(tx.transferId);
        if (counterpart && !selectedAccountIds.includes(counterpart.accountId)) {
          if (tx.type === 'income') prevIncome += convertedAmount;
          else prevExpenses += Math.abs(convertedAmount);
        }
      } else {
        if (tx.type === 'income') prevIncome += convertedAmount;
        else prevExpenses += Math.abs(convertedAmount);
      }
    });

    const calculateChangeString = (current: number, previous: number) => {
      if (previous === 0) {
        return null;
      }
      const change = ((current - previous) / previous) * 100;
      if (isNaN(change) || !isFinite(change)) return null;

      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    return {
      incomeChange: calculateChangeString(income, prevIncome),
      expenseChange: calculateChangeString(expenses, prevExpenses),
    };
  }, [duration, transactions, selectedAccountIds, income, expenses]);

  const outflowsByCategory: CategorySpending[] = useMemo(() => {
    const spending: { [key: string]: CategorySpending } = {};
    const expenseCats = expenseCategories;
    const processedTransferIds = new Set<string>();

    filteredTransactions.forEach(tx => {
        if (tx.type !== 'expense') return;
        
        const convertedAmount = convertToEur(tx.amount, tx.currency);

        if (tx.transferId) {
            if (processedTransferIds.has(tx.transferId)) return;
            
            const counterpart = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
            processedTransferIds.add(tx.transferId);
            
            // This is an outflow only if its counterpart is NOT selected.
            if (counterpart && !selectedAccountIds.includes(counterpart.accountId)) {
                const name = 'Transfers Out';
                if (!spending[name]) {
                    spending[name] = { name, value: 0, color: '#A0AEC0', icon: 'arrow_upward' };
                }
                spending[name].value += Math.abs(convertedAmount);
            }
        } else {
            const category = findCategoryDetails(tx.category, expenseCats);
            let parentCategory = category;
            if (category?.parentId) {
                parentCategory = findCategoryById(category.parentId, expenseCats) || category;
            }
            const name = parentCategory?.name || 'Uncategorized';
            if (!spending[name]) {
                spending[name] = { name, value: 0, color: parentCategory?.color || '#A0AEC0', icon: parentCategory?.icon };
            }
            spending[name].value += Math.abs(convertedAmount);
        }
    });

    return Object.values(spending).sort((a, b) => b.value - a.value);
  }, [filteredTransactions, selectedAccountIds, transactions, expenseCategories]);
  
  const handleCategoryClick = useCallback((categoryName: string) => {
    const expenseCats = expenseCategories;
    const txs = filteredTransactions.filter(tx => {
        if (categoryName === 'Transfers Out') {
            if (!tx.transferId || tx.type !== 'expense') return false;
            const counterpart = transactions.find(t => t.transferId === tx.transferId && t.id !== tx.id);
            return counterpart && !selectedAccountIds.includes(counterpart.accountId);
        }
        
        const category = findCategoryDetails(tx.category, expenseCats);
        let parentCategory = category;
        if(category?.parentId){
            parentCategory = findCategoryById(category.parentId, expenseCats) || category;
        }
        return parentCategory?.name === categoryName && tx.type === 'expense' && !tx.transferId;
    });
    setModalTransactions(txs);
    setModalTitle(`Transactions for ${categoryName}`);
    setDetailModalOpen(true);
  }, [filteredTransactions, transactions, selectedAccountIds, expenseCategories]);
  
  const accountMap = useMemo(() => accounts.reduce((map, acc) => { map[acc.id] = acc.name; return map; }, {} as Record<string, string>), [accounts]);

  const recentTransactions = useMemo(() => {
    const sortedSourceTransactions = transactions
      .filter(tx => selectedAccountIds.includes(tx.accountId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
    const processedTransferIds = new Set<string>();
    const result: DisplayTransaction[] = [];
  
    const fullTransactionsList = [...transactions];
  
    for (const tx of sortedSourceTransactions) {
      if (result.length >= 5) break;
  
      if (tx.transferId) {
        if (processedTransferIds.has(tx.transferId)) continue;
  
        const pair = fullTransactionsList.find(t => t.transferId === tx.transferId && t.id !== tx.id);
        processedTransferIds.add(tx.transferId);
  
        if (pair) {
          const expensePart = tx.amount < 0 ? tx : pair;
          const incomePart = tx.amount > 0 ? tx : pair;
          result.push({
            ...expensePart,
            id: `transfer-${expensePart.transferId}`,
            originalId: expensePart.id,
            amount: Math.abs(expensePart.amount),
            isTransfer: true,
            type: 'expense', // for consistency
            fromAccountName: accountMap[expensePart.accountId] || 'Unknown',
            toAccountName: accountMap[incomePart.accountId] || 'Unknown',
            category: 'Transfer',
          });
        } else { // Orphaned transfer
          result.push({ ...tx, accountName: accountMap[tx.accountId] });
        }
      } else { // Regular transaction
        result.push({ ...tx, accountName: accountMap[tx.accountId] });
      }
    }
    return result.slice(0, 5);
  }, [transactions, selectedAccountIds, accountMap]);
  
  const { incomeSparkline, expenseSparkline } = useMemo(() => {
    const NUM_POINTS = 30;
    const { start, end } = getDateRange(duration, transactions);
    const timeRange = end.getTime() - start.getTime();
    const interval = timeRange / NUM_POINTS;

    const incomeBuckets = Array(NUM_POINTS).fill(0);
    const expenseBuckets = Array(NUM_POINTS).fill(0);

    const relevantTxs = filteredTransactions.filter(tx => !tx.transferId);

    for (const tx of relevantTxs) {
        const txTime = parseDateAsUTC(tx.date).getTime();
        const index = Math.floor((txTime - start.getTime()) / interval);
        const convertedAmount = convertToEur(tx.amount, tx.currency);
        if (index >= 0 && index < NUM_POINTS) {
            if (tx.type === 'income') {
                incomeBuckets[index] += convertedAmount;
            } else {
                expenseBuckets[index] += Math.abs(convertedAmount);
            }
        }
    }
    
    return {
        incomeSparkline: incomeBuckets.map(value => ({ value })),
        expenseSparkline: expenseBuckets.map(value => ({ value }))
    };

  }, [filteredTransactions, duration, transactions]);


  const { totalAssets, totalDebt, netWorth, assetBreakdown, debtBreakdown } = useMemo(() => {
    const safeAccounts = selectedAccounts || [];
    
    const { totalAssets, totalDebt, netWorth } = calculateAccountTotals(safeAccounts);

    const colorClassToHex: { [key: string]: string } = {
        'text-blue-500': '#3b82f6',
        'text-green-500': '#22c55e',
        'text-orange-500': '#f97316',
        'text-purple-500': '#8b5cf6',
        'text-red-500': '#ef4444',
        'text-teal-500': '#14b8a6',
        'text-yellow-500': '#eab308',
        'text-cyan-500': '#06b6d4',
        'text-lime-500': '#84cc16',
        'text-pink-500': '#ec4899',
        'text-amber-500': '#f59e0b',
        'text-indigo-500': '#6366f1',
        'text-lime-600': '#65a30d',
        'text-slate-500': '#64748b'
    };

    const createBreakdown = (accs: Account[]) => {
        const grouped = accs.reduce((acc, account) => {
            const group = acc[account.type] || { value: 0, color: '#A0AEC0' };
            let style;
            if(account.type === 'Investment' && account.subType) {
                style = INVESTMENT_SUB_TYPE_STYLES[account.subType];
            } else {
                style = ACCOUNT_TYPE_STYLES[account.type];
            }
            
            if (style) {
                 group.color = colorClassToHex[style.color] || '#A0AEC0';
            }
            group.value += convertToEur(account.balance, account.currency);
            acc[account.type] = group;
            return acc;
        }, {} as Record<string, { value: number, color: string }>);
        
        return Object.entries(grouped).map(([name, data]) => ({ name, value: Math.abs(data.value), color: data.color })).filter(item => item.value > 0);
    };

    return {
        totalAssets,
        totalDebt,
        netWorth,
        assetBreakdown: createBreakdown(safeAccounts.filter(acc => ASSET_TYPES.includes(acc.type))),
        debtBreakdown: createBreakdown(safeAccounts.filter(acc => DEBT_TYPES.includes(acc.type))),
    };
  }, [selectedAccounts]);

  const netWorthData = useMemo(() => {
    const { start, end } = getDateRange(duration, transactions);
    const currentNetWorth = netWorth;
    const today = parseDateAsUTC(new Date().toISOString().split('T')[0]);

    // Reverse transactions from start date up to now to find starting balance
    const transactionsToReverse = transactions.filter(tx => {
        if (!selectedAccountIds.includes(tx.accountId)) return false;
        const txDate = parseDateAsUTC(tx.date);
        return txDate >= start && txDate <= today;
    });

    const totalChangeSinceStart = transactionsToReverse.reduce((sum, tx) => {
        return sum + convertToEur(tx.amount, tx.currency);
    }, 0);

    const startingNetWorth = currentNetWorth - totalChangeSinceStart;

    // Now, get all transactions within the chart's display period (start to end)
    const transactionsInPeriod = transactions.filter(tx => {
        if (!selectedAccountIds.includes(tx.accountId)) return false;
        const txDate = parseDateAsUTC(tx.date);
        return txDate >= start && txDate <= end;
    });

    const dailyChanges = new Map<string, number>();
    for (const tx of transactionsInPeriod) {
        const dateStr = tx.date;
        const change = convertToEur(tx.amount, tx.currency);
        dailyChanges.set(dateStr, (dailyChanges.get(dateStr) || 0) + change);
    }
    
    const data: { name: string, value: number }[] = [];
    let runningBalance = startingNetWorth;
    
    let currentDate = new Date(start);

    while (currentDate <= end) {
        const dateStr = toYYYYMMDD(currentDate);
        runningBalance += dailyChanges.get(dateStr) || 0;
        data.push({ name: dateStr, value: parseFloat(runningBalance.toFixed(2)) });
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    // After the loop, the last value should be very close to currentNetWorth.
    // Let's ensure it is exactly currentNetWorth to avoid floating point inaccuracies if today is in range.
    const todayStr = toYYYYMMDD(today);
    const todayDataPoint = data.find(d => d.name === todayStr);
    if (todayDataPoint) {
      todayDataPoint.value = parseFloat(currentNetWorth.toFixed(2));
    }


    return data;
  }, [duration, transactions, selectedAccountIds, netWorth]);

  const netWorthTrendColor = useMemo(() => {
    if (netWorthData.length < 2) return '#6366F1';
    const startValue = netWorthData[0].value;
    const endValue = netWorthData[netWorthData.length - 1].value;
    return endValue >= startValue ? '#34C759' : '#FF3B30';
  }, [netWorthData]);
  
  const configuredCreditCards = useMemo(() => {
    return accounts.filter(acc => acc.type === 'Credit Card' && acc.statementStartDate && acc.paymentDate && selectedAccountIds.includes(acc.id));
  }, [accounts, selectedAccountIds]);

  const creditCardStatements = useMemo(() => {
      if (configuredCreditCards.length === 0) return [];
      
      return configuredCreditCards.map(account => {
          const periods = calculateStatementPeriods(account.statementStartDate!, account.paymentDate!);

          const { statementBalance: currentBalance, amountPaid: currentAmountPaid } = getCreditCardStatementDetails(account, periods.current.start, periods.current.end, transactions);
          const { statementBalance: futureBalance, amountPaid: futureAmountPaid } = getCreditCardStatementDetails(account, periods.future.start, periods.future.end, transactions);
          
          const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
          const formatFullDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

          return {
              accountName: account.name,
              currency: account.currency,
              accountBalance: account.balance,
              creditLimit: account.creditLimit,
              current: {
                  balance: currentBalance,
                  amountPaid: currentAmountPaid,
                  period: `${formatDate(periods.current.start)} - ${formatDate(periods.current.end)}`,
                  paymentDue: formatFullDate(periods.current.paymentDue)
              },
              future: {
                  balance: futureBalance,
                  amountPaid: futureAmountPaid,
                  period: `${formatDate(periods.future.start)} - ${formatDate(periods.future.end)}`,
                  paymentDue: formatFullDate(periods.future.paymentDue)
              }
          };
      });
  }, [configuredCreditCards, transactions]);

    const lowestBalanceForecasts = useMemo(() => {
        const forecastEndDate = new Date();
        forecastEndDate.setFullYear(forecastEndDate.getFullYear() + 1, forecastEndDate.getMonth() + 1, 0);

        // FIX: Access the .chartData property from the returned object of generateBalanceForecast.
        const forecastData = generateBalanceForecast(selectedAccounts, recurringTransactions, financialGoals, billsAndPayments, forecastEndDate).chartData;
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const getInitialBalance = () => {
            return selectedAccounts
                .filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type))
                .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
        };

        if (forecastData.length === 0) {
            const initialBalance = getInitialBalance();
            const todayStr = new Date().toISOString().split('T')[0];
            const periods = ['This Month', 'Next 3 Months', 'Next 6 Months', 'Next Year'];
            return periods.map(period => ({
                period,
                lowestBalance: initialBalance,
                date: todayStr,
            }));
        }

        const findNthLowestUniquePoint = (
            data: { date: string; value: number }[],
            n: number,
            excludeValues: number[] = []
        ): { value: number; date: string } | null => {
            if (data.length === 0) return null;

            const uniqueSortedValues = [...new Set(data.map(p => p.value))]
                .filter(v => !excludeValues.includes(v))
                .sort((a, b) => a - b);

            const targetIndex = n - 1;

            if (targetIndex >= uniqueSortedValues.length) {
                const fallbackPoint = data.find(p => !excludeValues.includes(p.value)) 
                                   || data.reduce((min, p) => (p.value < min.value ? p : min), data[0]);
                return fallbackPoint;
            }
    
            const nthLowestValue = uniqueSortedValues[targetIndex];
            const point = data.find(p => p.value === nthLowestValue);
            return point ? { value: point.value, date: point.date } : null;
        };
    
        const periods = [
            { 
                label: 'This Month', 
                startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
                endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
            },
            { 
                label: 'Next 3 Months', 
                startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)),
                endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 0))
            },
            { 
                label: 'Next 6 Months', 
                startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 1)),
                endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 6, 0))
            },
            { 
                label: 'Next Year', 
                startDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 6, 1)),
                endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 12, 0))
            },
        ];
        
        const results: { period: string; lowestBalance: number; date: string }[] = [];
        const displayedValues: number[] = [];
    
        for (const period of periods) {
            // FIX: Access the .chartData property from the returned object of generateBalanceForecast.
            const dataForPeriod = forecastData.filter(d => {
                const dDate = parseDateAsUTC(d.date);
                return dDate >= period.startDate && dDate <= period.endDate;
            });
            
            let displayedPoint: { value: number; date: string } | null = null;
            let n = 1;
    
            while(true) {
                const point = findNthLowestUniquePoint(dataForPeriod, n, displayedValues);
                
                if (!point) {
                    // FIX: Access the .chartData property from the returned object of generateBalanceForecast.
                    const lastKnownBalancePoint = forecastData
                        .filter(d => parseDateAsUTC(d.date) < period.startDate)
                        .pop();
                    
                    const fallbackValue = lastKnownBalancePoint ? lastKnownBalancePoint.value : getInitialBalance();
                    const fallbackDate = lastKnownBalancePoint ? lastKnownBalancePoint.date : new Date().toISOString().split('T')[0];

                    displayedPoint = { value: fallbackValue, date: fallbackDate };
                    break;
                }

                if (!displayedValues.includes(point.value)) {
                    displayedPoint = point;
                    break;
                }
                
                n++;
    
                if (n > 20) { // Safety break
                     displayedPoint = point;
                     break;
                }
            }
            
            results.push({
                period: period.label,
                lowestBalance: displayedPoint.value,
                date: displayedPoint.date,
            });
            displayedValues.push(displayedPoint.value);
        }
        
        return results;

    }, [selectedAccounts, recurringTransactions, financialGoals, billsAndPayments, accounts]);

  const handleBudgetClick = useCallback(() => {
    // A real implementation might navigate to the budget page and filter by category
    alert("Navigate to budget page.");
  }, []);

  // --- Widget Management ---
  const allWidgets: Widget[] = useMemo(() => [
    { id: 'netWorthOverTime', name: 'Net Worth Over Time', defaultW: 4, defaultH: 2, component: NetWorthChart, props: { data: netWorthData, lineColor: netWorthTrendColor } },
    { id: 'outflowsByCategory', name: 'Outflows by Category', defaultW: 2, defaultH: 2, component: OutflowsChart, props: { data: outflowsByCategory, onCategoryClick: handleCategoryClick } },
    { id: 'netWorthBreakdown', name: 'Net Worth Breakdown', defaultW: 2, defaultH: 2, component: AssetDebtDonutChart, props: { assets: totalAssets, debt: totalDebt } },
    { id: 'recentActivity', name: 'Recent Activity', defaultW: 4, defaultH: 2, component: TransactionList, props: { transactions: recentTransactions, allCategories: allCategories, onTransactionClick: handleTransactionClick } },
    { id: 'assetBreakdown', name: 'Asset Breakdown', defaultW: 2, defaultH: 2, component: AccountBreakdownCard, props: { title: 'Assets', totalValue: totalAssets, breakdownData: assetBreakdown } },
    { id: 'liabilityBreakdown', name: 'Liability Breakdown', defaultW: 2, defaultH: 2, component: AccountBreakdownCard, props: { title: 'Liabilities', totalValue: totalDebt, breakdownData: debtBreakdown } },
    { id: 'budgetOverview', name: 'Budget Overview', defaultW: 2, defaultH: 2, component: BudgetOverviewWidget, props: { budgets: budgets, transactions: transactions, expenseCategories: expenseCategories, accounts: accounts, duration: duration, onBudgetClick: handleBudgetClick } },
  ], [netWorthData, netWorthTrendColor, outflowsByCategory, handleCategoryClick, totalAssets, totalDebt, recentTransactions, allCategories, handleTransactionClick, assetBreakdown, debtBreakdown, budgets, transactions, expenseCategories, accounts, duration, handleBudgetClick]);

  const [widgets, setWidgets] = useLocalStorage<WidgetConfig[]>('dashboard-layout', allWidgets.map(w => ({ id: w.id, title: w.name, w: w.defaultW, h: w.defaultH })));

  const removeWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  const addWidget = (widgetId: string) => {
    const widgetToAdd = allWidgets.find(w => w.id === widgetId);
    if (widgetToAdd) {
        setWidgets(prev => [...prev, { id: widgetToAdd.id, title: widgetToAdd.name, w: widgetToAdd.defaultW, h: widgetToAdd.defaultH }]);
    }
    setIsAddWidgetModalOpen(false);
  };
  
  const handleResize = (widgetId: string, dimension: 'w' | 'h', change: 1 | -1) => {
    setWidgets(prev => prev.map(w => {
      if (w.id === widgetId) {
        const newDim = w[dimension] + change;
        if (dimension === 'w' && (newDim < 1 || newDim > 4)) return w;
        if (dimension === 'h' && (newDim < 1 || newDim > 3)) return w;
        return { ...w, [dimension]: newDim };
      }
      return w;
    }));
  };

  const availableWidgetsToAdd = useMemo(() => {
    const currentWidgetIds = widgets.map(w => w.id);
    return allWidgets.filter(w => !currentWidgetIds.includes(w.id));
  }, [widgets, allWidgets]);

  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, widgetId: string) => { setDraggedWidgetId(widgetId); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragEnter = (e: React.DragEvent, widgetId: string) => { e.preventDefault(); if (widgetId !== draggedWidgetId) setDragOverWidgetId(widgetId); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOverWidgetId(null); };
  const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    if (!draggedWidgetId || draggedWidgetId === targetWidgetId) return;

    setWidgets(prevWidgets => {
        const draggedIndex = prevWidgets.findIndex(w => w.id === draggedWidgetId);
        const targetIndex = prevWidgets.findIndex(w => w.id === targetWidgetId);
        if (draggedIndex === -1 || targetIndex === -1) return prevWidgets;

        const newWidgets = [...prevWidgets];
        const [draggedItem] = newWidgets.splice(draggedIndex, 1);
        newWidgets.splice(targetIndex, 0, draggedItem);
        return newWidgets;
    });
  };
  const handleDragEnd = () => { setDraggedWidgetId(null); setDragOverWidgetId(null); };

  return (
    <div className="space-y-6">
      {isTransactionModalOpen && (
        <AddTransactionModal
          onClose={handleCloseTransactionModal}
          onSave={(data, toDelete) => { saveTransaction(data, toDelete); handleCloseTransactionModal(); }}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          transactionToEdit={editingTransaction}
          transactions={transactions}
          tags={tags}
        />
      )}
      <TransactionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={modalTitle}
        transactions={modalTransactions}
        accounts={accounts}
      />
      <AddWidgetModal isOpen={isAddWidgetModalOpen} onClose={() => setIsAddWidgetModalOpen(false)} availableWidgets={availableWidgetsToAdd} onAddWidget={addWidget} />
      {isMatcherModalOpen && (
          <TransactionMatcherModal
              isOpen={isMatcherModalOpen}
              onClose={() => setIsMatcherModalOpen(false)}
              suggestions={suggestions}
              accounts={accounts}
              onConfirmMatch={confirmMatch}
              onDismissSuggestion={dismissSuggestion}
              onConfirmAll={confirmAllMatches}
              onDismissAll={dismissAllSuggestions}
          />
      )}
      
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Welcome back, {user.firstName}!</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <MultiAccountFilter accounts={accounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds} />
          <DurationFilter selectedDuration={duration} onDurationChange={setDuration} />
          {isEditMode ? (
             <div className="flex items-center gap-2">
                <button onClick={() => setIsAddWidgetModalOpen(true)} className={`${BTN_SECONDARY_STYLE} h-10 flex items-center gap-2`}>
                    <span className="material-symbols-outlined text-base">add</span>
                    Add Widget
                </button>
                <button onClick={() => setIsEditMode(false)} className={`${BTN_PRIMARY_STYLE} h-10`}>
                    Done
                </button>
            </div>
          ) : (
            <button onClick={() => setIsEditMode(true)} className={`${BTN_SECONDARY_STYLE} h-10 flex items-center gap-2`}>
                <span className="material-symbols-outlined text-base">edit</span>
                Edit Layout
            </button>
          )}

          <button onClick={() => handleOpenTransactionModal()} className={`${BTN_PRIMARY_STYLE} h-10`}>
            Add Transaction
          </button>
        </div>
      </div>
      
      {/* New Suggestion Summary Card */}
      {suggestions.length > 0 && (
          <Card>
              <div className="flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-2xl text-primary-500">autorenew</span>
                      <div>
                          <h3 className="font-semibold text-lg">Potential Transfers Detected</h3>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              We found {suggestions.length} pair(s) of transactions that might be transfers.
                          </p>
                      </div>
                  </div>
                  <div className="flex items-center gap-4">
                      <button onClick={dismissAllSuggestions} className={BTN_SECONDARY_STYLE}>Dismiss All</button>
                      <button onClick={() => setIsMatcherModalOpen(true)} className={BTN_PRIMARY_STYLE}>Review All</button>
                  </div>
              </div>
          </Card>
      )}

      {/* Top Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <BalanceCard title="Income" amount={income} change={incomeChange} changeType="positive" sparklineData={incomeSparkline} />
        <BalanceCard title="Expenses" amount={expenses} change={expenseChange} changeType="negative" sparklineData={expenseSparkline} />
        <NetBalanceCard netBalance={income - expenses} totalIncome={income} duration={duration} />
        <CurrentBalanceCard balance={netWorth} currency="EUR" title="Net Worth" />
      </div>
      
      {/* Lowest Balance Forecast */}
      {lowestBalanceForecasts && lowestBalanceForecasts.length > 0 && (
        <div>
            <h3 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Lowest Balance Forecast</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {lowestBalanceForecasts.map(forecast => (
                    <LowestBalanceForecastCard 
                        key={forecast.period}
                        period={forecast.period}
                        lowestBalance={forecast.lowestBalance}
                        date={forecast.date}
                    />
                ))}
            </div>
        </div>
       )}

      {/* Credit Card Statements Section */}
      {creditCardStatements.length > 0 && (
          <div className="space-y-6">
              {creditCardStatements.map(statement => (
                  <div key={statement.accountName}>
                      <h3 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">{statement.accountName} Statements</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <CreditCardStatementCard
                              title="Current Statement"
                              statementBalance={statement.current.balance}
                              amountPaid={statement.current.amountPaid}
                              accountBalance={statement.accountBalance}
                              creditLimit={statement.creditLimit}
                              currency={statement.currency}
                              statementPeriod={statement.current.period}
                              paymentDueDate={statement.current.paymentDue}
                          />
                          <CreditCardStatementCard
                              title="Next Statement"
                              statementBalance={statement.future.balance}
                              amountPaid={statement.future.amountPaid}
                              accountBalance={statement.accountBalance}
                              creditLimit={statement.creditLimit}
                              currency={statement.currency}
                              statementPeriod={statement.future.period}
                              paymentDueDate={statement.future.paymentDue}
                          />
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* Customizable Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6" style={{ gridAutoRows: 'minmax(200px, auto)' }}>
        {widgets.map(widget => {
            const widgetDetails = allWidgets.find(w => w.id === widget.id);
            if (!widgetDetails) return null;
            const WidgetComponent = widgetDetails.component;

            return (
                <WidgetWrapper
                    key={widget.id}
                    title={widget.title}
                    w={widget.w}
                    h={widget.h}
                    onRemove={() => removeWidget(widget.id)}
                    onResize={(dim, change) => handleResize(widget.id, dim, change)}
                    isEditMode={isEditMode}
                    isBeingDragged={draggedWidgetId === widget.id}
                    isDragOver={dragOverWidgetId === widget.id}
                    onDragStart={e => handleDragStart(e, widget.id)}
                    onDragEnter={e => handleDragEnter(e, widget.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, widget.id)}
                    onDragEnd={handleDragEnd}
                >
                    <WidgetComponent {...widgetDetails.props as any} />
                </WidgetWrapper>
            );
        })}
      </div>
    </div>
  );
};

export default Dashboard;