
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Transaction } from '../types';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, SELECT_STYLE, PAGE_PATHS } from '../constants';
import Card from '../components/Card';
import TagModal from '../components/TagModal';
import { convertToEur, formatCurrency, parseLocalDate } from '../utils';
import ConfirmationModal from '../components/ConfirmationModal';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';

interface TagsProps {
  tags: Tag[];
  transactions: Transaction[];
  saveTag: (tag: Omit<Tag, 'id'> & { id?: string }) => void;
  deleteTag: (tagId: string) => void;
  onNavigateToTransactions: (filters?: { tagId?: string | null }) => void;
}

type SortOption = 'name' | 'count' | 'amount';
type ViewMode = 'grid' | 'list';

const Tags: React.FC<TagsProps> = ({ tags, transactions, saveTag, deleteTag, onNavigateToTransactions }) => {
  const navigate = useNavigate();
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
            const date = parseLocalDate(tx.date);
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
    <div className="max-w-6xl mx-auto pb-12 space-y-12 animate-fade-in-up px-4 text-light-text dark:text-dark-text">
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
          title="Excise Semantic Tag"
          message="Initiating removal of semantic overlay. This tag will be detached from all ledger entries. Proceed with deletion?"
          confirmButtonText="Execute Excise"
        />
      )}
      
      {/* Navigation & Header */}
      <div className="space-y-6">
        <nav className="flex items-center gap-3">
            <button 
              onClick={() => navigate(PAGE_PATHS['Settings'])} 
              className="group flex items-center gap-2 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest hover:text-primary-500 transition-colors"
            >
                <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                </div>
                <span>Back to Control Center</span>
            </button>
        </nav>
        
        <PageHeader
          markerIcon="sell"
          markerLabel="Semantic Overlays"
          title="Tags"
          subtitle="Apply multi-dimensional labels to transactions. Cluster data by project, event, or specific lifestyle markers."
          actions={
            <button onClick={() => handleOpenModal()} className="px-8 py-4 bg-primary-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                <span className="material-symbols-outlined text-xl">add_circle</span>
                Register New Tag
            </button>
          }
        />
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Inventory" value={metrics.totalTags} icon="sell" colorClass="bg-indigo-500 text-white shadow-indigo-500/20" />
          <StatCard title="Semantic Density" value={`${metrics.utilization.toFixed(0)}%`} icon="analytics" colorClass="bg-blue-500 text-white shadow-blue-500/20" />
          <StatCard title="Primary Vector" value={metrics.topTag ? metrics.topTag.name : 'None'} icon="stars" colorClass="bg-emerald-500 text-white shadow-emerald-500/20" />
      </div>

      {/* Controls Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between gap-6 px-2">
          <div className="relative flex-1 max-w-md group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-light-text-secondary/40 group-focus-within:text-primary-500 transition-colors">search_activity</span>
              <input 
                type="text" 
                placeholder="Query semantic labels..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold uppercase tracking-widest placeholder:text-light-text-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm"
              />
          </div>
          
          <div className="flex gap-4">
               <div className="bg-black/5 dark:bg-white/5 p-1 rounded-2xl flex">
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent text-[10px] font-black uppercase tracking-widest px-4 py-2 focus:outline-none cursor-pointer"
                  >
                      <option value="count">Utility Rank</option>
                      <option value="amount">Volume Rank</option>
                      <option value="name">Lexical Alpha</option>
                  </select>
               </div>
               
               <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl">
                   <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-dark-card shadow-xl text-primary-500' : 'text-light-text-secondary hover:text-primary-500'}`}
                   >
                       <span className="material-symbols-outlined text-sm">grid_view</span>
                   </button>
                   <button 
                      onClick={() => setViewMode('list')}
                      className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-dark-card shadow-xl text-primary-500' : 'text-light-text-secondary hover:text-primary-500'}`}
                   >
                       <span className="material-symbols-outlined text-sm">view_headline</span>
                   </button>
               </div>
          </div>
      </div>

      {/* Tags Content */}
      <div className="space-y-6">
        {displayedTags.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedTags.map(tag => (
                      <div 
                          key={tag.id} 
                          onClick={() => handleTagClick(tag.id)}
                          className="group bg-white dark:bg-dark-card rounded-3xl p-6 border border-black/5 dark:border-white/5 hover:border-primary-500/30 hover:shadow-2xl hover:shadow-black/5 transition-all duration-300 cursor-pointer relative overflow-hidden"
                      >
                          <div className="flex justify-between items-start mb-8">
                              <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${tag.color}10`, border: `1px solid ${tag.color}20` }}>
                                      <span className="material-symbols-outlined text-2xl" style={{ color: tag.color }}>{tag.icon}</span>
                                  </div>
                                  <div>
                                      <h3 className="font-black text-xs uppercase tracking-widest text-light-text dark:text-dark-text">{tag.name}</h3>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }}></div>
                                        <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60 uppercase">{tag.count} Nodes</p>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); handleOpenModal(tag); }} 
                                      className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-primary-500 hover:text-white text-light-text-secondary transition-all"
                                  >
                                      <span className="material-symbols-outlined text-sm">edit_square</span>
                                  </button>
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); setDeletingTagId(tag.id); }} 
                                      className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-red-500 hover:text-white text-light-text-secondary transition-all"
                                  >
                                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                                  </button>
                              </div>
                          </div>
                          
                          {/* Sparkline Area */}
                          <div className="h-20 w-full mb-6 relative">
                               <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={tag.sparklineData}>
                                      <defs>
                                          <linearGradient id={`grad-${tag.id}`} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor={tag.color} stopOpacity={0.2}/>
                                              <stop offset="95%" stopColor={tag.color} stopOpacity={0}/>
                                          </linearGradient>
                                      </defs>
                                      <Area 
                                          type="monotone" 
                                          dataKey="value" 
                                          stroke={tag.color} 
                                          strokeWidth={3} 
                                          fill={`url(#grad-${tag.id})`} 
                                          isAnimationActive={true}
                                      />
                                  </AreaChart>
                              </ResponsiveContainer>
                          </div>
                          
                          <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 px-4 py-3 rounded-2xl">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">Cumulative Volume</span>
                              <span className="font-mono font-black text-sm text-light-text dark:text-dark-text">
                                  {formatCurrency(tag.netAmount, 'EUR')}
                              </span>
                          </div>
                      </div>
                  ))}
              </div>
            ) : (
                <div className="bg-white dark:bg-dark-card rounded-3xl border border-black/5 dark:border-white/5 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
                                <th className="px-8 py-5 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em]">Semantic Label</th>
                                <th className="px-8 py-5 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em] text-right">Node Density</th>
                                <th className="px-8 py-5 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-[0.2em] text-right">Total Aggregate</th>
                                <th className="px-8 py-5 w-24"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {displayedTags.map(tag => (
                                <tr key={tag.id} onClick={() => handleTagClick(tag.id)} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${tag.color}15` }}>
                                                <span className="material-symbols-outlined text-lg" style={{ color: tag.color }}>{tag.icon}</span>
                                            </div>
                                            <span className="text-[11px] font-black uppercase underline decoration-2 underline-offset-4 decoration-transparent group-hover:decoration-primary-500/30 transition-all">{tag.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <span className="text-[10px] font-bold opacity-60 uppercase">{tag.count} Entries</span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <span className="font-mono font-black text-xs">{formatCurrency(tag.netAmount, 'EUR')}</span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(tag); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/5 dark:bg-white/5 hover:bg-primary-500 hover:text-white transition-all text-light-text-secondary">
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setDeletingTagId(tag.id); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/5 dark:bg-white/5 hover:bg-red-500 hover:text-white transition-all text-light-text-secondary">
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
        ) : (
          <div className="flex flex-col items-center justify-center py-32 bg-white/50 dark:bg-dark-card/30 rounded-3xl border border-dashed border-black/5 dark:border-white/5">
              <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl opacity-20">label_off</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-light-text-secondary dark:text-dark-text-secondary opacity-40">Semantic Inventory Clear</p>
              {!searchTerm && (
                  <button onClick={() => handleOpenModal()} className="mt-8 px-8 py-4 bg-primary-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all">
                      Initialize Semantic Chip
                  </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tags;
