
import React, { useState, useRef } from 'react';
import { User, Page } from '../types';
import Card from '../components/Card';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import ChangePasswordModal from '../components/ChangePasswordModal';
import PageHeader from '../components/PageHeader';

interface PersonalInfoProps {
  user: User;
  setUser: (updates: Partial<User>) => void;
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
    setUser({ is2FAEnabled: updatedUser.is2FAEnabled });
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

  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";
  const sectionTitleStyle = "text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2";

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up pb-12">
      {isPasswordModalOpen && (
        <ChangePasswordModal 
          isOpen={isPasswordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
          onChangePassword={onChangePassword}
        />
      )}
      
      {/* Navigation Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentPage('Settings')} className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
                <span className="mx-2">/</span>
                <span className="text-light-text dark:text-dark-text font-medium">Personal Info</span>
            </div>
        </div>
        <div className="mt-4">
          <PageHeader
            markerIcon="fingerprint"
            markerLabel="Identity Vault"
            title="Personal Info"
            subtitle="Profile, addresses, and compliance details with privacy-first controls."
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1">
            <div className="sticky top-6">
                <Card className="flex flex-col items-center text-center relative overflow-hidden p-0 border-0">
                    {/* Hero Background */}
                    <div className="w-full h-32 bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-600 dark:to-primary-800 relative">
                         <div className="absolute inset-0 bg-black/10"></div>
                    </div>
                    
                    {/* Profile Picture */}
                    <div className="relative -mt-16 mb-4 group cursor-pointer" onClick={handlePictureClick}>
                        <div className="w-32 h-32 rounded-full p-1 bg-white dark:bg-dark-card shadow-xl mx-auto">
                            <img 
                                src={formData.profilePictureUrl} 
                                alt="Profile" 
                                className="w-full h-full rounded-full object-cover"
                            />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center rounded-full pointer-events-none">
                             <div className="w-32 h-32 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                                <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                             </div>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    </div>

                    <div className="px-6 pb-8 w-full">
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">{formData.firstName} {formData.lastName}</h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6">{formData.email}</p>

                        <div className="flex flex-wrap justify-center gap-2 mb-8">
                            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wide border border-blue-200 dark:border-blue-800">
                                {formData.role}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                                formData.status === 'Active' 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                            }`}>
                                {formData.status}
                            </span>
                        </div>

                        <div className="w-full pt-5 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            <span>Last Login</span>
                            <span className="font-mono font-medium">{new Date(formData.lastLogin).toLocaleDateString()}</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>

        {/* Right Column: Edit Forms */}
        <div className="lg:col-span-2">
             <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Identity Section */}
                <Card>
                    <div className="mb-6 pb-4 border-b border-black/5 dark:border-white/5">
                        <h3 className={sectionTitleStyle}>
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">badge</span>
                            </div>
                            Identity
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="firstName" className={labelStyle}>First Name</label>
                            <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className={INPUT_BASE_STYLE} required />
                        </div>
                        <div>
                            <label htmlFor="lastName" className={labelStyle}>Last Name</label>
                            <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className={INPUT_BASE_STYLE} required />
                        </div>
                    </div>
                </Card>

                {/* Contact Section */}
                <Card>
                    <div className="mb-6 pb-4 border-b border-black/5 dark:border-white/5">
                        <h3 className={sectionTitleStyle}>
                             <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">contact_mail</span>
                            </div>
                            Contact Details
                        </h3>
                    </div>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="email" className={labelStyle}>Email Address</label>
                                <div className="relative">
                                    <input type="email" id="email" name="email" value={formData.email} readOnly className={`${INPUT_BASE_STYLE} pl-10 bg-gray-50 dark:bg-white/5 text-gray-500 cursor-not-allowed border-transparent focus:ring-0`} />
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">lock</span>
                                </div>
                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Email is used as your unique identifier and cannot be changed.</p>
                            </div>
                            <div>
                                <label htmlFor="phone" className={labelStyle}>Phone Number</label>
                                <input type="tel" id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} className={INPUT_BASE_STYLE} placeholder="+1 (555) 000-0000" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="address" className={labelStyle}>Address</label>
                            <textarea id="address" name="address" value={formData.address || ''} onChange={handleChange} className={INPUT_BASE_STYLE} rows={3} placeholder="Street address, City, Zip Code"></textarea>
                        </div>
                    </div>
                </Card>

                {/* Security Section */}
                <Card>
                    <div className="mb-6 pb-4 border-b border-black/5 dark:border-white/5">
                        <h3 className={sectionTitleStyle}>
                             <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">security</span>
                            </div>
                            Security
                        </h3>
                    </div>
                    
                    <div className="space-y-4 divide-y divide-black/5 dark:divide-white/5">
                         <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-semibold text-light-text dark:text-dark-text">Password</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Last changed recently</p>
                            </div>
                            <button type="button" onClick={() => setPasswordModalOpen(true)} className={BTN_SECONDARY_STYLE}>Change Password</button>
                         </div>
                         
                         <div className="flex items-center justify-between pt-4">
                            <div>
                                <p className="font-semibold text-light-text dark:text-dark-text">Two-Factor Authentication</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Add an extra layer of security to your account.</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={handle2FAToggle}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.is2FAEnabled ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                                role="switch"
                                aria-checked={formData.is2FAEnabled}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.is2FAEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                         </div>
                    </div>
                </Card>

                <div className="flex justify-end pt-4">
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} px-8 py-2.5 text-base shadow-lg shadow-primary-500/20`}>Save All Changes</button>
                </div>
             </form>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfo;
