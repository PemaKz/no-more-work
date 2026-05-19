import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function OrgRequiredMiddleware({ children }) {
  const { organizations, organizationsPending } = useAuth();

  if (organizationsPending) return null;
  if (organizations.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

OrgRequiredMiddleware.propTypes = {
  children: PropTypes.node.isRequired,
};
