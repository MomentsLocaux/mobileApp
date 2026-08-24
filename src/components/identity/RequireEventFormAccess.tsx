import { RequireCreateAccess, RequireCreateAccessLoading } from '@/components/identity/RequireCreateAccess';
import { features } from '@/config/features';
import { useAuth } from '@/hooks';
import { Redirect } from 'expo-router';

type Props = {
  children: React.ReactNode;
};

/**
 * Allows create form when eventCreate rules pass OR when eventSuggest is enabled (discover suggestion).
 */
export function RequireEventFormAccess({ children }: Props) {
  const { user, isLoading } = useAuth();

  if (features.eventSuggest) {
    if (isLoading) return <RequireCreateAccessLoading />;
    if (!user) return <Redirect href="/auth/login" />;
    return <>{children}</>;
  }

  return <RequireCreateAccess>{children}</RequireCreateAccess>;
}
