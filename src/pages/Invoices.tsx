
// ... (Imports)

// ...

const InvoicesPage: React.FC<InvoicesProps> = () => {
    // ... (State and hooks)

    return (
        <div className="space-y-8 pb-12 animate-fade-in-up">
            {/* ... (Editor and Modals) ... */}

            {/* ... (Header) ... */}
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">description</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Total Documents</p>
                        <p className="text-2xl font-bold">{stats.count}</p>
                    </div>
                 </Card>
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">payments</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Total Value</p>
                        <p className="text-2xl font-bold privacy-blur">{formatCurrency(stats.totalAmount, preferences.currency.split(' ')[0] as Currency)}</p>
                    </div>
                 </Card>
                 <Card className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">pending</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Pending / Outstanding</p>
                        <p className="text-2xl font-bold privacy-blur">{formatCurrency(stats.pendingAmount, preferences.currency.split(' ')[0] as Currency)}</p>
                    </div>
                 </Card>
            </div>

            {/* List */}
            <Card className="p-0 overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        {/* ... (Table Head) ... */}
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {filteredList.map(item => (
                                <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handleOpenEditor(item)}>
                                    <td className="px-6 py-4 font-mono font-medium">{item.number}</td>
                                    {/* ... */}
                                    <td className="px-6 py-4 font-semibold">{item.entityName}</td>
                                    <td className="px-6 py-4 text-light-text-secondary dark:text-dark-text-secondary">{parseDateAsUTC(item.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-light-text-secondary dark:text-dark-text-secondary">{item.dueDate ? parseDateAsUTC(item.dueDate).toLocaleDateString() : '—'}</td>
                                    <td className="px-6 py-4 text-right font-bold font-mono privacy-blur">{formatCurrency(item.total, item.currency)}</td>
                                    {/* ... */}
                                </tr>
                            ))}
                            {/* ... */}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default InvoicesPage;
