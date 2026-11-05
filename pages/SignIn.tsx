import React, { useState } from 'react';
import AuthCard from '../components/AuthCard';
import { Button, TextLink } from '../components/ui/Actions';
import { TextInput } from '../components/ui/Fields';
import { Banner } from '../components/ui/States';

interface SignInProps {
  onSignIn: (email: string, password: string) => void;
  onNavigateToSignUp: () => void;
  onEnterDemoMode: () => void;
  isLoading: boolean;
  error: string | null;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn, onNavigateToSignUp, onEnterDemoMode, isLoading, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showResetHelp, setShowResetHelp] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onSignIn(email.trim(), password);
  };

  return (
    <AuthCard
      title="Sign in"
      description="Pick up where you left off."
      footer={<>No account yet? <TextLink onPress={onNavigateToSignUp}>Create one</TextLink></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Banner tone="error">{error}</Banner>}
        <TextInput autoFocus label="Email" type="email" autoComplete="email" isRequired value={email} onChange={setEmail} />
        <TextInput label="Password" type="password" autoComplete="current-password" isRequired value={password} onChange={setPassword} />
        <div>
          <TextLink className="type-caption" onPress={() => setShowResetHelp(shown => !shown)}>Forgot your password?</TextLink>
          {showResetHelp && <p role="note" className="type-caption mt-1 text-muted">Crystal doesn't send emails, so whoever runs this server resets passwords. Ask them to reset yours.</p>}
        </div>
        <Button type="submit" block isBusy={isLoading}>Sign in</Button>
      </form>
      <Button variant="secondary" block onPress={onEnterDemoMode}>Explore the demo</Button>
    </AuthCard>
  );
};

export default SignIn;
