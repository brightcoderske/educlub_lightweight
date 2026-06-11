import PropTypes from "prop-types";

import MDAvatar from "components/MDAvatar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { getRoleLabel, getUserDisplayName, getUserInitials } from "lib/userDisplay";

function DashboardIdentity({ user, title, subtitle }) {
  return (
    <MDBox
      display="flex"
      alignItems="center"
      gap={{ xs: 1.25, sm: 2 }}
      minWidth={0}
      width={{ xs: "100%", sm: "auto" }}
    >
      <MDAvatar
        bgColor="info"
        size="lg"
        shadow="md"
        sx={{ width: { xs: 54, sm: 74 }, height: { xs: 54, sm: 74 }, flexShrink: 0 }}
      >
        {getUserInitials(user)}
      </MDAvatar>
      <MDBox minWidth={0}>
        <MDTypography
          variant="h3"
          fontWeight="bold"
          sx={{ fontSize: { xs: "1.65rem", sm: "1.875rem" }, lineHeight: 1.15 }}
        >
          {title}
        </MDTypography>
        <MDTypography
          variant="body2"
          color="text"
          mt={0.5}
          sx={{ fontSize: { xs: "0.875rem", sm: "1rem" }, lineHeight: 1.35 }}
        >
          {subtitle || `Welcome back, ${getUserDisplayName(user)} (${getRoleLabel(user?.role)})`}
        </MDTypography>
      </MDBox>
    </MDBox>
  );
}

DashboardIdentity.defaultProps = {
  subtitle: "",
};

DashboardIdentity.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    fullName: PropTypes.string,
    full_name: PropTypes.string,
    role: PropTypes.string,
    username: PropTypes.string,
  }).isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
};

export default DashboardIdentity;
