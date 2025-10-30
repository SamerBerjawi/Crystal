import React, { useState } from 'react';
import Modal from './Modal';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (current: string, newPass: string) => boolean;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onChangePassword }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
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

    const wasSuccessful = onChangePassword(currentPassword, newPassword);

    if (wasSuccessful) {
      setSuccess('Password updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setError('Your current password was incorrect.');
    }
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="currentPassword" className={labelStyle}>Current Password</label>
          <input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={INPUT_BASE_STYLE} required autoComplete="current-password" />
        </div>
        <div>
          <label htmlFor="newPassword" className={labelStyle}>New Password</label>
          <input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={INPUT_BASE_STYLE} required autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="confirmPassword" className={labelStyle}>Confirm New Password</label>
          <input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={INPUT_BASE_STYLE} required autoComplete="new-password" />
        </div>
        
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-500">{success}</p>}

        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY_STYLE}>Update Password</button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;