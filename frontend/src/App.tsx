import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { useProfileStore } from './store/profileStore';
import { apiGetMe } from './services/apiService';
import { fetchProfile } from './services/profileService';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { AssistantPage } from './pages/AssistantPage/AssistantPage';
import { ProfilePage } from './pages/profile/ProfilePage';

export default function App() {
  const { user, token, currentPage, login, logout, navigate } = useAppStore();
  const { setProfile, setLoading } = useProfileStore();

  // Restore session from stored token
  useEffect(() => {
    if (token && !user) {
      apiGetMe()
        .then(({ user: fetchedUser }) => login(fetchedUser, token))
        .catch(() => logout());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load health profile whenever user is logged in
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchProfile()
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return <LoginPage />;

  if (currentPage === 'profile') {
    return <ProfilePage onBack={() => navigate('assistant')} />;
  }

  return <AssistantPage />;
}
