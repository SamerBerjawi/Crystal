import React, { useState } from 'react';
import AuthCard from '../components/AuthCard';
import { Button, TextLink } from '../components/ui/Actions';
import { TextInput } from '../components/ui/Fields';
import { Banner } from '../components/ui/States';
import { User } from '../types';

interface SignUpProps {
  onSignUp: (newUser: Pick<User, 'firstName' | 'lastName' | 'email'> & { password: string }) => void;
  onNavigateToSignIn: () => void;
  isLoading: boolean;
  error: string | null;
}

const SignUp: React.FC<SignUpProps> = ({ onSignUp, onNavigateToSignIn, isLoading, error }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const problem =
      (firstName.trim().length > 100 && 'First name must be 100 characters or fewer.') ||
      (lastName.trim().length > 100 && 'Last name must be 100 characters or fewer.') ||
      (password.length < 8 && 'Password must be at least 8 characters long.') ||
      (new TextEncoder().encode(password).length > 72 && 'Password must be at most 72 bytes long.') ||
      null;
    setLocalError(problem || null);
    if (problem) return;
    onSignUp({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password });
  };

  return (
    <AuthCard
      title="Create your account"
      description="Next, a short set-up for your currency and first account."
      footer={<>Already have an account? <TextLink onPress={onNavigateToSignIn}>Sign in</TextLink></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {(localError || error) && <Banner tone="error">{localError || error}</Banner>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput autoFocus label="First name" autoComplete="given-name" isRequired value={firstName} onChange={setFirstName} />
          <TextInput label="Last name" autoComplete="family-name" isRequired value={lastName} onChange={setLastName} />
        </div>
        <TextInput label="Email" type="email" autoComplete="email" isRequired value={email} onChange={setEmail} />
        <TextInput label="Password" type="password" placeholder="Min. 8 characters" help="At least 8 characters." autoComplete="new-password" isRequired value={password} onChange={setPassword} />
        <Button type="submit" block isBusy={isLoading}>Create account</Button>
      </form>
    </AuthCard>
  );
};

export default SignUp;
