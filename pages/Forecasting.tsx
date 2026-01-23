
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <MetricCard 
                    title="Projected End Balance" 
                    value={formatCurrency(endBalance, 'EUR')} 
                    subValue={forecastDuration === '1Y' ? 'In 1 Year' : `At end of ${forecastDuration}`}
                    icon="flag"
                    colorClass="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30"
                />
                <MetricCard 
                    title="Net Change" 
                    value={`${netChange >= 0 ? '+' : ''}${formatCurrency(netChange, 'EUR')}`}
                    subValue="Over selected period"
                    icon="trending_up"
                    trend={netChange >= 0 ? 'up' : 'down'}
                    colorClass={netChange >= 0 ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30" : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"}
                />
                 {varianceMetric !== null ? (
                    <MetricCard 
                        title="Performance vs Baseline" 
                        value={`${varianceMetric >= 0 ? '+' : ''}${formatCurrency(varianceMetric, 'EUR')}`}
                        subValue="Variance today"
                        icon="difference"
                        trend={varianceMetric >= 0 ? 'up' : 'down'}
                        colorClass={varianceMetric >= 0 ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30" : "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30"}
                    />
                ) : (
                    <MetricCard 
                        title="Performance" 
                        value="—"
                        subValue="Set baseline to track"
                        icon="difference"
                        colorClass="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/10"
                    />
                )}
                <MetricCard 
                    title="Total Goal Progress" 
                    value={`${goalProgress.toFixed(0)}%`} 
                    subValue={`${formatCurrency(totalGoalSaved, 'EUR')} of ${formatCurrency(totalGoalTarget, 'EUR')}`}
                    icon="track_changes"
                    colorClass="text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30"
                />
                <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Safety Margin</span>
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-opacity-20 transition-transform duration-300 group-hover:scale-110 ${lowestPoint.value < 0 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600 dark:text-orange-400'}`}>
                            <span className="material-symbols-outlined text-xl">shield</span>
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className={`text-2xl font-extrabold tracking-tight ${lowestPoint.value < 0 ? 'text-red-600' : 'text-light-text dark:text-dark-text'}`}>
                            {hasForecastData ? formatCurrency(lowestPoint.value, 'EUR') : '—'}
                        </p>
                        <p className="text-xs font-medium mt-1 opacity-80">
                            {hasForecastData ? `Lowest on ${parseLocalDate(lowestPoint.date).toLocaleDateString()}` : 'No forecast data yet'}
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Forecast Horizon */}
            <ForecastOverview forecasts={lowestBalanceForecasts} currency="EUR" />
