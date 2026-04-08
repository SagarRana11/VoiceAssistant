import { useEffect, useState } from 'react';
import { useProfileStore } from '../../store/profileStore';
import { fetchProfile, saveProfile } from '../../services/profileService';
import { ProfileForm } from './ProfileForm';
import styles from './ProfilePage.module.css';
import { UserProfile } from '../../store/profileStore';

interface Props {
  onBack: () => void;
}

export function ProfilePage({ onBack }: Props) {
  const { profile, setProfile, isLoading, setLoading } = useProfileStore();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProfile()
      .then(setProfile)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (updates: Partial<UserProfile>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await saveProfile(updates);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const completeness = profile?.completeness ?? 0;

  return (
    <div className={styles.page}>
      {/* ── Sticky header ──────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>

        <h1 className={styles.title}>Health Profile</h1>

        <div className={styles.completenessWrap}>
          <span className={styles.completenessLabel}>Complete</span>
          <div className={styles.completenessBar}>
            <div
              className={styles.completenessBarFill}
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className={styles.completenessValue}>{completeness}%</span>
        </div>
      </header>

      <div className={styles.content}>
        {isLoading && !profile && (
          <div className={styles.loader}>Loading your profile...</div>
        )}

        {error && (
          <div style={{ color: '#fca5a5', padding: '16px', fontSize: '14px' }}>
            Error: {error}
          </div>
        )}

        {profile && (
          <ProfileForm
            profile={profile}
            onSave={handleSave}
            isSaving={isLoading}
          />
        )}
      </div>

      {saved && (
        <div className={styles.toast}>Profile saved successfully!</div>
      )}
    </div>
  );
}
