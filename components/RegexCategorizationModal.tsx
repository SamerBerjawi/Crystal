import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Category, RegexCategorizationRule } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, BTN_DANGER_STYLE, INPUT_BASE_STYLE, SELECT_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, CHECKBOX_STYLE } from '../constants';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { motion } from 'motion/react';

interface RegexCategorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RegexCategorizationRule[];
  onSaveRules: (rules: RegexCategorizationRule[]) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  transactions: any[];
  onApplyHistoricalRules: () => void;
}

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
  <>
    {categories.map(parentCat => (
      <optgroup key={parentCat.id} label={parentCat.name}>
        <option value={parentCat.name}>{parentCat.name}</option>
        {parentCat.subCategories.map(subCat => (
          <option key={subCat.id} value={subCat.name}>
            &nbsp;&nbsp;{subCat.name}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);

export const RegexCategorizationModal: React.FC<RegexCategorizationModalProps> = ({
  isOpen,
  onClose,
  rules,
  onSaveRules,
  incomeCategories,
  expenseCategories,
  transactions,
  onApplyHistoricalRules,
}) => {
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState(expenseCategories[0]?.name || '');
  const [description, setDescription] = useState('');
  
  // Custom drag and drop sorting state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Calculate matching transactions for each rule
  const ruleMatchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rules.forEach(rule => {
      let count = 0;
      try {
        const regex = new RegExp(rule.pattern, 'i');
        transactions.forEach(tx => {
          const textToMatch = [tx.merchant || '', tx.description || '', tx.notes || ''].join(' ').trim();
          if (regex.test(textToMatch)) {
            count++;
          }
        });
      } catch (e) {
        // block errors gracefully
      }
      counts[rule.id] = count;
    });
    return counts;
  }, [rules, transactions]);

  // Drag and drop event handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Perform dynamic swap
    const reorderedRules = [...rules];
    const itemToMove = reorderedRules.splice(draggedIndex, 1)[0];
    reorderedRules.splice(index, 0, itemToMove);
    setDraggedIndex(index);
    onSaveRules(reorderedRules);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) {
      toast.error('The rule pattern cannot be empty.');
      return;
    }
    
    // Validate if the regex is syntactically sound
    try {
      new RegExp(pattern);
    } catch (err: any) {
      toast.error(`Invalid RegExp syntax: ${err.message}`);
      return;
    }

    const newRule: RegexCategorizationRule = {
      id: `regex-${uuidv4()}`,
      pattern: pattern.trim(),
      category,
      isActive: true,
      description: description.trim() || undefined,
    };

    onSaveRules([...rules, newRule]);
    setPattern('');
    setDescription('');
    toast.success('Successfully added regex categorization rule!');
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    onSaveRules(updated);
    toast.success('Regex rule deleted.');
  };

  const handleToggleRule = (id: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    onSaveRules(updated);
    toast.success('Protocol state updated.');
  };

  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";

  return (
    <Modal onClose={onClose} title="Advanced Regex Categorization Protocols" size="2xl">
      <div className="space-y-6">
        <div>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mb-4">
            Create expression patterns to re-route incoming transaction telemetry to custom categorization schemas. Rules are processed in sequential order of creation, matching the merchant name, description, or notes attributes.
          </p>
        </div>

        {/* Create Rule Form with standard merchant-form ID */}
        <form id="merchant-form" onSubmit={handleAddRule} className="bg-black/[0.02] dark:bg-white/[0.02] rounded-3xl p-5 border border-black/5 dark:border-white/5 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-light-text dark:text-dark-text flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-primary-500">add_moderator</span>
            Deploy New Matching Protocol
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelStyle}>RegEx Pattern</label>
              <input
                type="text"
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                placeholder="e.g. ^UBER.*TRIP$ or NETFLIX"
                className={INPUT_BASE_STYLE}
                autoFocus
              />
            </div>

            <div>
              <label className={labelStyle}>Route To Category</label>
              <div className={SELECT_WRAPPER_STYLE}>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={SELECT_STYLE}
                >
                  <optgroup label="Expense Categories">
                    <CategoryOptions categories={expenseCategories} />
                  </optgroup>
                  <optgroup label="Income Categories">
                    <CategoryOptions categories={incomeCategories} />
                  </optgroup>
                </select>
                <div className={SELECT_ARROW_STYLE}>
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className={labelStyle}>Rule Description / Notes</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Internal reference for this classification rule..."
              className={INPUT_BASE_STYLE}
            />
          </div>

          <div className="flex justify-end">
            <button type="submit" className={`${BTN_PRIMARY_STYLE} !py-2 !px-6 text-[10px]`}>
              Deploy Rule
            </button>
          </div>
        </form>

        {/* Existing Rules List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-light-text dark:text-dark-text opacity-75">
              Deployed Protocols ({rules.length})
            </h4>
            {rules.length > 0 && (
              <button
                type="button"
                onClick={onApplyHistoricalRules}
                className="text-[10px] font-black text-primary-500 hover:text-primary-600 uppercase tracking-wider flex items-center gap-1"
                title="Reparse existing transaction histories against these classifications"
              >
                <span className="material-symbols-outlined text-sm">history_toggle_off</span>
                Reparse History
              </button>
            )}
          </div>

          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 bg-black/[0.01] dark:bg-white/[0.01] rounded-2xl border border-dashed border-black/5 dark:border-white/5">
              <span className="material-symbols-outlined text-2xl opacity-25 mb-2">schema</span>
              <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60">
                Zero active regex categorization rules.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[250px] overflow-y-auto pr-1">
              <div className="space-y-3">
                {rules.map((rule, idx) => {
                  const matchCount = ruleMatchCounts[rule.id] || 0;
                  const matchPercent = transactions.length > 0 ? (matchCount / transactions.length) * 100 : 0;
                  const isDragging = draggedIndex === idx;

                  return (
                    <div 
                      key={rule.id} 
                      className={`py-3 px-3 flex items-center justify-between gap-4 group rounded-2xl transition-all duration-150 border border-transparent ${isDragging ? 'opacity-30 bg-primary-500/5' : 'hover:bg-black/[0.02] hover:dark:bg-white/[0.02]'} cursor-grab active:cursor-grabbing`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="material-symbols-outlined text-base text-gray-400 select-none group-hover:text-primary-500 shrink-0">
                          drag_indicator
                        </span>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded text-primary-600 dark:text-primary-400">
                              {rule.pattern}
                            </span>
                            <span className="material-symbols-outlined text-[10px] opacity-40">arrow_forward</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                              {rule.category}
                            </span>
                          </div>
                          {rule.description && (
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1 italic">
                              {rule.description}
                            </p>
                          )}
                          
                          {/* Mini-bar visualization showing counts of transactions */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-20 bg-black/10 dark:bg-white/10 rounded-full h-1 overflow-hidden shrink-0">
                              <div 
                                className="bg-primary-500 h-full rounded-full transition-all duration-300" 
                                style={{ width: `${Math.min(100, matchPercent)}%` }} 
                              />
                            </div>
                            <span className="text-[8.5px] font-mono leading-none text-light-text-secondary dark:text-dark-text-secondary opacity-80">
                              {matchCount} matched ({Math.round(matchPercent)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id)}
                          title="Toggle active state of rule"
                          className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none flex items-center ${rule.isActive ? 'bg-primary-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'}`}
                        >
                          <motion.div 
                            layout 
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="w-4 h-4 bg-white rounded-full shadow-sm"
                          />
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default RegexCategorizationModal;

