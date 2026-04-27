import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { useProfileStore } from './store/profileStore';
import { apiGetMe } from './services/apiService';
import { fetchProfile } from './services/profileService';
import { LoginPage }    from './pages/LoginPage/LoginPage';
import { AssistantPage } from './pages/AssistantPage/AssistantPage';
import { ProfilePage }  from './pages/profile/ProfilePage';
import { HospitalPage } from './pages/hospital/HospitalPage';
import { ConsentPage }  from './pages/hospital/ConsentPage';
import { DischargePage } from './pages/hospital/DischargePage';
import { ChatPage }     from './pages/hospital/ChatPage';
import { FollowupPage } from './pages/hospital/FollowupPage';
import { AvatarPage }   from './pages/hospital/AvatarPage';

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

  if (currentPage === 'profile')           return <ProfilePage onBack={() => navigate('assistant')} />;
  if (currentPage === 'hospital')          return <HospitalPage />;
  if (currentPage === 'hospital-consent')  return <ConsentPage />;
  if (currentPage === 'hospital-discharge') return <DischargePage />;
  if (currentPage === 'hospital-chat')     return <ChatPage />;
  if (currentPage === 'hospital-followup') return <FollowupPage />;
  if (currentPage === 'hospital-avatar')   return <AvatarPage />;

  return <AssistantPage />;
}
