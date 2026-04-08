import { useState, FormEvent } from 'react';
import { apiLogin, apiRegister } from '../../services/apiService';
import { useAppStore } from '../../store/useAppStore';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const login = useAppStore((s) => s.login);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let data;
      if (mode === 'login') {
        data = await apiLogin(email, password);
      } else {
        if (name.trim().length < 2) {
          setError('Name must be at least 2 characters.');
          setIsLoading(false);
          return;
        }
        data = await apiRegister(name.trim(), email, password);
      }
      login(data.user, data.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className={styles.page}>
      {/* Background orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.card}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <h1 className={styles.brandName}>VoiceAI</h1>
          <p className={styles.tagline}>
            {mode === 'login'
              ? 'Welcome back. Your assistant is ready.'
              : 'Create your account to get started.'}
          </p>
        </div>

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">Full Name</label>
              <input
                id="name"
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className={styles.error}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className={styles.spinner} />
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className={styles.toggle}>
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button className={styles.toggleBtn} onClick={toggleMode} type="button">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className={styles.toggleBtn} onClick={toggleMode} type="button">
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Roles preview */}
        <div className={styles.roles}>
          {ROLE_PREVIEWS.map((r) => (
            <div key={r.id} className={styles.roleChip}>
              <span>{r.icon}</span>
              <span>{r.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ROLE_PREVIEWS = [
  { id: 'therapist', icon: '🧠', name: 'Therapist' },
  { id: 'health',    icon: '🏥', name: 'Health' },
  { id: 'career',    icon: '💼', name: 'Career' },
  { id: 'fitness',   icon: '💪', name: 'Fitness' },
];
