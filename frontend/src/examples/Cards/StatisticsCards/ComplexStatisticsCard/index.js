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
import { Link } from "react-router-dom";

// @mui material components
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function ComplexStatisticsCard({ color, title, count, percentage, icon, to }) {
  return (
    <Card
      component={to ? Link : "div"}
      to={to}
      sx={{
        height: "100%",
        border: "1px solid #e8edf2",
        boxShadow: "0 2px 6px rgba(20, 35, 60, 0.04)",
        ...(to && {
          "&:hover": { borderColor: "#94b9ef" },
          "&:focus-visible": { outline: "2px solid #2563eb" },
        }),
      }}
    >
      <MDBox display="flex" justifyContent="space-between" alignItems="center" gap={1.25} p={1.5}>
        <MDBox
          borderRadius="md"
          display="flex"
          justifyContent="center"
          alignItems="center"
          width="2.25rem"
          height="2.25rem"
          flexShrink={0}
          sx={(theme) => ({
            borderRadius: "8px",
            bgcolor: "#eef4fb",
            color: theme.palette[color]?.main || "#175cd3",
          })}
        >
          <Icon fontSize="small" color="inherit">
            {icon}
          </Icon>
        </MDBox>
        <MDBox textAlign="right" lineHeight={1.25} minWidth={0}>
          <MDTypography variant="caption" fontWeight="medium" color="text">
            {title}
          </MDTypography>
          <MDTypography variant="h4" sx={{ fontSize: "1.35rem", lineHeight: 1.3 }}>
            {count}
          </MDTypography>
        </MDBox>
      </MDBox>
      {(percentage.amount || percentage.label) && (
        <MDBox pb={1.25} px={1.5}>
          <MDTypography component="p" variant="caption" color="text">
            <MDTypography
              component="span"
              variant="caption"
              fontWeight="bold"
              color={percentage.color}
            >
              {percentage.amount}
            </MDTypography>
            &nbsp;{percentage.label}
          </MDTypography>
        </MDBox>
      )}
    </Card>
  );
}

// Setting default values for the props of ComplexStatisticsCard
ComplexStatisticsCard.defaultProps = {
  color: "info",
  percentage: {
    color: "success",
    text: "",
    label: "",
  },
};

// Typechecking props for the ComplexStatisticsCard
ComplexStatisticsCard.propTypes = {
  color: PropTypes.oneOf([
    "primary",
    "secondary",
    "info",
    "success",
    "warning",
    "error",
    "light",
    "dark",
  ]),
  title: PropTypes.string.isRequired,
  count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  percentage: PropTypes.shape({
    color: PropTypes.oneOf([
      "primary",
      "secondary",
      "info",
      "success",
      "warning",
      "error",
      "dark",
      "white",
    ]),
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    label: PropTypes.string,
  }),
  icon: PropTypes.node.isRequired,
  to: PropTypes.string,
};

export default ComplexStatisticsCard;
