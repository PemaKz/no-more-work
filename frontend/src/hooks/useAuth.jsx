import { useStoreAuth } from "../store";

export default function useAuth() {
  const context = useStoreAuth();
  const sessionContext = context?.client?.useSession();

  const { error: sessionError, isPending, isRefetching, refetch } = sessionContext || {};
  const { user, session } = sessionContext?.data || {};

  const login = async (email, password) => {
    const { data, error } = await context.client.signIn.email({ email, password });
    if (error) throw error;

    return data;
  };

  const logout = async () => {
    await context.client.signOut({
      fetchOptions: {
        onSuccess: () => {
          localStorage.removeItem('pn');
          window.location.href = "/auth/login"
        }
      },
    });
  };
  

  return {
    ...context,
    login,
    logout,
    error: sessionError,
    isPending,
    isRefetching,
    refetch,
    user,
    session,
  };
}
