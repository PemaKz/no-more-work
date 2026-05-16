import AuthView from "../../views/auth";
import NotLoggedMiddleware from "../../middlewares/NotLoggedMiddleware";

export default [
  {
    name: "Auth Login",
    path: "/",
    component: AuthView,
    middlewares: [NotLoggedMiddleware],
  }
]