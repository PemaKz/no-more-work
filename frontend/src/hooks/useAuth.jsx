import { useStoreAuth } from "../store";

export default function useAuth() {
  const context = useStoreAuth();
  const sessionContext = context?.client?.useSession();
  const activeOrgContext = context?.client?.useActiveOrganization?.();
  const organizationsContext = context?.client?.useListOrganizations?.();
  const activeMemberContext = context?.client?.useActiveMember?.();

  const { error: sessionError, isPending, isRefetching, refetch } = sessionContext || {};
  const { user, session } = sessionContext?.data || {};

  const activeOrganization = activeOrgContext?.data || null;
  const activeOrganizationPending = activeOrgContext?.isPending || false;
  const refetchActiveOrganization = activeOrgContext?.refetch;
  const organizations = organizationsContext?.data || [];
  const organizationsPending = organizationsContext?.isPending || false;
  const refetchOrganizations = organizationsContext?.refetch;
  const activeMember = activeMemberContext?.data || null;
  const activeMemberPending = activeMemberContext?.isPending || false;

  // Better Auth almacena roles como cadena separada por comas ("admin,member").
  const roles = (activeMember?.role || "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const isOwner = roles.includes("owner");
  const isAdmin = isOwner || roles.includes("admin");

  const login = async (email, password) => {
    const { data, error } = await context.client.signIn.email({ email, password });
    if (error) throw error;

    return data;
  };

  const signup = async ({ email, password, name }) => {
    const { data, error } = await context.client.signUp.email({
      email,
      password,
      name: name || email.split("@")[0],
    });
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
    signup,
    logout,
    error: sessionError,
    isPending,
    isRefetching,
    refetch,
    user,
    session,
    activeOrganization,
    activeOrganizationPending,
    refetchActiveOrganization,
    organizations,
    organizationsPending,
    refetchOrganizations,
    activeMember,
    activeMemberPending,
    activeMemberRole: activeMember?.role || null,
    isOwner,
    isAdmin,
    createOrganization,
    setActiveOrganization,
  };
}
