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

// prop-types is a library for typechecking of props
import PropTypes from "prop-types";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React base styles
import typography from "assets/theme/base/typography";

function Footer() {
  const { size } = typography;
  const links = [
    { label: "Dashboard", href: "/learner" },
    { label: "My Courses", href: "/learner/courses" },
    { label: "Certificates", href: "/learner/certificates" },
    { label: "Help", href: "/contact" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/user-agreement" },
    { label: "contact", href: "mailto:support@educlub.co.ke" },
    { label: "share", href: "https://www.educlub.co.ke" },
  ];

  return (
    <MDBox
      width="100%"
      display="flex"
      flexDirection={{ xs: "column", lg: "row" }}
      justifyContent="space-between"
      alignItems="center"
      px={1.5}
      py={2}
      mt={3}
      borderTop="1px solid"
      borderColor="grey.200"
    >
      <MDBox
        display="flex"
        justifyContent="center"
        alignItems="center"
        flexWrap="wrap"
        color="text"
        fontSize={size.sm}
        px={1.5}
      >
        <MDTypography variant="caption" color="text" fontStyle="italic">
          Every expert was once a beginner.
        </MDTypography>
        <MDTypography variant="caption" color="text" ml={1}>
          &copy; 2026 EduClub &bull; Developed by Bright Coders
        </MDTypography>
      </MDBox>
      <MDBox
        component="ul"
        sx={({ breakpoints }) => ({
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          listStyle: "none",
          mt: 3,
          mb: 0,
          p: 0,

          [breakpoints.up("lg")]: {
            mt: 0,
          },
        })}
      >
        {links.map((link) => (
          <MDBox component="li" px={1.1} lineHeight={1} key={link.label}>
            <MDTypography
              component="a"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              variant="button"
              fontWeight="regular"
              color="text"
              sx={{ textDecoration: "none" }}
            >
              {link.label}
            </MDTypography>
          </MDBox>
        ))}
      </MDBox>
    </MDBox>
  );
}

export default Footer;
