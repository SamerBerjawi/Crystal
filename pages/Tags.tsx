import React, { useState, useMemo } from 'react';
import { Page, Tag, Transaction } from '../types';
import { BTN_PRIMARY_STYLE } from '../constants';
import Card from '../components/Card';
import TagModal from '../components/TagModal';
import { convertToEur, formatCurrency } from '../utils';
import ConfirmationModal from '../components/ConfirmationModal';

interface TagsProps {
  tags: Tag[];
  transactions: Transaction[];
  saveTag: (tag: Omit<Tag, 'id'> & { id?: string }) => void;
  deleteTag: (tagId: string) => void;
  setCurrentPage: (page: Page) => void;
  setTagFilter: (tagId: string | null) => void;
}

const Tags: React.FC<TagsProps> = ({ tags, transactions, saveTag, deleteTag, setCurrentPage, setTagFilter }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  const tagStats = useMemo(() => {
    const stats = new Map<string, { count: number; netAmount: number }>();
    for (const tx of transactions) {
      tx.tagIds?.forEach(tagId => {
        const stat = stats.get(tagId) || { count: 0, netAmount: 0 };
        stat.count++;
        stat.netAmount += convertToEur(tx.amount, tx.currency);
        stats.set(tagId, stat);
      });
    }
    return stats;
  }, [transactions]);

  const handleOpenModal = (tag?: Tag) => {
    setEditingTag(tag || null);
    setIsModalOpen(true);
  };

  const handleTagClick = (tagId: string) => {
    setTagFilter(tagId);
    setCurrentPage('Transactions');
  };

  const handleDeleteConfirm = () => {
    if (deletingTagId) {
      deleteTag(deletingTagId);
      setDeletingTagId(null);
    }
  };

  return (
    <div className="space-y-8">
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
      <header className="flex justify-between items-center">
        <div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Group transactions with custom tags for better analysis.</p>
        </div>
        <button onClick={() => handleOpenModal()} className={BTN_PRIMARY_STYLE}>
          Add Tag
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tags.map(tag => {
          const stats = tagStats.get(tag.id) || { count: 0, netAmount: 0 };
          return (
            <Card key={tag.id} className="p-0 flex flex-col group cursor-pointer" onClick={() => handleTagClick(tag.id)}>
              <div className="p-6 flex-grow">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${tag.color}20`}}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: tag.color }}>
                      {tag.icon}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={(e) => { e.stopPropagation(); handleOpenModal(tag); }} className="p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined text-base">edit</span></button>
                     <button onClick={(e) => { e.stopPropagation(); setDeletingTagId(tag.id); }} className="p-2 rounded-full text-red-500/80 hover:bg-red-500/10"><span className="material-symbols-outlined text-base">delete</span></button>
                  </div>
                </div>
                <h3 className="text-xl font-semibold mt-4">{tag.name}</h3>
              </div>
              <div className="bg-light-bg dark:bg-dark-bg/50 px-6 py-4 rounded-b-xl border-t border-black/5 dark:border-white/10 flex justify-between text-sm">
                <div>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">Transactions</p>
                  <p className="font-semibold">{stats.count}</p>
                </div>
                <div className="text-right">
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">Net Amount</p>
                  <p className="font-semibold">{formatCurrency(stats.netAmount, 'EUR')}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {tags.length === 0 && (
         <Card>
            <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
              <span className="material-symbols-outlined text-5xl mb-2">label_off</span>
              <p className="font-semibold">No tags created yet.</p>
              <p className="text-sm">Click "Add Tag" to get started.</p>
            </div>
         </Card>
      )}
    </div>
  );
};

export default Tags;