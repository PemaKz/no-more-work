import { create } from "zustand";
import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";

export const useStoreAuth = create((set) => ({
  client: createAuthClient({
    plugins: [adminClient(), organizationClient()],
    baseURL: `${import.meta.env.VITE_API_BASE}/api/auth/`,
  }),

  setClient: (client) => set({ client }),
}));
