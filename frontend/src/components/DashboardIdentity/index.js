import PropTypes from "prop-types";

import MDAvatar from "components/MDAvatar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { getRoleLabel, getUserDisplayName, getUserInitials } from "lib/userDisplay";

function DashboardIdentity({ user, title, subtitle }) {
  return (
    <MDBox display="flex" alignItems="center" gap={2}>
      <MDAvatar bgColor="info" size="lg" shadow="md">
        {getUserInitials(user)}
      </MDAvatar>
      <MDBox>
        <MDTypography variant="h3" fontWeight="bold">
          {title}
        </MDTypography>
        <MDTypography variant="body2" color="text" mt={0.5}>
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
