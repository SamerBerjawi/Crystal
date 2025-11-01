import React, { useState, useRef } from 'react';
import { User, Page } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import ChangePasswordModal from '../components/ChangePasswordModal';

interface PersonalInfoProps {
  user: User;
  // FIX: Update setUser prop type to match the one from useAuth hook (it doesn't need an email).
  setUser: (updates: Partial<User>) => void;
  // FIX: Update onChangePassword prop to handle an async function returning a Promise.
  onChangePassword: (current: string, newPass: string) => Promise<boolean>;
  setCurrentPage: (page: Page) => void;
}

const PersonalInfo: React.FC<PersonalInfoProps> = ({ user, setUser, onChangePassword, setCurrentPage }) => {
  const [formData, setFormData] = useState<User>(user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handle2FAToggle = () => {
    const updatedUser = { ...formData, is2FAEnabled: !formData.is2FAEnabled };
    setFormData(updatedUser);
    setUser({ is2FAEnabled: updatedUser.is2FAEnabled }); // Save immediately
    alert(`Two-Factor Authentication ${updatedUser.is2FAEnabled ? 'enabled' : 'disabled'}.`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profilePictureUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUser(formData);
    alert('Profile updated successfully!');
  };

  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {isPasswordModalOpen && (
        <ChangePasswordModal 
          isOpen={isPasswordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
          onChangePassword={onChangePassword}
        />
      )}
      <header>
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                <span> / </span>
                <span className="text-light-text dark:text-dark-text font-medium">Personal Info</span>
            </div>
        </div>
        <div className="mt-4">
          {/* <h2 className="text-3xl font-bold text-light-text dark:text-dark-text">Personal Info</h2> */}
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">Update your profile information and preferences.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Profile Information</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label htmlFor="firstName" className={labelStyle}>First Name</label><input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className={INPUT_BASE_STYLE}/></div>
                  <div><label htmlFor="lastName" className={labelStyle}>Last Name</label><input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className={INPUT_BASE_STYLE}/></div>
                </div>
                <div><label htmlFor="phone" className={labelStyle}>Phone Number</label><input type="tel" id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} className={INPUT_BASE_STYLE} /></div>
                <div><label htmlFor="address" className={labelStyle}>Address</label><textarea id="address" name="address" value={formData.address || ''} onChange={handleChange} className={INPUT_BASE_STYLE} rows={3}></textarea></div>
                <div>
                  <label htmlFor="email" className={labelStyle}>Email Address</label>
                  <input type="email" id="email" name="email" value={formData.email} readOnly className={`${INPUT_BASE_STYLE} cursor-not-allowed bg-gray-100 dark:bg-gray-800/50`} />
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Security Settings</h3>
              <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <div>
                        <p className="font-medium text-light-text dark:text-dark-text">Change Password</p>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">It's a good idea to use a strong password that you're not using elsewhere.</p>
                    </div>
                    <button type="button" onClick={() => setPasswordModalOpen(true)} className={BTN_SECONDARY_STYLE}>Change</button>
                 </div>
                 <div className="flex justify-between items-center">
                    <div>
                        <p className="font-medium text-light-text dark:text-dark-text">Two-Factor Authentication</p>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Add an extra layer of security to your account.</p>
                    </div>
                    <div onClick={handle2FAToggle} className={`w-12 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors ${formData.is2FAEnabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${formData.is2FAEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                 </div>
              </div>
            </Card>
          </div>
          
          <div className="lg:col-span-1">
            <Card>
              <div className="flex flex-col items-center">
                  <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4">Profile Picture</h3>
                  <img src={formData.profilePictureUrl} alt="Profile" className="w-40 h-40 rounded-full object-cover cursor-pointer shadow-lg mb-4" onClick={handlePictureClick} />
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  <button type="button" onClick={handlePictureClick} className={BTN_SECONDARY_STYLE}>Change Photo</button>
              </div>
            </Card>
          </div>

        </div>
        <div className="flex justify-end pt-8">
            <button type="submit" className={BTN_PRIMARY_STYLE}>Save All Changes</button>
        </div>
      </form>
    </div>
  );
};

export default PersonalInfo;