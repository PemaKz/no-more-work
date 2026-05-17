import PanelDashboardView from "../../views/panel/dashboard";
import PanelSettingsView from "../../views/panel/settings";
import LoggedMiddleware from "../../middlewares/LoggedMiddleware";

export default [
  {
    name: "Panel Dashboard",
    path: "/dashboard",
    component: PanelDashboardView,
    middlewares: [LoggedMiddleware],
  },
  {
    name: "Panel Settings",
    path: "/settings",
    component: PanelSettingsView,
    middlewares: [LoggedMiddleware],
  },
];
