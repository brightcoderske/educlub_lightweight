import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import eduClubLogo from "assets/images/brand/educlub-logo.png";
import {
  getPublicPage,
  PUBLIC_NAV,
  PUBLIC_PAGES,
  SITE_CONTACT,
} from "./publicPages";
import usePublicSeo from "./usePublicSeo";

function ActionButton({ action, color = "info", variant = "gradient", size = "medium" }) {
  const navigate = useNavigate();
  const external = /^(https?:|mailto:|tel:)/.test(action.path);
  return (
    <MDButton
      component={external ? "a" : "button"}
      href={external ? action.path : undefined}
      target={action.path.startsWith("https://wa.me") ? "_blank" : undefined}
      rel={action.path.startsWith("https://wa.me") ? "noopener noreferrer" : undefined}
      variant={variant}
      color={color}
      size={size}
      onClick={external ? undefined : () => navigate(action.path)}
    >
      {action.label}
    </MDButton>
  );
}

ActionButton.propTypes = {
  action: PropTypes.shape({
    label: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
  }).isRequired,
  color: PropTypes.string,
  variant: PropTypes.string,
  size: PropTypes.string,
};

function PublicHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <MDBox
      component="header"
      position="sticky"
      top={0}
      zIndex={1100}
      bgColor="white"
      sx={{ borderBottom: "1px solid #e5e7eb" }}
    >
      <MDBox
        px={{ xs: 1.5, md: 4 }}
        py={1.25}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        <MDBox
          component="button"
          type="button"
          display="flex"
          alignItems="center"
          border={0}
          bgColor="transparent"
          p={0}
          sx={{ cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          <img
            src={eduClubLogo}
            alt="eduClub logo"
            width="42"
            height="42"
            style={{ width: 42, height: 42, marginRight: 8 }}
          />
          <MDTypography component="span" variant="h5" fontWeight="bold" color="dark">
            eduClub
          </MDTypography>
        </MDBox>

        <MDBox display="flex" alignItems="center" gap={{ xs: 0.5, sm: 1 }}>
          <MDButton
            variant="outlined"
            color="info"
            size="small"
            onClick={() => navigate("/login")}
          >
            Log In
          </MDButton>
          <MDButton
            variant="gradient"
            color="warning"
            size="small"
            onClick={() => navigate("/register")}
          >
            Register
          </MDButton>
        </MDBox>
      </MDBox>

      <MDBox
        component="nav"
        aria-label="Public website"
        px={{ xs: 1.5, md: 4 }}
        pb={1}
        display="flex"
        gap={0.5}
        sx={{
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {PUBLIC_NAV.primary.map((item) => (
          <MDButton
            key={item.path}
            variant={pathname === item.path ? "gradient" : "text"}
            color={pathname === item.path ? "info" : "dark"}
            size="small"
            onClick={() => navigate(item.path)}
            sx={{ whiteSpace: "nowrap", minWidth: "auto" }}
          >
            {item.label}
          </MDButton>
        ))}
      </MDBox>
    </MDBox>
  );
}

function PublicFooter() {
  const navigate = useNavigate();
  const footerLinks = [
    { label: "About", path: "/about" },
    { label: "Contact", path: "/contact" },
    { label: "Privacy", path: "/privacy" },
    { label: "User Agreement", path: "/user-agreement" },
    { label: "Log In", path: "/login" },
    { label: "Register", path: "/register" },
  ];

  return (
    <MDBox component="footer" bgColor="dark" px={{ xs: 2, md: 6 }} py={4}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <MDTypography component="p" variant="h5" color="white" fontWeight="bold">
            eduClub
          </MDTypography>
          <MDTypography variant="body2" color="white" mt={1} lineHeight={1.7}>
            Practical digital skills, progressive courses and engaging learning tools for children,
            schools and academies in Kenya.
          </MDTypography>
        </Grid>
        <Grid item xs={12} md={4}>
          <MDTypography variant="button" color="white" fontWeight="bold">
            Quick links
          </MDTypography>
          <MDBox display="flex" flexWrap="wrap" gap={0.5} mt={1}>
            {footerLinks.map((item) => (
              <MDButton
                key={item.path}
                variant="text"
                color="white"
                size="small"
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </MDButton>
            ))}
          </MDBox>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDTypography variant="button" color="white" fontWeight="bold">
            Contact
          </MDTypography>
          <MDTypography
            component="a"
            href={SITE_CONTACT.emailHref}
            variant="body2"
            color="white"
            display="block"
            mt={1}
          >
            {SITE_CONTACT.email}
          </MDTypography>
          <MDTypography
            component="a"
            href={SITE_CONTACT.phoneHref}
            variant="body2"
            color="white"
            display="block"
            mt={0.5}
          >
            {SITE_CONTACT.phoneInternational}
          </MDTypography>
        </Grid>
      </Grid>
    </MDBox>
  );
}

function RelatedPages({ paths }) {
  const navigate = useNavigate();
  if (!paths?.length) return null;

  return (
    <Grid container spacing={2}>
      {paths.map((path) => {
        const related = PUBLIC_PAGES[path];
        if (!related) return null;
        return (
          <Grid item xs={12} sm={6} lg={4} key={path}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={2.5}>
                <MDTypography component="h3" variant="h6" fontWeight="bold">
                  {related.h1}
                </MDTypography>
                <MDTypography
                  variant="body2"
                  mt={1}
                  lineHeight={1.6}
                  sx={{ color: "#455a64" }}
                >
                  {related.description}
                </MDTypography>
                <MDButton
                  variant="text"
                  color="info"
                  sx={{ mt: 1.5, px: 0 }}
                  onClick={() => navigate(path)}
                >
                  Learn more <Icon>arrow_forward</Icon>
                </MDButton>
              </MDBox>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

RelatedPages.propTypes = {
  paths: PropTypes.arrayOf(PropTypes.string),
};

export function PublicNotFound() {
  const navigate = useNavigate();
  usePublicSeo("/not-found");
  return (
    <MDBox minHeight="100vh" bgColor="grey-100">
      <PublicHeader />
      <MDBox px={2} py={10} textAlign="center">
        <MDTypography variant="h1" fontWeight="bold">
          Page not found
        </MDTypography>
        <MDTypography variant="body1" color="text" mt={2}>
          The page may have moved. Explore eduClub courses or return to the homepage.
        </MDTypography>
        <MDButton variant="gradient" color="info" sx={{ mt: 3 }} onClick={() => navigate("/")}>
          Return Home
        </MDButton>
      </MDBox>
      <PublicFooter />
    </MDBox>
  );
}

export default function PublicSite() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { path, page } = getPublicPage(pathname);
  usePublicSeo(pathname);

  if (!page) return <PublicNotFound />;

  return (
    <MDBox minHeight="100vh" bgColor="grey-100">
      <PublicHeader />
      <MDBox
        component="main"
        sx={{
          background:
            "radial-gradient(circle at 10% 10%, rgba(26,115,232,0.14), transparent 32%), #f8fafc",
        }}
      >
        <MDBox px={{ xs: 2, md: 6, lg: 10 }} py={{ xs: 6, md: 9 }} maxWidth="1440px" mx="auto">
          <Chip label={page.eyebrow} color="info" size="small" />
          <MDTypography
            component="h1"
            variant="h1"
            fontWeight="bold"
            mt={2}
            sx={{ maxWidth: 980, fontSize: { xs: "2.35rem", md: "4rem" }, lineHeight: 1.08 }}
          >
            {page.h1}
          </MDTypography>
          <MDTypography
            component="p"
            variant="h5"
            mt={2.5}
            lineHeight={1.65}
            sx={{ maxWidth: 900, color: "#455a64" }}
          >
            {page.intro}
          </MDTypography>
          <MDBox display="flex" flexWrap="wrap" gap={1.25} mt={3.5}>
            <ActionButton action={page.primaryCta} size="large" />
            {page.secondaryCta && (
              <ActionButton action={page.secondaryCta} color="info" variant="outlined" size="large" />
            )}
            {page.tertiaryCta && (
              <ActionButton action={page.tertiaryCta} color="dark" variant="text" size="large" />
            )}
          </MDBox>
        </MDBox>

        <MDBox px={{ xs: 2, md: 6, lg: 10 }} pb={8} maxWidth="1440px" mx="auto">
          <Grid container spacing={3}>
            {page.sections.map((item) => (
              <Grid item xs={12} md={6} key={item.title}>
                <Card sx={{ height: "100%" }}>
                  <MDBox p={{ xs: 2.5, md: 3.5 }}>
                    <MDTypography component="h2" variant="h4" fontWeight="bold">
                      {item.title}
                    </MDTypography>
                    <MDTypography
                      variant="body1"
                      mt={1.5}
                      lineHeight={1.75}
                      sx={{ color: "#455a64" }}
                    >
                      {item.body}
                    </MDTypography>
                    <MDBox mt={2}>
                      {item.points.map((point) => (
                        <MDBox key={point} display="flex" alignItems="flex-start" gap={1} mt={1}>
                          <Icon color="success" fontSize="small">
                            check_circle
                          </Icon>
                          <MDTypography variant="body2" sx={{ color: "#455a64" }}>
                            {point}
                          </MDTypography>
                        </MDBox>
                      ))}
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
            ))}
          </Grid>

          {page.faqs?.length > 0 && (
            <MDBox mt={6}>
              <MDTypography component="h2" variant="h3" fontWeight="bold" mb={2}>
                Frequently asked questions
              </MDTypography>
              <Grid container spacing={2}>
                {page.faqs.map((faq) => (
                  <Grid item xs={12} md={6} key={faq.question}>
                    <Card sx={{ height: "100%" }}>
                      <MDBox p={2.5}>
                        <MDTypography component="h3" variant="h6" fontWeight="bold">
                          {faq.question}
                        </MDTypography>
                        <MDTypography
                          variant="body2"
                          mt={1}
                          lineHeight={1.7}
                          sx={{ color: "#455a64" }}
                        >
                          {faq.answer}
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </MDBox>
          )}

          <MDBox mt={6}>
            <MDTypography component="h2" variant="h3" fontWeight="bold" mb={2}>
              Keep exploring eduClub
            </MDTypography>
            <RelatedPages paths={page.related} />
          </MDBox>

          <MDBox
            mt={7}
            p={{ xs: 3, md: 5 }}
            borderRadius="xl"
            bgColor="info"
            display="flex"
            flexDirection={{ xs: "column", md: "row" }}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
            gap={2}
          >
            <MDBox>
              <MDTypography component="h2" variant="h3" color="white" fontWeight="bold">
                Ready to start learning?
              </MDTypography>
              <MDTypography variant="body1" color="white" mt={1}>
                Register a learner, log in to continue, or talk to us about your school.
              </MDTypography>
            </MDBox>
            <MDBox display="flex" flexWrap="wrap" gap={1}>
              <MDButton variant="gradient" color="warning" onClick={() => navigate("/register")}>
                Register
              </MDButton>
              <MDButton variant="outlined" color="white" onClick={() => navigate("/login")}>
                Log In
              </MDButton>
            </MDBox>
          </MDBox>

          {path === "/contact" && (
            <MDBox display="flex" flexWrap="wrap" gap={1.5} mt={3}>
              <MDButton component="a" href={SITE_CONTACT.emailHref} variant="gradient" color="info">
                Email {SITE_CONTACT.email}
              </MDButton>
              <MDButton component="a" href={SITE_CONTACT.phoneHref} variant="outlined" color="dark">
                Call {SITE_CONTACT.phoneDisplay}
              </MDButton>
              <MDButton
                component="a"
                href={SITE_CONTACT.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                color="success"
              >
                WhatsApp
              </MDButton>
            </MDBox>
          )}
        </MDBox>
      </MDBox>
      <PublicFooter />
    </MDBox>
  );
}
