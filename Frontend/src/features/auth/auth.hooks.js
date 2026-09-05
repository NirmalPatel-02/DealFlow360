import { useAuth } from '../../hooks/useAuth';

export function useAuthSession() {
  return useAuth();
}

export default useAuthSession;
