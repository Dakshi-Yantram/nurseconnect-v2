import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useStore } from '../store';
import { portalHome, type AppRole } from './roles';

/**
 * Portal guard. Each role's layout declares which role it serves; anyone else
 * is redirected to their own portal (or to sign-in if there's no session).
 *
 * Without this a stale deep link — or the back stack after switching accounts —
 * drops a nurse into the consumer tabs, where every request 403s.
 */
export function useRequireRole(allowed: AppRole | AppRole[]) {
  const router = useRouter();
  const role = useStore((s) => s.role);
  const authBootstrapping = useStore((s) => s.authBootstrapping);

  const allowedList = Array.isArray(allowed) ? allowed : [allowed];

  useEffect(() => {
    if (authBootstrapping) return;
    if (!role) {
      router.replace('/role-select');
      return;
    }
    if (!allowedList.includes(role)) {
      router.replace(portalHome(role) as any);
    }
    // `allowedList` is rebuilt each render; comparing its contents keeps the
    // effect from firing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, authBootstrapping, allowedList.join('|'), router]);

  return { role, ready: !authBootstrapping && !!role && allowedList.includes(role) };
}
