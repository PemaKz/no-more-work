import { useCallback, useEffect, useState } from "react";
import { useStoreAuth } from "../store";
import useAuth from "./useAuth";

export default function useOrganization() {
  const { client } = useStoreAuth();
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id || null;

  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!orgId) {
      setMembers([]);
      setInvitations([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        client.organization.listMembers({
          query: { organizationId: orgId, limit: 100 },
        }),
        client.organization.listInvitations({ query: { organizationId: orgId } }),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (invitesRes.error) throw invitesRes.error;
      // listMembers devuelve { members, total }; listInvitations devuelve array.
      setMembers(membersRes.data?.members || []);
      setInvitations(
        (invitesRes.data || []).filter((inv) => inv.status === "pending")
      );
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [client, orgId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const invite = useCallback(
    async ({ email, role }) => {
      const { data, error: err } = await client.organization.inviteMember({
        email,
        role,
        // organizationId queda implícito por la session activa
      });
      if (err) throw err;
      setInvitations((xs) => {
        const without = xs.filter((x) => x.id !== data.id);
        return [...without, data];
      });
      return data;
    },
    [client]
  );

  const cancelInvitation = useCallback(
    async (invitationId) => {
      const { error: err } = await client.organization.cancelInvitation({
        invitationId,
      });
      if (err) throw err;
      setInvitations((xs) => xs.filter((x) => x.id !== invitationId));
    },
    [client]
  );

  const updateMemberRole = useCallback(
    async (memberId, role) => {
      const { data, error: err } = await client.organization.updateMemberRole({
        memberId,
        role,
      });
      if (err) throw err;
      setMembers((xs) =>
        xs.map((m) =>
          m.id === memberId ? { ...m, role: data?.role ?? role } : m
        )
      );
      return data;
    },
    [client]
  );

  const removeMember = useCallback(
    async (memberIdOrEmail) => {
      const { error: err } = await client.organization.removeMember({
        memberIdOrEmail,
      });
      if (err) throw err;
      setMembers((xs) =>
        xs.filter((m) => m.id !== memberIdOrEmail && m.user?.email !== memberIdOrEmail)
      );
    },
    [client]
  );

  const updateOrganization = useCallback(
    async ({ name, slug, logo }) => {
      const data = {};
      if (typeof name === "string") data.name = name;
      if (typeof slug === "string") data.slug = slug;
      if (typeof logo === "string") data.logo = logo;
      const { data: updated, error: err } = await client.organization.update({
        data,
      });
      if (err) throw err;
      return updated;
    },
    [client]
  );

  const deleteOrganization = useCallback(
    async (organizationId) => {
      const targetId = organizationId || orgId;
      if (!targetId) throw new Error("No hay organización activa");
      const { error: err } = await client.organization.delete({
        organizationId: targetId,
      });
      if (err) throw err;
    },
    [client, orgId]
  );

  const buildInvitationUrl = useCallback((invitationId) => {
    return `${window.location.origin}/invitation/${invitationId}`;
  }, []);

  return {
    members,
    invitations,
    isLoading,
    error,
    refetch: fetchAll,
    invite,
    cancelInvitation,
    removeMember,
    updateMemberRole,
    updateOrganization,
    deleteOrganization,
    buildInvitationUrl,
  };
}
