import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function usePremium() {
  const { profile, isPremium } = useAuth();

  const daysLeft = useMemo(() => {
    if (!profile?.premium_until) return 0;
    const ts = new Date(profile.premium_until).getTime();
    if (!Number.isFinite(ts)) return 0;
    const diff = ts - Date.now();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  }, [profile]);

  return { isPremium: !!isPremium, daysLeft };
}






