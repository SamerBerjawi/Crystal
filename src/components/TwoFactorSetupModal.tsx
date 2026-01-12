import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { useAuth } from '../hooks/useAuth';

interface TwoFactorSetupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({ onClose, onSuccess }) => {
  const { initiate2FASetup, confirm2FASetup } = useAuth();
  const [step, setStep] = useState<'loading' | 'scan' | 'verify'>('loading');
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const startSetup = async () => {
        const data = await initiate2FASetup();
        if (data) {
            setSecret(data.secret);
            setQrCodeUrl(data.qrCodeUrl);
            setStep('scan');
        } else {
            setError('Failed to generate 2FA secret.');
        }
    };
    startSetup();
  }, [initiate2FASetup]);

  const handleVerify = async (e: React.FormEvent) => {
      e.preventDefault();
      if (code.length !== 6) return;
      
      const success = await confirm2FASetup(code);
      if (success) {
          onSuccess();
          onClose();
      } else {
          setError('Invalid code. Please try again.');
          setCode('');
      }
  };

  return (
    <Modal onClose={onClose} title="Setup Two-Factor Authentication" size="lg">
        <div className="space-y-6 text-center">
            {step === 'loading' && (
                <div className="py-8">
                     <svg className="animate-spin h-8 w-8 mx-auto text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">Generating secret...</p>
                </div>
            )}

            {step === 'scan' && (
                <>
                    <p className="text-sm text-light-text dark:text-dark-text">
                        Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).
                    </p>
                    <div className="flex justify-center my-4">
                        {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="border-4 border-white rounded-xl shadow-lg" />}
                    </div>
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary bg-gray-100 dark:bg-white/10 p-2 rounded">
                        Or enter this code manually: <br />
                        <span className="font-mono font-bold text-lg select-all">{secret}</span>
                    </div>
                    <button onClick={() => setStep('verify')} className={`${BTN_PRIMARY_STYLE} w-full mt-4`}>
                        Next
                    </button>
                </>
            )}

            {step === 'verify' && (
                <form onSubmit={handleVerify} className="space-y-4">
                    <p className="text-sm text-light-text dark:text-dark-text">
                        Enter the 6-digit code from your app to verify setup.
                    </p>
                    <input 
                        type="text" 
                        value={code} 
                        onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, '')); setError(''); }}
                        maxLength={6}
                        placeholder="000000"
                        className={`${INPUT_BASE_STYLE} text-center text-2xl tracking-widest font-mono !h-14`}
                        autoFocus
                    />
                    {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setStep('scan')} className={BTN_SECONDARY_STYLE}>Back</button>
                        <button type="submit" className={`${BTN_PRIMARY_STYLE} flex-1`}>Verify & Enable</button>
                    </div>
                </form>
            )}
        </div>
    </Modal>
  );
};

export default TwoFactorSetupModal;