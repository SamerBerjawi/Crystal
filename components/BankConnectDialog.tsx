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
  /** Sign-in method name; empty means the bank's default. */
  authMethod?: string;
  /** Typed login details for the chosen method. Sent once to start authorization; never persisted. */
  credentials?: Record<string, string>;
}

export interface BankCredentialField {
  name: string;
  title: string;
  required: boolean;
  description?: string;
}

export interface BankAuthMethod {
  name: string;
  title: string;
  psuType?: string;
  approach?: string;
  hidden: boolean;
  credentials: BankCredentialField[];
}

export interface BankOption {
  id: string;
  name: string;
  country?: string;
  logo?: string;
  psuTypes?: string[];
  maximumConsentValidity?: number;
  authMethods?: BankAuthMethod[];
  requiredPsuHeaders?: string[];
  /** The bank's integration is still in beta at Enable Banking. */
  beta?: boolean;
}

const PSU_TYPE_OPTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Business' },
];

const EU_EEA_COUNTRIES = [
  { id: 'AT', label: 'Austria (AT)' },
  { id: 'BE', label: 'Belgium (BE)' },
  { id: 'BG', label: 'Bulgaria (BG)' },
  { id: 'HR', label: 'Croatia (HR)' },
  { id: 'CY', label: 'Cyprus (CY)' },
  { id: 'CZ', label: 'Czechia (CZ)' },
  { id: 'DK', label: 'Denmark (DK)' },
  { id: 'EE', label: 'Estonia (EE)' },
  { id: 'FI', label: 'Finland (FI)' },
  { id: 'FR', label: 'France (FR)' },
  { id: 'DE', label: 'Germany (DE)' },
  { id: 'GR', label: 'Greece (GR)' },
  { id: 'HU', label: 'Hungary (HU)' },
  { id: 'IS', label: 'Iceland (IS)' },
  { id: 'IE', label: 'Ireland (IE)' },
  { id: 'IT', label: 'Italy (IT)' },
  { id: 'LV', label: 'Latvia (LV)' },
  { id: 'LI', label: 'Liechtenstein (LI)' },
  { id: 'LT', label: 'Lithuania (LT)' },
  { id: 'LU', label: 'Luxembourg (LU)' },
  { id: 'MT', label: 'Malta (MT)' },
  { id: 'NL', label: 'Netherlands (NL)' },
  { id: 'NO', label: 'Norway (NO)' },
  { id: 'PL', label: 'Poland (PL)' },
  { id: 'PT', label: 'Portugal (PT)' },
  { id: 'RO', label: 'Romania (RO)' },
  { id: 'SK', label: 'Slovakia (SK)' },
  { id: 'SI', label: 'Slovenia (SI)' },
  { id: 'ES', label: 'Spain (ES)' },
  { id: 'SE', label: 'Sweden (SE)' },
  { id: 'CH', label: 'Switzerland (CH)' },
  { id: 'GB', label: 'United Kingdom (GB)' },
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
  const consentDays = currentBank?.maximumConsentValidity ? Math.floor(currentBank.maximumConsentValidity / 86400) : null;
  // Methods the user may pick: not hidden, and for the chosen account holder type.
  const authMethods = (currentBank?.authMethods ?? []).filter(method => !method.hidden && (!method.psuType || method.psuType === (form.psuType || 'personal')));
  const selectedMethod = authMethods.find(method => method.name === form.authMethod);
  const methodOptions = [{ id: '', label: 'Bank default' }, ...authMethods.map(method => ({ id: method.name, label: method.title || method.name }))];

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
          <div className="min-w-0 flex-1">
            <Combobox
              label="Country"
              options={EU_EEA_COUNTRIES}
              value={form.countryCode || null}
              onChange={id => onChange({ countryCode: (id ?? '').toUpperCase(), selectedBank: '' })}
              placeholder="Choose country"
            />
          </div>
          <Button variant="secondary" isBusy={isLoadingBanks} onPress={onFindBanks}>Find banks</Button>
        </div>
        {banksError && <Banner tone="error">{banksError}</Banner>}
        {banks.length > 0 && (
          <>
            <Combobox
              label="Bank"
              options={banks.map(bank => ({ id: bank.id, label: bank.name, description: bank.country }))}
              value={form.selectedBank || null}
              onChange={id => onChange({ selectedBank: id ?? '', authMethod: '', credentials: {} })}
            />
            {availablePsuTypes.length > 1 && (
              <Select
                label="Account holder type"
                options={availablePsuTypes}
                value={form.psuType || 'personal'}
                onChange={id => onChange({ psuType: (id as 'personal' | 'business') || 'personal', authMethod: '', credentials: {} })}
              />
            )}
            {currentBank?.beta && <Banner tone="attention">This bank’s connection is still in beta. Some data may be missing or slow.</Banner>}
            {authMethods.length > 1 && (
              <Select
                label="Sign-in method"
                options={methodOptions}
                value={form.authMethod || ''}
                onChange={id => onChange({ authMethod: id, credentials: {} })}
              />
            )}
            {selectedMethod?.credentials.map(field => (
              <TextInput
                key={field.name}
                label={field.title || field.name}
                help={field.description || (field.required ? undefined : 'Optional. Skips this step at the bank.')}
                value={form.credentials?.[field.name] ?? ''}
                onChange={value => onChange({ credentials: { ...(form.credentials ?? {}), [field.name]: value } })}
              />
            ))}
            {consentDays && <p className="type-caption text-muted">Access can last up to {consentDays} days. You’ll be asked to renew it before it ends.</p>}
          </>
        )}
      </div>
    </Dialog>
  );
};

export default BankConnectDialog;
