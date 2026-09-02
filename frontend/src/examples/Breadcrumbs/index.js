/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { buildDashboardBreadcrumbs } from "./navigation";

function Breadcrumbs({ icon, title, route }) {
  const { homePath, items } = buildDashboardBreadcrumbs(route);
  const parents = items.filter((item) => item.clickable && item.path !== homePath);

  return (
    <MDBox
      component="nav"
      aria-label="Breadcrumb"
      display="flex"
      alignItems="center"
      gap={0.75}
      minWidth={0}
    >
      <MDBox
        component={Link}
        to={homePath}
        aria-label="Dashboard home"
        display="inline-flex"
        sx={{ color: "#64748b", flexShrink: 0 }}
      >
        <Icon sx={{ fontSize: "18px !important" }}>{icon}</Icon>
      </MDBox>
      {parents.map((item) => (
        <MDBox
          key={item.path}
          display={{ xs: "none", md: "inline-flex" }}
          alignItems="center"
          gap={0.75}
          minWidth={0}
        >
          <MDTypography component="span" variant="caption" color="text" aria-hidden="true">
            /
          </MDTypography>
          <MDTypography
            component={Link}
            to={item.path}
            variant="caption"
            color="text"
            textTransform="capitalize"
            noWrap
          >
            {item.label}
          </MDTypography>
        </MDBox>
      ))}
      <MDTypography component="span" variant="caption" color="text" aria-hidden="true">
        /
      </MDTypography>
      <MDTypography
        component="h1"
        variant="h6"
        fontWeight="bold"
        aria-current="page"
        noWrap
        sx={{ fontSize: { xs: "0.94rem", sm: "1.05rem" }, lineHeight: 1.35 }}
      >
        {title}
      </MDTypography>
    </MDBox>
  );
}

Breadcrumbs.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.node.isRequired,
  route: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
};

export default Breadcrumbs;
