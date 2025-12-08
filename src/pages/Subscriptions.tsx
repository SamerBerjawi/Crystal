            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none relative overflow-hidden p-6">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Monthly Cost</p>
                        <p className="text-3xl font-extrabold mt-1 privacy-blur">{formatCurrency(monthlySpend, 'EUR')}</p>
                        <p className="text-sm opacity-80 mt-2 privacy-blur">≈ {formatCurrency(yearlySpend, 'EUR')} / year</p>
                    </div>
                    <div className="absolute -right-4 -bottom-8 text-white opacity-10">
                        <span className="material-symbols-outlined text-9xl">calendar_month</span>
                    </div>
                </Card>
                
                 <Card className="flex flex-col justify-center p-6">
                    <div className="flex justify-between items-center">
                        <div>
                             <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Active Subscriptions</p>
                             <p className="text-3xl font-extrabold text-light-text dark:text-dark-text">{subscriptionCount}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">check_circle</span>
                        </div>
                    </div>
                </Card>

                <Card className="flex flex-col justify-center p-6">
                    <div className="flex justify-between items-center">
                        <div>
                             <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">Detected Opportunities</p>
                             <p className="text-3xl font-extrabold text-light-text dark:text-dark-text">{detectedSubscriptions.length}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center animate-pulse">
                            <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Detected Subscriptions Section */}
            {detectedSubscriptions.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-yellow-500">auto_awesome</span>
                        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Detected for You</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {detectedSubscriptions.map(sub => (
                            <div key={sub.key} className="bg-white dark:bg-dark-card border-2 border-yellow-400/30 dark:border-yellow-500/20 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-light-text dark:text-dark-text truncate">{sub.merchant}</h3>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Detected {sub.frequency} payment</p>
                                    </div>
                                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                                        {sub.confidence} Confidence
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-2xl font-bold text-light-text dark:text-dark-text privacy-blur">{formatCurrency(sub.amount, sub.currency)}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Avg. based on {sub.occurrences} txs</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleIgnore(sub.key)} className={`${BTN_SECONDARY_STYLE} !px-3 !py-1.5 text-xs`}>Ignore</button>
                                        <button onClick={() => handleTrack(sub)} className={`${BTN_PRIMARY_STYLE} !px-3 !py-1.5 text-xs`}>Track</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active List */}
            <Card>
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text mb-6">Your Subscriptions</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider border-b border-black/5 dark:border-white/5">
                                <th className="pb-4 pl-2">Service</th>
                                <th className="pb-4">Cost</th>
                                <th className="pb-4">Frequency</th>
                                <th className="pb-4">Next Due</th>
                                <th className="pb-4 text-right pr-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm">
                            {activeSubscriptions.map(sub => {
                                const nextDueDate = parseDateAsUTC(sub.nextDueDate);
                                const daysUntil = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                const isDueSoon = daysUntil >= 0 && daysUntil <= 3;

                                return (
                                    <tr key={sub.id} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                        <td className="py-4 pl-2 font-semibold text-light-text dark:text-dark-text">{sub.description}</td>
                                        <td className="py-4 font-mono font-medium privacy-blur">{formatCurrency(sub.amount, sub.currency)}</td>
                                        <td className="py-4 capitalize">
                                            <span className="bg-gray-100 dark:bg-white/10 px-2 py-1 rounded text-xs font-medium text-light-text dark:text-dark-text">
                                                {sub.frequency}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            <span className={isDueSoon ? 'text-orange-500 font-bold' : 'text-light-text-secondary dark:text-dark-text-secondary'}>
                                                {nextDueDate.toLocaleDateString()} 
                                                {isDueSoon && <span className="text-xs ml-2 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">Due Soon</span>}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right pr-2">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditActive(sub)} className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500 transition-colors">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                <button onClick={() => handleDeleteActive(sub.id)} className="p-1.5 text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors">
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {activeSubscriptions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                        No subscriptions tracked yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>