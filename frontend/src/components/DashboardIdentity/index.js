import PropTypes from "prop-types";

import MDAvatar from "components/MDAvatar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { getRoleLabel, getUserDisplayName, getUserInitials } from "lib/userDisplay";

function DashboardIdentity({ user, title, subtitle }) {
  return (
    // The navbar above already carries the avatar, name and school - role line,
    // so this block stays a compact page heading rather than a second identity
    // card. Every dashboard renders it, so the height saved here is per page.
    <MDBox
      display="flex"
      alignItems="center"
      gap={{ xs: 1, sm: 1.25 }}
      minWidth={0}
      width={{ xs: "100%", sm: "auto" }}
    >
      <MDAvatar
        bgColor="info"
        size="sm"
        shadow="sm"
        sx={{ width: { xs: 24, sm: 26 }, height: { xs: 24, sm: 26 }, flexShrink: 0 }}
      >
        {getUserInitials(user)}
      </MDAvatar>
      <MDBox minWidth={0}>
        <MDTypography
          variant="h5"
          fontWeight="bold"
          sx={{ fontSize: { xs: "0.9375rem", sm: "1rem" }, lineHeight: 1.15 }}
        >
          {title}
        </MDTypography>
        <MDTypography
          variant="body2"
          color="text"
          sx={{ fontSize: { xs: "0.6875rem", sm: "0.75rem" }, lineHeight: 1.25 }}
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
