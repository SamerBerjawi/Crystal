import React, { useState } from 'react';
import Modal from './Modal';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  // FIX: Update prop type to handle async function from useAuth hook.
  onChangePassword: (current: string, newPass: string) => Promise<boolean>;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onChangePassword }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // FIX: Make handleSubmit async to await the result of onChangePassword.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
    }

    const wasSuccessful = await onChangePassword(currentPassword, newPassword);

    if (wasSuccessful) {
      setSuccess('Password updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setError('Your current password was incorrect.');
    }
  };

  const labelStyle = "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5";

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="currentPassword" className={labelStyle}>Current Password</label>
          <input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} required autoComplete="current-password" />
        </div>
        <div>
          <label htmlFor="newPassword" className={labelStyle}>New Password</label>
          <input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} required autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="confirmPassword" className={labelStyle}>Confirm New Password</label>
          <input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`${INPUT_BASE_STYLE} h-12`} required autoComplete="new-password" />
        </div>
        
        {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        {success && <p className="text-xs font-semibold text-emerald-500">{success}</p>}

        <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider`}>Cancel</button>
          <button type="submit" className={`${BTN_PRIMARY_STYLE} h-11 px-6 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary-500/20 active:scale-95`}>Update Password</button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;