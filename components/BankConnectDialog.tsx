import React, { useState } from 'react';
import { Button } from './ui/Actions';
import { TextInput, Textarea } from './ui/Fields';
import { Dialog } from './ui/Overlays';
import { Combobox, Select } from './ui/Pickers';
import { Banner } from './ui/States';

export interface BankForm {
  applicationId: string;
  countryCode: string;
  clientCertificate: string;
  selectedBank: string;
  psuType?: 'personal' | 'business';
}

export interface BankOption {
  id: string;
  name: string;
  country?: string;
  logo?: string;
  psuTypes?: string[];
  maximumConsentValidity?: number;
}

const PSU_TYPE_OPTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Business' },
];

interface BankConnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  form: BankForm;
  onChange: (updates: Partial<BankForm>) => void;
  hasStoredKey: boolean;
  banks: BankOption[];
  isLoadingBanks: boolean;
  banksError: string | null;
  onFindBanks: () => void;
  onConnect: () => void;
}

/** Enable Banking credentials, then the bank. Saved credentials stay out of the way. */
const BankConnectDialog: React.FC<BankConnectDialogProps> = ({ isOpen, onClose, form, onChange, hasStoredKey, banks, isLoadingBanks, banksError, onFindBanks, onConnect }) => {
  const [isEditingCredentials, setEditingCredentials] = useState(false);
  const showCredentials = !hasStoredKey || !form.applicationId || isEditingCredentials;
  const currentBank = banks.find(b => b.id === form.selectedBank);
  const availablePsuTypes = currentBank?.psuTypes?.length
    ? PSU_TYPE_OPTIONS.filter(opt => currentBank.psuTypes!.includes(opt.id))
    : PSU_TYPE_OPTIONS;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Connect a bank"
      description="You’ll sign in at your bank to approve access."
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={!form.selectedBank} onPress={onConnect}>Continue to bank</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {showCredentials ? (
          <>
            <TextInput label="Enable Banking application ID" value={form.applicationId} onChange={value => onChange({ applicationId: value })} />
            <Textarea
              label="Private key (PEM)"
              rows={3}
              help="Stored encrypted on the server, never in this browser."
              placeholder={hasStoredKey ? 'A key is saved. Paste a new one only to replace it.' : '-----BEGIN PRIVATE KEY-----'}
              value={form.clientCertificate}
              onChange={value => onChange({ clientCertificate: value })}
            />
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="type-label text-ink">Enable Banking</p>
              <p className="type-caption truncate text-muted">{form.applicationId}</p>
            </div>
            <Button variant="secondary" size="sm" onPress={() => setEditingCredentials(true)}>Change</Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <TextInput label="Country code" maxLength={2} className="w-32 shrink-0" value={form.countryCode} onChange={value => onChange({ countryCode: value.toUpperCase() })} />
          <Button variant="secondary" isBusy={isLoadingBanks} onPress={onFindBanks}>Find banks</Button>
        </div>
        {banksError && <Banner tone="error">{banksError}</Banner>}
        {banks.length > 0 && (
          <>
            <Combobox
              label="Bank"
              options={banks.map(bank => ({ id: bank.id, label: bank.name, description: bank.country }))}
              value={form.selectedBank || null}
              onChange={id => onChange({ selectedBank: id ?? '' })}
            />
            {availablePsuTypes.length > 1 && (
              <Select
                label="Account holder type"
                options={availablePsuTypes}
                value={form.psuType || 'personal'}
                onChange={id => onChange({ psuType: (id as 'personal' | 'business') || 'personal' })}
              />
            )}
          </>
        )}
      </div>
    </Dialog>
  );
};

export default BankConnectDialog;
