import useAuth from './useAuth';

export default function useFormsHubViewOnly() {
  const { user } = useAuth();
  return user?.role === 'employee' && Boolean(user?.formsHubViewOnly);
}
