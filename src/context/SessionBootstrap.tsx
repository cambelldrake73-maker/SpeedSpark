import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';
import { formatSupabaseError, logSupabaseError } from '../utils/supabaseDebug';

/** Loads profile/preferences from Supabase when a persisted session exists. */
export function SessionBootstrap() {
  const { isSupabaseEnabled, isAuthLoading, session } = useAuth();
  const { syncFromSupabase, isLoggedIn } = useApp();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled || isAuthLoading || !session?.user || isLoggedIn) {
      return;
    }

    setBootstrapError(null);
    void syncFromSupabase(session.user.id).catch((error) => {
      const message = formatSupabaseError(error, 'SessionBootstrap.syncFromSupabase');
      logSupabaseError('SessionBootstrap.syncFromSupabase', error);
      setBootstrapError(message);
      console.error('[SpeedSpark Supabase] Session bootstrap failed:', message);
    });
  }, [isAuthLoading, isLoggedIn, isSupabaseEnabled, session?.user, syncFromSupabase]);

  useEffect(() => {
    if (bootstrapError) {
      console.error('[SpeedSpark Supabase] bootstrapError state', bootstrapError);
    }
  }, [bootstrapError]);

  return null;
}
