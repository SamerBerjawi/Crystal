
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

  const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary  tracking-wider mb-1.5";
  const sectionTitleStyle = "text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2";

  return (
    <div className="w-full animate-fade-in-up pb-12 px-4">
      {isPasswordModalOpen && (
        <ChangePasswordModal 
          isOpen={isPasswordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
          onChangePassword={onChangePassword}
        />
      )}
      
      {/* Navigation & Header */}
      <div className="mb-10 space-y-6">
        <nav className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentPage('Settings')} 
              className="group flex items-center gap-2 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary  tracking-widest hover:text-primary-500 transition-colors"
            >
                <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                </div>
                <span>Back to Control Center</span>
            </button>
        </nav>
        
        <PageHeader
          markerIcon="fingerprint"
          markerLabel="Identity Vault"
          title="Personal Profile"
          subtitle="Manage your secure identity, contact details, and account security settings."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
                <div className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
                    {/* Hero Background */}
                    <div className="w-full h-24 bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-600 dark:to-primary-800 relative">
                         <div className="absolute inset-0 bg-black/10 opacity-20"></div>
                         <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-40"></div>
                    </div>
                    
                    {/* Profile Picture */}
                    <div className="relative -mt-12 flex justify-center px-6">
                        <div className="relative group/photo cursor-pointer" onClick={handlePictureClick}>
                            <div className="w-28 h-28 rounded-2xl p-1 bg-white dark:bg-dark-card shadow-2xl relative z-10 overflow-hidden">
                                <img 
                                    src={formData.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop'} 
                                    alt="Profile" 
                                    className="w-full h-full rounded-xl object-cover"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center text-white z-20 backdrop-blur-sm">
                                  <span className="material-symbols-outlined text-3xl">photo_camera</span>
                                </div>
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-primary-500 text-white w-8 h-8 flex items-center justify-center rounded-lg border-4 border-white dark:border-dark-card shadow-lg z-30">
                                <span className="material-symbols-outlined text-base">sync</span>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        </div>
                    </div>

                    <div className="p-8 pt-6 text-center">
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text leading-tight">{formData.firstName} {formData.lastName}</h2>
                        <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60 mt-1  tracking-wider">{formData.email}</p>

                        <div className="flex flex-wrap justify-center gap-2 mt-6">
                            <span className="px-3 py-1 rounded-lg bg-primary-500 text-white text-[10px] font-black  tracking-widest">
                                {formData.role}
                            </span>
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black  tracking-widest border ${
                                formData.status === 'Active' 
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30' 
                                : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 border-gray-100 dark:border-gray-800'
                            }`}>
                                {formData.status}
                            </span>
                        </div>
                    </div>
                    
                    <div className="px-8 pb-8 space-y-4">
                        <div className="pt-6 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary  tracking-widest opacity-60">
                            <span>Last Access</span>
                            <span className="text-light-text dark:text-dark-text">{new Date(formData.lastLogin).toLocaleDateString()}</span>
                        </div>
                         <div className="flex justify-between items-center text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary  tracking-widest opacity-60">
                            <span>Security Level</span>
                            <span className="text-emerald-500">Tier 1</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-primary-500/5 dark:bg-primary-500/10 rounded-2xl border border-primary-500/10 flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/20">
                      <span className="material-symbols-outlined text-xl">shield</span>
                   </div>
                   <div>
                      <h4 className="text-xs font-bold text-primary-600 dark:text-primary-400 tracking-tight">Privacy Mode</h4>
                      <p className="text-[10px] font-bold text-primary-600/60 dark:text-primary-400/60 mt-0.5 leading-tight">Your sensitive data is encrypted and only visible to you.</p>
                   </div>
                </div>
            </div>
        </div>

        {/* Right Column: Edit Forms */}
        <div className="lg:col-span-3">
             <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Identity Section */}
                <div className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-black/5 dark:border-white/5 p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="material-symbols-outlined text-2xl">badge</span>
                        </div>
                        <div>
                           <h3 className="text-lg font-bold text-light-text dark:text-dark-text leading-tight tracking-tight">Legal Identity</h3>
                           <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60  tracking-wider">Verification status: Level 1</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label htmlFor="firstName" className={labelStyle}>Given Name</label>
                            <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className={`${INPUT_BASE_STYLE} h-12 font-bold px-4`} required />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="lastName" className={labelStyle}>Family Name</label>
                            <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className={`${INPUT_BASE_STYLE} h-12 font-bold px-4`} required />
                        </div>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-black/5 dark:border-white/5 p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <span className="material-symbols-outlined text-2xl">contact_mail</span>
                        </div>
                        <div>
                           <h3 className="text-lg font-bold text-light-text dark:text-dark-text leading-tight tracking-tight">Reachability</h3>
                           <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60  tracking-wider">Communication & Notifications</p>
                        </div>
                    </div>
                    
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label htmlFor="email" className={labelStyle}>Email Protocol</label>
                                <div className="relative group">
                                    <input type="email" id="email" name="email" value={formData.email} readOnly className={`${INPUT_BASE_STYLE} h-12 pl-12 bg-gray-50/50 dark:bg-white/5 text-gray-500 cursor-not-allowed border-transparent font-bold`} />
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-primary-500 transition-colors">verified_user</span>
                                </div>
                                <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-2 flex items-center gap-1.5 opacity-50">
                                   <span className="material-symbols-outlined text-[10px]">info</span>
                                   Your email is your primary login key and cannot be altered.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="phone" className={labelStyle}>Mobile Number</label>
                                <input type="tel" id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} className={`${INPUT_BASE_STYLE} h-12 font-bold px-4`} placeholder="+1 (555) 000-0000" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="address" className={labelStyle}>Mailing Address</label>
                            <textarea id="address" name="address" value={formData.address || ''} onChange={handleChange} className={`${INPUT_BASE_STYLE} min-h-[100px] font-bold p-4 resize-none`} placeholder="Street, Building, City, ZIP / Postal Code"></textarea>
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-black/5 dark:border-white/5 p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <span className="material-symbols-outlined text-2xl">safety_check</span>
                        </div>
                        <div>
                           <h3 className="text-lg font-bold text-light-text dark:text-dark-text leading-tight tracking-tight">Access Control</h3>
                           <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60  tracking-wider">Authentication Methods</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-dark-card flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary transition-transform group-hover:rotate-12">
                                  <span className="material-symbols-outlined">password</span>
                                </div>
                                <div>
                                    <p className="font-black text-sm text-light-text dark:text-dark-text  tracking-tight">Main Password</p>
                                    <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60  tracking-widest mt-0.5">Updated 45 days ago</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setPasswordModalOpen(true)} className="px-5 py-2.5 rounded-xl bg-white dark:bg-dark-card border border-black/10 dark:border-white/10 text-[10px] font-black  tracking-widest hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-all shadow-sm">Rotate Credentials</button>
                         </div>
                         
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-dashed border-black/20 dark:border-white/20 opacity-60 grayscale">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                                  <span className="material-symbols-outlined">stay_current_portrait</span>
                                </div>
                                <div>
                                    <p className="font-black text-sm text-light-text dark:text-dark-text  tracking-tight">Two-Factor Authentication</p>
                                    <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60  tracking-widest mt-0.5">Biometric / TOTP Required</p>
                                </div>
                            </div>
                            <div className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black  tracking-[0.2em] border border-amber-500/20">
                                Engineering Lock
                            </div>
                         </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-6 pt-6">
                    <p className="text-[11px] font-black text-light-text-secondary dark:text-dark-text-secondary  tracking-[0.1em] opacity-40 max-w-sm leading-tight">
                       Changes are synced across your devices immediately. Audit logs will reflect this administrative action.
                    </p>
                    <button type="submit" className="px-10 py-4 rounded-2xl bg-primary-500 text-white text-sm font-black  tracking-[0.2em] shadow-2xl shadow-primary-500/30 hover:scale-105 active:scale-95 transition-all">
                       Commit Changes
                    </button>
                </div>
             </form>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfo;
