import PanelDashboardView from "../../views/panel/dashboard";
import PanelSettingsView from "../../views/panel/settings";
import LoggedMiddleware from "../../middlewares/LoggedMiddleware";
import OrgRequiredMiddleware from "../../middlewares/OrgRequiredMiddleware";

export default [
  {
    name: "Panel Dashboard",
    path: "/dashboard",
    component: PanelDashboardView,
    middlewares: [LoggedMiddleware, OrgRequiredMiddleware],
  },
  {
    name: "Panel Settings",
    path: "/settings",
    component: PanelSettingsView,
    middlewares: [LoggedMiddleware, OrgRequiredMiddleware],
  },
];
