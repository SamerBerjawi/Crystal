
import React, { useState, useMemo } from 'react';
import { Page, Tag, Transaction } from '../types';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, SELECT_STYLE } from '../constants';
import Card from '../components/Card';
import TagModal from '../components/TagModal';
import { convertToEur, formatCurrency, parseDateAsUTC } from '../utils';
import ConfirmationModal from '../components/ConfirmationModal';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/PageHeader';

interface TagsProps {
  tags: Tag[];
  transactions: Transaction[];
  saveTag: (tag: Omit<Tag, 'id'> & { id?: string }) => void;
  deleteTag: (tagId: string) => void;
  setCurrentPage: (page: Page) => void;
  onNavigateToTransactions: (filters?: { tagId?: string | null }) => void;
}

type SortOption = 'name' | 'count' | 'amount';
type ViewMode = 'grid' | 'list';

const Tags: React.FC<TagsProps> = ({ tags, transactions, saveTag, deleteTag, setCurrentPage, onNavigateToTransactions }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('count');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // 1. Process Data: Aggregate stats and history for every tag
  const enrichedTags = useMemo(() => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    // Helper to create buckets for the sparkline
    const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    // Initialize map
    const stats = new Map<string, { 
        count: number; 
        netAmount: number; 
        history: Record<string, number>;
    }>();

    tags.forEach(tag => {
        stats.set(tag.id, { count: 0, netAmount: 0, history: {} });
    });

    let totalTaggedTransactions = 0;

    transactions.forEach(tx => {
        if (tx.tagIds && tx.tagIds.length > 0) {
            const amount = convertToEur(tx.amount, tx.currency);
            const date = parseDateAsUTC(tx.date);
            const monthKey = getMonthKey(date);
            
            totalTaggedTransactions++;

            tx.tagIds.forEach(tagId => {
                const tagStat = stats.get(tagId);
                if (tagStat) {
                    tagStat.count++;
                    tagStat.netAmount += amount;
                    
                    // Only track history for last 6 months for the sparkline
                    if (date >= sixMonthsAgo) {
                        tagStat.history[monthKey] = (tagStat.history[monthKey] || 0) + Math.abs(amount);
                    }
                }
            });
        }
    });

    // Format data for rendering
    return tags.map(tag => {
        const stat = stats.get(tag.id)!;
        
        // Convert history object to array for Recharts
        const sparklineData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(today.getMonth() - i);
            const key = getMonthKey(d);
            sparklineData.push({ value: stat.history[key] || 0 });
        }

        return {
            ...tag,
            count: stat.count,
            netAmount: stat.netAmount,
            sparklineData
        };
    }).sort((a, b) => {
        if (sortBy === 'amount') return Math.abs(b.netAmount) - Math.abs(a.netAmount);
        if (sortBy === 'count') return b.count - a.count;
        return a.name.localeCompare(b.name);
    });

  }, [tags, transactions, sortBy]);

  // 2. Global Metrics
  const metrics = useMemo(() => {
      const totalTags = tags.length;
      const totalTaggedTx = enrichedTags.reduce((sum, t) => sum + t.count, 0);
      const uniqueTaggedTxCount = new Set(transactions.filter(t => t.tagIds && t.tagIds.length > 0).map(t => t.id)).size;
      const utilization = transactions.length > 0 ? (uniqueTaggedTxCount / transactions.length) * 100 : 0;
      
      const topTag = enrichedTags.length > 0 ? enrichedTags.reduce((prev, current) => (prev.count > current.count) ? prev : current) : null;

      return { totalTags, utilization, topTag };
  }, [enrichedTags, transactions, tags.length]);

  // 3. Filter based on search
  const displayedTags = useMemo(() => {
      return enrichedTags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [enrichedTags, searchTerm]);

  const handleOpenModal = (tag?: Tag) => {
    setEditingTag(tag || null);
    setIsModalOpen(true);
  };

  const handleTagClick = (tagId: string) => {
    onNavigateToTransactions({ tagId });
  };

  const handleDeleteConfirm = () => {
    if (deletingTagId) {
      deleteTag(deletingTagId);
      setDeletingTagId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in-up">
      {isModalOpen && (
        <TagModal 
          onClose={() => setIsModalOpen(false)}
          onSave={saveTag}
          tagToEdit={editingTag}
        />
      )}
      {deletingTagId && (
        <ConfirmationModal
          isOpen={!!deletingTagId}
          onClose={() => setDeletingTagId(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Tag"
          message="Are you sure you want to delete this tag? It will be removed from all associated transactions."
          confirmButtonText="Delete"
        />
      )}
      
      {/* Header Section */}
      <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
          <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
          <span>/</span>
          <span>Tags</span>
      </div>
      <PageHeader
        markerIcon="label"
        markerLabel="Context Chips"
        title="Tags"
        subtitle="Lightweight labels to cluster transactions, projects, or trips without changing categories."
        actions={
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setCurrentPage('Settings')}
              className="px-4 py-2 rounded-lg border border-black/5 dark:border-white/10 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text hover:dark:text-dark-text"
            >
              Back to Settings
            </button>
            <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>
                <span className="material-symbols-outlined text-xl mr-2">add</span>
                Create Tag
            </button>
          </div>
        }
      />

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="flex items-center justify-between p-5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none relative overflow-hidden">
              <div className="relative z-10">
                  <p className="text-xs font-bold uppercase opacity-80 tracking-wider">Total Tags</p>
                  <p className="text-3xl font-extrabold mt-1">{metrics.totalTags}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm relative z-10">
                  <span className="material-symbols-outlined text-2xl">label</span>
              </div>
              <div className="absolute -right-4 -bottom-8 text-white opacity-10">
                   <span className="material-symbols-outlined text-9xl">sell</span>
              </div>
          </Card>
          
          <Card className="flex items-center justify-between p-5">
               <div>
                  <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Tag Utilization</p>
                  <div className="flex items-end gap-2 mt-1">
                      <p className="text-3xl font-extrabold text-light-text dark:text-dark-text">{metrics.utilization.toFixed(0)}%</p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1.5">of all transactions</p>
                  </div>
              </div>
               <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">percent</span>
              </div>
          </Card>

          <Card className="flex items-center justify-between p-5">
               <div>
                  <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">Most Used</p>
                  <p className="text-xl font-bold text-light-text dark:text-dark-text mt-1 truncate max-w-[150px]">
                      {metrics.topTag ? metrics.topTag.name : '—'}
                  </p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      {metrics.topTag ? `${metrics.topTag.count} transactions` : 'No data'}
                  </p>
              </div>
               <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">hotel_class</span>
              </div>
          </Card>
      </div>

      {/* Controls Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-light-card dark:bg-dark-card p-4 rounded-xl shadow-sm border border-black/5 dark:border-white/5">
          <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">search</span>
              <input 
                type="text" 
                placeholder="Search tags..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${INPUT_BASE_STYLE} pl-10`}
              />
          </div>
          
          <div className="flex gap-3">
               <div className={`${SELECT_WRAPPER_STYLE} !w-auto`}>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className={`${SELECT_STYLE} pr-8`}
                  >
                      <option value="count">Most Used</option>
                      <option value="amount">Highest Value</option>
                      <option value="name">Name (A-Z)</option>
                  </select>
                  <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
               </div>
               
               <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg shadow-inner">
                   <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-dark-card shadow text-primary-500' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                   >
                       <span className="material-symbols-outlined text-xl">grid_view</span>
                   </button>
                   <button 
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-dark-card shadow text-primary-500' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                   >
                       <span className="material-symbols-outlined text-xl">view_list</span>
                   </button>
               </div>
          </div>
      </div>

      {/* Tags Content */}
      {displayedTags.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedTags.map(tag => (
                    <div 
                        key={tag.id} 
                        onClick={() => handleTagClick(tag.id)}
                        className="group bg-light-card dark:bg-dark-card rounded-2xl p-5 shadow-card border border-black/5 dark:border-white/5 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${tag.color}15` }}>
                                    <span className="material-symbols-outlined text-2xl" style={{ color: tag.color }}>{tag.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-light-text dark:text-dark-text">{tag.name}</h3>
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">{tag.count} transactions</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(tag); }} 
                                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary"
                                >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setDeletingTagId(tag.id); }} 
                                    className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        </div>
                        
                        {/* Sparkline Area */}
                        <div className="h-16 w-full -ml-2 mb-2">
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={tag.sparklineData}>
                                    <defs>
                                        <linearGradient id={`grad-${tag.id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={tag.color} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={tag.color} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke={tag.color} 
                                        strokeWidth={2} 
                                        fill={`url(#grad-${tag.id})`} 
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="flex justify-between items-end border-t border-black/5 dark:border-white/5 pt-3">
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wider">Total Volume</span>
                            <span className={`font-bold font-mono text-lg ${tag.netAmount < 0 ? 'text-light-text dark:text-dark-text' : 'text-green-600 dark:text-green-400'}`}>
                                {formatCurrency(tag.netAmount, 'EUR')}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
          ) : (
              <Card className="p-0 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-light-bg dark:bg-dark-bg border-b border-black/5 dark:border-white/5 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                              <th className="p-4 pl-6">Tag Name</th>
                              <th className="p-4 text-right">Usage</th>
                              <th className="p-4 text-right">Total Volume</th>
                              <th className="p-4 w-20"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm">
                          {displayedTags.map(tag => (
                              <tr key={tag.id} onClick={() => handleTagClick(tag.id)} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                                  <td className="p-4 pl-6">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${tag.color}20` }}>
                                              <span className="material-symbols-outlined text-lg" style={{ color: tag.color }}>{tag.icon}</span>
                                          </div>
                                          <span className="font-bold text-light-text dark:text-dark-text">{tag.name}</span>
                                      </div>
                                  </td>
                                  <td className="p-4 text-right">
                                      <span className="bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-md font-medium text-light-text dark:text-dark-text">{tag.count} txs</span>
                                  </td>
                                  <td className="p-4 text-right font-mono font-medium text-light-text dark:text-dark-text">
                                      {formatCurrency(tag.netAmount, 'EUR')}
                                  </td>
                                  <td className="p-4 text-right">
                                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={(e) => { e.stopPropagation(); handleOpenModal(tag); }} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500">
                                              <span className="material-symbols-outlined text-lg">edit</span>
                                          </button>
                                          <button onClick={(e) => { e.stopPropagation(); setDeletingTagId(tag.id); }} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500">
                                              <span className="material-symbols-outlined text-lg">delete</span>
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </Card>
          )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-gray-500">label_off</span>
            </div>
            <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-2">No Tags Found</h3>
            <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-sm mx-auto mb-6">
                {searchTerm ? `No tags match "${searchTerm}".` : "Create tags to organize your transactions with custom labels like #vacation or #project-x."}
            </p>
            {!searchTerm && (
                <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>
                    Create First Tag
                </button>
            )}
        </div>
      )}
    </div>
  );
};

export default Tags;
