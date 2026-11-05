import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Page, User } from '../types';
import { usePreferencesContext } from '../contexts/DomainProviders';
import { AUTO_LOCK_OPTIONS, DEFAULT_AUTO_LOCK_MINUTES } from '../utils/lockModel';
import ChangePasswordModal from '../components/ChangePasswordModal';
import PinDialog from '../components/PinDialog';
import LocationAutocomplete from '../components/LocationAutocomplete';
import SettingsGroup from '../components/SettingsGroup';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import { Button } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { TextInput, Textarea } from '../components/ui/Fields';
import { Select } from '../components/ui/Pickers';

interface ActiveSessionItem {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isLocked: boolean;
  isCurrent: boolean;
}

interface PersonalInfoProps {
  user: User;
  setUser: (updates: Partial<User>) => Promise<boolean> | void;
  onChangePassword: (current: string, newPass: string) => Promise<boolean>;
  setCurrentPage: (page: Page) => void;
  /** Unset in demo mode, which has no server to hold a PIN. */
  lock?: {
    hasPin: boolean;
    fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    onChanged: (hasPin: boolean) => void;
  };
}

const PersonalInfo: React.FC<PersonalInfoProps> = ({ user, setUser, onChangePassword, setCurrentPage, lock }) => {
  const { preferences, setPreferences } = usePreferencesContext();
  const [pinMode, setPinMode] = useState<'set' | 'remove' | null>(null);
  const [form, setForm] = useState<User>(user);
  const [isPictureBroken, setPictureBroken] = useState(false);
  const [isPasswordOpen, setPasswordOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [isRevokingSessions, setRevokingSessions] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(user);
  }, [user]);

  useEffect(() => {
    if (!lock?.fetcher) return;
    let isCurrent = true;
    lock.fetcher('/api/auth/sessions')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (isCurrent && Array.isArray(data?.sessions)) {
          setSessions(data.sessions);
        }
      })
      .catch(() => undefined);
    return () => { isCurrent = false; };
  }, [lock]);

  const handleRevokeOtherSessions = async () => {
    if (!lock?.fetcher) return;
    setRevokingSessions(true);
    try {
      const res = await lock.fetcher('/api/auth/sessions/revoke-others', { method: 'POST' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.isCurrent));
        toast.success('Signed out of all other sessions');
      } else {
        toast.error('Could not revoke other sessions');
      }
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setRevokingSessions(false);
    }
  };

  const set = (field: keyof User) => (value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const isDirty = JSON.stringify(form) !== JSON.stringify(user);
  const initials = `${form.firstName?.charAt(0) ?? ''}${form.lastName?.charAt(0) ?? ''}`;
  const lastSignIn = form.lastLogin ? new Date(form.lastLogin) : null;

  const choosePicture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Choose an image smaller than 15 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 256;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setPictureBroken(false);
            setForm(prev => ({ ...prev, profilePictureUrl: compressed }));
            return;
          }
        } catch {
          // Fallback to raw data URL if canvas compression is unavailable
        }
        setPictureBroken(false);
        setForm(prev => ({ ...prev, profilePictureUrl: rawDataUrl }));
      };
      img.onerror = () => {
        setPictureBroken(false);
        setForm(prev => ({ ...prev, profilePictureUrl: rawDataUrl }));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    const saved = await setUser(form);
    setSaving(false);
    if (saved === false) toast.error('Your profile wasn’t saved. Try again.');
    else toast.success('Profile saved');
  };

  return (
    <div className="space-y-8">
      <SettingsSubpageHeader title="Profile" setCurrentPage={setCurrentPage} />
      {lock && <PinDialog mode={pinMode} hasPin={lock.hasPin} fetcher={lock.fetcher} onClose={() => setPinMode(null)} onChanged={lock.onChanged} />}
      <ChangePasswordModal isOpen={isPasswordOpen} onClose={() => setPasswordOpen(false)} onChangePassword={onChangePassword} />

      <SettingsGroup id="profile-details" title="Your details" description="Crystal uses your default city on new transactions.">
        <div className="mb-5 flex flex-wrap items-center gap-4">
          {form.profilePictureUrl && !isPictureBroken ? (
            <img src={form.profilePictureUrl} alt="" onError={() => setPictureBroken(true)} className="size-16 rounded-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-inset type-card-title text-ink">{initials}</span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="type-body-strong truncate text-ink">{form.firstName} {form.lastName}</p>
              <Badge tone="neutral">{form.role}</Badge>
            </div>
            {lastSignIn && <p className="type-caption mt-1 text-muted">Last signed in {lastSignIn.toLocaleDateString()}</p>}
          </div>
          <Button variant="secondary" size="sm" className="sm:ml-auto" onPress={() => fileInput.current?.click()}>Change picture</Button>
          <input ref={fileInput} type="file" accept="image/*" aria-label="Profile picture" className="sr-only" tabIndex={-1} onChange={choosePicture} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="First name" autoComplete="given-name" isRequired value={form.firstName} onChange={set('firstName')} />
          <TextInput label="Last name" autoComplete="family-name" isRequired value={form.lastName} onChange={set('lastName')} />
          <TextInput label="Email" type="email" isReadOnly help="You sign in with this." value={form.email} />
          <TextInput label="Phone" type="tel" autoComplete="tel" value={form.phone ?? ''} onChange={set('phone')} />
          <div className="min-w-0 md:col-span-2">
            <p className="type-label mb-1.5 text-ink">Default city</p>
            <LocationAutocomplete label="Default city" value={form.defaultCity ?? ''} onChange={set('defaultCity')} placeholder="Brussels, Belgium" />
          </div>
          <Textarea label="Address" rows={3} className="md:col-span-2" value={form.address ?? ''} onChange={set('address')} />
        </div>

        <div className="mt-5 flex justify-end">
          <Button isBusy={isSaving} isDisabled={!isDirty || !form.firstName.trim() || !form.lastName.trim()} onPress={save}>Save profile</Button>
        </div>
      </SettingsGroup>

      <SettingsGroup id="profile-security" title="Security">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-body min-w-0 text-ink">Password</p>
          <Button variant="secondary" size="sm" onPress={() => setPasswordOpen(true)}>Change password</Button>
        </div>
        {lock && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="type-body text-ink">PIN lock</p>
                <p className="type-caption mt-0.5 text-muted">{lock.hasPin ? 'On. Press L or use your profile menu to lock.' : 'Lock Crystal without signing out.'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {lock.hasPin && <Button variant="ghost" size="sm" onPress={() => setPinMode('remove')}>Remove</Button>}
                <Button variant="secondary" size="sm" onPress={() => setPinMode('set')}>{lock.hasPin ? 'Change PIN' : 'Set a PIN'}</Button>
              </div>
            </div>
            {lock.hasPin && (
              <Select
                label="Auto-lock"
                className="mt-4 md:max-w-xs"
                options={AUTO_LOCK_OPTIONS}
                value={String(preferences.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES)}
                onChange={id => setPreferences(prev => ({ ...prev, autoLockMinutes: Number(id) }))}
              />
            )}
          </div>
        )}
        {lock && sessions.length > 0 && (
          <div className="mt-4 border-t border-line pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="type-body text-ink">Active sessions</p>
                <p className="type-caption mt-0.5 text-muted">
                  {sessions.length === 1 ? '1 active session on your account.' : `${sessions.length} active sessions on your account.`}
                </p>
              </div>
              {sessions.length > 1 && (
                <Button variant="secondary" size="sm" isBusy={isRevokingSessions} onPress={handleRevokeOtherSessions}>
                  Sign out other sessions
                </Button>
              )}
            </div>
            <ul className="divide-y divide-line">
              {sessions.map(s => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="type-body-strong text-ink">{s.isCurrent ? 'This device' : 'Signed-in session'}</span>
                      {s.isCurrent && <Badge tone="positive">Current</Badge>}
                      {s.isLocked && <Badge tone="attention">Locked</Badge>}
                    </div>
                    <p className="type-caption text-muted">
                      Started {new Date(s.createdAt).toLocaleDateString()} · Last active {new Date(s.lastSeenAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SettingsGroup>
    </div>
  );
};

export default PersonalInfo;
