import { getMainCurrency } from '../utils';
import React, { useMemo, useState } from 'react';
import { Page, Tag, Transaction } from '../types';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import TagModal from '../components/TagModal';
import { Button, IconButton } from '../components/ui/Actions';
import { Sparkline } from '../components/ui/Display';
import { TextInput } from '../components/ui/Fields';
import Icon from '../components/ui/Icon';
import { Menu } from '../components/ui/Menu';
import { Amount } from '../components/ui/Money';
import { ConfirmDialog } from '../components/ui/Overlays';
import { Select } from '../components/ui/Pickers';
import { EmptyState } from '../components/ui/States';
import { sortTags, summariseTags, TagSort, taggedShare } from '../utils/tagsModel';

interface TagsProps {
  tags: Tag[];
  transactions: Transaction[];
  saveTag: (tag: Omit<Tag, 'id'> & { id?: string }) => void;
  deleteTag: (tagId: string) => void;
  setCurrentPage: (page: Page) => void;
  onNavigateToTransactions: (filters?: { tagId?: string | null }) => void;
}

const SORT_OPTIONS = [
  { id: 'count', label: 'Most used' },
  { id: 'amount', label: 'Largest total' },
  { id: 'name', label: 'Name' },
];

const Tags: React.FC<TagsProps> = ({ tags, transactions, saveTag, deleteTag, setCurrentPage, onNavigateToTransactions }) => {
  const [editing, setEditing] = useState<{ tag: Tag | null } | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TagSort>('count');

  const summaries = useMemo(() => summariseTags(tags, transactions), [tags, transactions]);
  const visible = useMemo(() => sortTags(summaries.filter(tag => tag.name.toLowerCase().includes(search.toLowerCase())), sort), [search, sort, summaries]);

  return (
    <div className="space-y-6">
      <SettingsSubpageHeader
        title="Tags"
        setCurrentPage={setCurrentPage}
        stats={[
          { label: 'Tags', icon: 'tag-01', value: tags.length },
          { label: 'Transactions tagged', icon: 'pie-chart-01', value: taggedShare(transactions), format: 'percent' },
        ]}
        actions={<Button icon="add-01" onPress={() => setEditing({ tag: null })}>New tag</Button>}
      />

      {editing && <TagModal onClose={() => setEditing(null)} onSave={saveTag} tagToEdit={editing.tag} />}
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteTag(deleting.id); setDeleting(null); }}
        title={`Delete ${deleting?.name ?? 'this tag'}?`}
        message="It comes off every transaction that has it."
        confirmLabel="Delete tag"
        isDestructive
      />

      <div className="flex flex-wrap items-end gap-3">
        <TextInput label="Find a tag" className="min-w-0 flex-1 basis-56" value={search} onChange={setSearch} />
        <Select label="Sort by" className="w-full md:w-48" options={SORT_OPTIONS} value={sort} onChange={id => setSort(id as TagSort)} />
      </div>

      {visible.length > 0 ? (
        <ul className="surface-card min-w-0 divide-y divide-line rounded-[var(--radius-xl)] px-4 py-1">
          {visible.map(tag => (
            <li key={tag.id} className="flex min-h-16 items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToTransactions({ tagId: tag.id })}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]" style={{ backgroundColor: `${tag.color}26`, color: tag.color }}>
                  <Icon name={tag.icon} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-body block truncate text-ink">{tag.name}</span>
                  <span className="type-caption block text-muted">{tag.count} {tag.count === 1 ? 'transaction' : 'transactions'}</span>
                </span>
                <Sparkline data={tag.history} isPositive={tag.netAmount >= 0} className="hidden md:block" />
                <Amount value={tag.netAmount} currency={getMainCurrency()} className="type-figure-row shrink-0 text-ink" />
              </button>
              <Menu
                title={tag.name}
                trigger={<IconButton icon="more-horizontal" label={`More for ${tag.name}`} />}
                items={[
                  { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => setEditing({ tag }) },
                  { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setDeleting(tag) },
                ]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="tag-01"
          title={search ? 'No tags match' : 'No tags yet'}
          description={search ? 'Try another word.' : 'Tags group transactions across categories and accounts.'}
          actionLabel={search ? undefined : 'New tag'}
          onAction={() => setEditing({ tag: null })}
        />
      )}
    </div>
  );
};

export default Tags;
