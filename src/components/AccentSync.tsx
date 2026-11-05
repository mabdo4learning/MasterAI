import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { applyAccent, savedAccent } from '../lib/theme';

/** After sign-in, uses the colour theme saved on the account (chosen on another device). */
export default function AccentSync() {
  const { session } = useAuth();
  const accent = session?.user.user_metadata?.accent;
  useEffect(() => {
    if (typeof accent === 'string' && accent !== savedAccent()) applyAccent(accent);
  }, [accent]);
  return null;
}
