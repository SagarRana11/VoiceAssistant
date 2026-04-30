import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useCathLabStore } from '../../store/cathLabStore';
import { CathLabEnrollPage } from './CathLabEnrollPage';

export function CathLabPage() {
  const { navigate } = useAppStore();
  const { session } = useCathLabStore();

  useEffect(() => {
    if (!session) return;
    if (session.status === 'completed') {
      navigate('cathlab-summary');
    } else if (session.status === 'in_progress') {
      navigate('cathlab-interview');
    }
  }, [session, navigate]);

  return <CathLabEnrollPage />;
}
