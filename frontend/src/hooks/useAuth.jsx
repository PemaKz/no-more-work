import { useStoreAuth } from "../store";

export default function useAuth() {
  const context = useStoreAuth();
  const sessionContext = context?.client?.useSession();
  const activeOrgContext = context?.client?.useActiveOrganization?.();
  const organizationsContext = context?.client?.useListOrganizations?.();

  const { error: sessionError, isPending, isRefetching, refetch } = sessionContext || {};
  const { user, session } = sessionContext?.data || {};

  const activeOrganization = activeOrgContext?.data || null;
  const activeOrganizationPending = activeOrgContext?.isPending || false;
  const organizations = organizationsContext?.data || [];
  const organizationsPending = organizationsContext?.isPending || false;

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

  const createOrganization = async ({ name, slug }) => {
    const { data, error } = await context.client.organization.create({
      name,
      slug,
    });
    if (error) throw error;
    return data;
  };

  const setActiveOrganization = async (organizationId) => {
    const { data, error } = await context.client.organization.setActive({
      organizationId,
    });
    if (error) throw error;
    return data;
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
    activeOrganization,
    activeOrganizationPending,
    organizations,
    organizationsPending,
    createOrganization,
    setActiveOrganization,
  };
}
