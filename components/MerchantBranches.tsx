import React, { useState } from 'react';
import { MerchantLocation } from '../types';
import { AddressData } from '../hooks/useAddressSearch';
import { branchName, googleMapsUrl, hasCoordinates, removeBranch } from '../utils/merchantModel';
import AddressAutocomplete from './AddressAutocomplete';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import { TextInput } from './ui/Fields';
import { Menu } from './ui/Menu';

interface BranchEditorProps {
  branch: MerchantLocation;
  onChange: (change: Partial<MerchantLocation>) => void;
  onDone: () => void;
}

const coordinate = (text: string) => {
  const value = parseFloat(text);
  return Number.isFinite(value) ? value : undefined;
};

const BranchEditor: React.FC<BranchEditorProps> = ({ branch, onChange, onDone }) => (
  <div className="mt-2 space-y-3 rounded-[var(--radius-lg)] bg-inset p-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <TextInput label="Name" value={branch.label || ''} onChange={label => onChange({ label })} placeholder="Zaventem" />
      <TextInput label="City" value={branch.city || ''} onChange={city => onChange({ city })} />
      <TextInput label="Country" value={branch.country || ''} onChange={country => onChange({ country })} />
      <TextInput label="Postal code" value={branch.postalCode || ''} onChange={postalCode => onChange({ postalCode })} />
      <TextInput label="Latitude" inputMode="decimal" value={branch.latitude?.toString() ?? ''} onChange={text => onChange({ latitude: coordinate(text) })} />
      <TextInput label="Longitude" inputMode="decimal" value={branch.longitude?.toString() ?? ''} onChange={text => onChange({ longitude: coordinate(text) })} />
    </div>
    <div className="flex justify-end">
      <Button variant="secondary" size="sm" onPress={onDone}>Done</Button>
    </div>
  </div>
);

const NewBranch: React.FC<{ count: number; onAdd: (branch: MerchantLocation) => void; onCancel?: () => void }> = ({ count, onAdd, onCancel }) => {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [found, setFound] = useState<AddressData | null>(null);

  const chooseAddress = (value: string, data?: AddressData) => {
    setAddress(value);
    if (data) {
      setFound(data);
      if (!label.trim()) setLabel(data.placeName || data.city || '');
    } else if (!value) {
      setFound(null);
    }
  };

  const add = () => onAdd({
    id: `loc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    label: label.trim() || found?.placeName || found?.city || `Branch ${count + 1}`,
    address: address.trim(),
    placeName: found?.placeName || undefined,
    street: found?.street || undefined,
    city: found?.city || '',
    postalCode: found?.postalCode || undefined,
    state: found?.state || undefined,
    country: found?.country || '',
    latitude: found?.lat,
    longitude: found?.lon,
    isPrimary: count === 0,
  });

  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] bg-inset p-3">
      <div>
        <p className="type-label mb-1.5 text-ink">Address</p>
        <AddressAutocomplete value={address} onChange={chooseAddress} placeholder="Search an address, shop or city" />
      </div>
      <TextInput label="Name" help="Optional." value={label} onChange={setLabel} placeholder="Zaventem" />
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" size="sm" onPress={onCancel}>Cancel</Button>}
        <Button size="sm" isDisabled={!address.trim()} onPress={add}>Add branch</Button>
      </div>
    </div>
  );
};

/** The branches on the draft. Nothing here saves until the panel does. */
const MerchantBranches: React.FC<{ branches: MerchantLocation[]; onChange: (branches: MerchantLocation[]) => void }> = ({ branches, onChange }) => {
  const [isAdding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const update = (id: string, change: Partial<MerchantLocation>) => onChange(branches.map(branch => branch.id === id ? { ...branch, ...change } : branch));
  const makePrimary = (id: string) => onChange(branches.map(branch => ({ ...branch, isPrimary: branch.id === id })));

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-card-title text-ink">Branches</h3>
        {branches.length > 0 && !isAdding && <Button variant="ghost" size="sm" icon="add-01" onPress={() => setAdding(true)}>Add</Button>}
      </div>
      {branches.length > 0 && (
        <ul className="divide-y divide-line">
          {branches.map(branch => (
            <li key={branch.id} className="py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="type-body-strong truncate text-ink">{branchName(branch)}</span>
                    {branch.isPrimary && <Badge tone="positive">Primary</Badge>}
                  </p>
                  <p className="type-caption truncate text-muted">{branch.address || branch.city}</p>
                </div>
                <Menu
                  title={branchName(branch)}
                  trigger={<IconButton icon="more_horiz" label={`Actions for ${branchName(branch)}`} tooltipPlacement="left" />}
                  items={[
                    { id: 'edit', label: 'Edit details', icon: 'edit', onAction: () => setEditingId(branch.id) },
                    ...(branch.isPrimary ? [] : [{ id: 'primary', label: 'Make primary', icon: 'star', onAction: () => makePrimary(branch.id) }]),
                    ...(hasCoordinates(branch) ? [{ id: 'maps', label: 'Open in Google Maps', icon: 'open_in_new', onAction: () => { window.open(googleMapsUrl(branch.latitude!, branch.longitude!), '_blank', 'noreferrer'); } }] : []),
                    { id: 'delete', label: 'Remove', icon: 'delete', onAction: () => onChange(removeBranch(branches, branch.id)) },
                  ]}
                />
              </div>
              {editingId === branch.id && <BranchEditor branch={branch} onChange={change => update(branch.id, change)} onDone={() => setEditingId(null)} />}
            </li>
          ))}
        </ul>
      )}
      {(isAdding || branches.length === 0) && (
        <NewBranch
          count={branches.length}
          onAdd={branch => { onChange([...branches, branch]); setAdding(false); }}
          onCancel={branches.length > 0 ? () => setAdding(false) : undefined}
        />
      )}
    </section>
  );
};

export default MerchantBranches;
