import { useAuth } from '../lib/auth';
import Home from '../pages/Home';
import LandingPage from '../pages/LandingPage';
import RequireAuth from './RequireAuth';
import Splash from './Splash';

/** "/" is the dashboard when signed in, and the public landing page otherwise. */
export default function HomeRoute() {
  const { session, ready } = useAuth();
  if (!ready) return <Splash />;
  if (!session) return <LandingPage />;
  return (
    <RequireAuth>
      <Home />
    </RequireAuth>
  );
}
