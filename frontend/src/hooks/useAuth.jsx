import { useStoreAuth } from "../store";

export default function useAuth() {
  const context = useStoreAuth();
  const sessionContext = context?.client?.useSession();
  const activeOrgContext = context?.client?.useActiveOrganization?.();
  const organizationsContext = context?.client?.useListOrganizations?.();

  const { error: sessionError, isPending, isRefetching, refetch } = sessionContext || {};
  const { user, session } = sessionContext?.data || {};

  const activeOrganization = activeOrgContext?.data || null;
  const organizations = organizationsContext?.data || [];
  const organizationsPending = organizationsContext?.isPending || false;

  // El plugin `organization` no invalida su atom $listOrg al iniciar sesión
  // (solo al crear/borrar/actualizar orgs). Si no forzamos un refetch tras el
  // login, la lista queda vacía hasta que el usuario interactúe. Exponemos
  // las funciones de refetch para que el AuthView las llame post-login.
  const refetchOrganizations = organizationsContext?.refetch;
  const refetchActiveOrganization = activeOrgContext?.refetch;

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
    organizations,
    organizationsPending,
    createOrganization,
    setActiveOrganization,
    refetchOrganizations,
    refetchActiveOrganization,
  };
}
