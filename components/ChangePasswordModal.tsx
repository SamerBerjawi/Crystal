import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/Actions';
import { TextInput } from './ui/Fields';
import { Dialog } from './ui/Overlays';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (current: string, newPass: string) => Promise<boolean>;
}

const MIN_LENGTH = 8;
const MAX_BYTES = 72;

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onChangePassword }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  }, [isOpen]);

  const submit = async () => {
    setError('');
    if (newPassword !== confirmPassword) return setError('The new passwords don’t match.');
    if (newPassword.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`);
    if (new TextEncoder().encode(newPassword).length > MAX_BYTES) return setError(`Use at most ${MAX_BYTES} bytes.`);
    setSaving(true);
    const changed = await onChangePassword(currentPassword, newPassword);
    setSaving(false);
    if (!changed) return setError('Your current password is wrong.');
    toast.success('Password changed');
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Change password"
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isBusy={isSaving} isDisabled={!currentPassword || !newPassword || !confirmPassword} onPress={submit}>Change password</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <TextInput label="Current password" type="password" autoComplete="current-password" autoFocus value={currentPassword} onChange={setCurrentPassword} />
        <TextInput label="New password" type="password" autoComplete="new-password" help={`At least ${MIN_LENGTH} characters.`} value={newPassword} onChange={setNewPassword} />
        <TextInput label="Confirm new password" type="password" autoComplete="new-password" error={error || undefined} value={confirmPassword} onChange={setConfirmPassword} />
      </div>
    </Dialog>
  );
};

export default ChangePasswordModal;
