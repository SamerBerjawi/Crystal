import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { PIN_LENGTH, triesLeftMessage } from '../utils/lockModel';
import { Button } from './ui/Actions';
import PinPad from './ui/PinPad';

interface LockScreenProps {
  user: User;
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Reloads, so your data comes back from the server. */
  onUnlocked: () => void;
  onSignOut: () => void;
}

/** Nothing else renders while locked, and the browser holds none of your data (D-107). */
const LockScreen: React.FC<LockScreenProps> = ({ user, fetcher, onUnlocked, onSignOut }) => {
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [isChecking, setChecking] = useState(false);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let isCurrent = true;
    const check = async () => {
      setChecking(true);
      setMessage('');
      try {
        const response = await fetcher('/api/lock/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        if (!isCurrent) return;
        if (response.ok) return onUnlocked();
        const body = await response.json().catch(() => ({}));
        if (body.isSignedOut) return onUnlocked();
        setMessage(typeof body.triesLeft === 'number' ? triesLeftMessage(body.triesLeft) : body.message || 'Crystal couldn’t check your PIN.');
      } catch {
        if (isCurrent) setMessage('Crystal couldn’t reach the server. Try again.');
      }
      if (isCurrent) {
        setPin('');
        setChecking(false);
      }
    };
    void check();
    return () => { isCurrent = false; };
  }, [fetcher, onUnlocked, pin]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4 py-8">
      <div className="text-center">
        <h1 className="type-card-title text-ink">Crystal is locked</h1>
        <p className="type-body mt-1 text-muted">{user.firstName} {user.lastName}</p>
      </div>
      <PinPad pin={pin} onChange={setPin} isDisabled={isChecking} />
      <p role="alert" className="type-body min-h-6 max-w-xs text-center text-ink">{message}</p>
      <Button variant="ghost" onPress={onSignOut}>Sign out instead</Button>
    </main>
  );
};

export default LockScreen;
