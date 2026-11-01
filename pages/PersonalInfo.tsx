import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Page, User } from '../types';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LocationAutocomplete from '../components/LocationAutocomplete';
import SettingsGroup from '../components/SettingsGroup';
import SettingsSubpageHeader from '../components/SettingsSubpageHeader';
import { Button } from '../components/ui/Actions';
import { Badge } from '../components/ui/Display';
import { TextInput, Textarea } from '../components/ui/Fields';

interface PersonalInfoProps {
  user: User;
  setUser: (updates: Partial<User>) => Promise<boolean> | void;
  onChangePassword: (current: string, newPass: string) => Promise<boolean>;
  setCurrentPage: (page: Page) => void;
}

const PersonalInfo: React.FC<PersonalInfoProps> = ({ user, setUser, onChangePassword, setCurrentPage }) => {
  const [form, setForm] = useState<User>(user);
  const [isPictureBroken, setPictureBroken] = useState(false);
  const [isPasswordOpen, setPasswordOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (field: keyof User) => (value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const isDirty = JSON.stringify(form) !== JSON.stringify(user);
  const initials = `${form.firstName?.charAt(0) ?? ''}${form.lastName?.charAt(0) ?? ''}`;
  const lastSignIn = form.lastLogin ? new Date(form.lastLogin) : null;

  const choosePicture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPictureBroken(false);
      setForm(prev => ({ ...prev, profilePictureUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
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
            <LocationAutocomplete value={form.defaultCity ?? ''} onChange={set('defaultCity')} placeholder="Brussels, Belgium" />
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
      </SettingsGroup>
    </div>
  );
};

export default PersonalInfo;
