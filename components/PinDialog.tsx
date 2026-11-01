import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isValidPin, PIN_LENGTH } from '../utils/lockModel';
import { Button } from './ui/Actions';
import { TextInput } from './ui/Fields';
import { Dialog } from './ui/Overlays';

interface PinDialogProps {
  mode: 'set' | 'remove' | null;
  hasPin: boolean;
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onChanged: (hasPin: boolean) => void;
}

const digitsOnly = (text: string) => text.replace(/\D/g, '').slice(0, PIN_LENGTH);

const PinDialog: React.FC<PinDialogProps> = ({ mode, hasPin, fetcher, onClose, onChanged }) => {
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    if (mode) return;
    setPassword('');
    setPin('');
    setConfirmPin('');
    setError('');
  }, [mode]);

  const isRemoving = mode === 'remove';

  const submit = async () => {
    setError('');
    if (!isRemoving && !isValidPin(pin)) return setError(`Use ${PIN_LENGTH} digits.`);
    if (!isRemoving && pin !== confirmPin) return setError('The PINs don’t match.');
    setSaving(true);
    try {
      const response = await fetcher('/api/lock/pin', {
        method: isRemoving ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRemoving ? { password } : { password, pin }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setError(body.message || 'Crystal couldn’t save that.');
      onChanged(!isRemoving);
      toast.success(isRemoving ? 'PIN removed' : 'PIN saved');
      onClose();
    } catch {
      setError('Crystal couldn’t reach the server. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={!!mode}
      onClose={onClose}
      title={isRemoving ? 'Remove your PIN' : hasPin ? 'Change your PIN' : 'Set a PIN'}
      description={isRemoving ? 'Crystal won’t lock any more.' : 'You’ll use it to unlock Crystal on your devices.'}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button variant={isRemoving ? 'destructive' : 'primary'} isBusy={isSaving} isDisabled={!password} onPress={submit}>{isRemoving ? 'Remove PIN' : 'Save PIN'}</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <TextInput label="Your password" type="password" autoComplete="current-password" autoFocus error={isRemoving ? error || undefined : undefined} value={password} onChange={setPassword} />
        {!isRemoving && (
          <>
            <TextInput label={`New PIN (${PIN_LENGTH} digits)`} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={text => setPin(digitsOnly(text))} />
            <TextInput label="Confirm PIN" type="password" inputMode="numeric" autoComplete="off" error={error || undefined} value={confirmPin} onChange={text => setConfirmPin(digitsOnly(text))} />
          </>
        )}
      </div>
    </Dialog>
  );
};

export default PinDialog;
