// around line 577
{Object.entries(assetGroups as Record<string, AssetGroup>).map(([name, group]) => {
                                      if (group.value === 0) return null;
                                      return (
                                        <div key={name} className="group">
                                            <div className="flex justify-between text-sm mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: group.color }}>
                                                        <span className="material-symbols-outlined text-[14px]">{group.icon}</span>
                                                    </div>
                                                    <span className="font-medium text-gray-700 dark:text-gray-200">{name}</span>
                                                </div>
                                                <span className="font-mono font-medium text-gray-900 dark:text-white privacy-blur">{formatCurrency(group.value, 'EUR')}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${(group.value / globalTotalAssets) * 100}%`, backgroundColor: group.color }}></div>
                                            </div>
                                            <p className="text-[10px] text-right text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {((group.value / globalTotalAssets) * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                      );
                                  })}
                                  {globalTotalAssets === 0 && <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">No assets found.</p>}
                              </div>
                          </div>

                          <div>
                              <h4 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-4">Liabilities Breakdown</h4>
                              <div className="space-y-4">
                                  {Object.entries(liabilityGroups as Record<string, AssetGroup>).map(([name, group]) => {
                                      if (group.value === 0) return null;
                                      return (
                                          <div key={name} className="group">
                                              <div className="flex justify-between text-sm mb-1.5">
                                                   <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: group.color }}>
                                                            <span className="material-symbols-outlined text-[14px]">{group.icon}</span>
                                                        </div>
                                                        <span className="font-medium text-gray-700 dark:text-gray-200">{name}</span>
                                                    </div>
                                                  <span className="font-mono font-medium text-gray-900 dark:text-white privacy-blur">{formatCurrency(group.value, 'EUR')}</span>
                                              </div>
                                              <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                                  <div className="h-full rounded-full" style={{ width: `${(group.value / Math.abs(globalTotalDebt)) * 100}%`, backgroundColor: group.color }}></div>
                                              </div>
                                              <p className="text-[10px] text-right text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  {((group.value / Math.abs(globalTotalDebt)) * 100).toFixed(1)}%
                                              </p>
                                          </div>
                                      );
                                  })}
                                  {globalTotalDebt === 0 && (
                                      <div className="p-4 text-center text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                          No liabilities recorded.
                                      </div>
                                  )}
                              </div>
                          </div>