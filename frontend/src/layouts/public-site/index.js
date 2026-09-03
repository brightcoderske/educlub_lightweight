import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import HeroShowcase from "layouts/landing/HeroShowcase";
import HomeSections, { HomeClosing } from "./HomeSections";
import eduClubLogo from "assets/images/brand/educlub-logo.png";
import { getPublicPage, PUBLIC_NAV, PUBLIC_PAGES, SITE_CONTACT } from "./publicPages";
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
        py={{ xs: 1, md: 0.75 }}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
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
            width="36"
            height="36"
            style={{ width: 36, height: 36, marginRight: 8 }}
          />
          <MDTypography component="span" variant="h5" fontWeight="bold" color="dark">
            eduClub
          </MDTypography>
        </MDBox>

        {/* Inline from md up, so the whole header is one row rather than two. */}
        <MDBox
          component="nav"
          aria-label="Public website"
          display={{ xs: "none", md: "flex" }}
          alignItems="center"
          gap={0.25}
          flex={1}
          justifyContent="center"
          sx={{ minWidth: 0 }}
        >
          {PUBLIC_NAV.primary.map((item) => (
            <MDButton
              key={item.path}
              variant={pathname === item.path ? "gradient" : "text"}
              color={pathname === item.path ? "info" : "dark"}
              size="small"
              onClick={() => navigate(item.path)}
              sx={{ whiteSpace: "nowrap", minWidth: "auto", px: 1 }}
            >
              {item.label}
            </MDButton>
          ))}
        </MDBox>

        <MDBox display="flex" alignItems="center" gap={{ xs: 0.5, sm: 1 }} flexShrink={0}>
          <MDButton variant="outlined" color="info" size="small" onClick={() => navigate("/login")}>
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
        display={{ xs: "flex", md: "none" }}
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

  // Grouped by what a visitor is trying to do, and every path is a real public
  // route. A column of dead links is worse than a shorter footer.
  const columns = [
    [
      "Learn",
      [
        ["Courses", "/courses"],
        ["My Typing Tutor", "/typing"],
        ["Quizzes", "/quizzes"],
        ["Competitions", "/competitions"],
        ["Holiday Bootcamps", "/holiday-bootcamps"],
      ],
    ],
    [
      "For Schools",
      [
        ["Overview", "/for-schools"],
        ["Register a learner", "/register"],
        ["Log in", "/login"],
      ],
    ],
    [
      "About",
      [
        ["About us", "/about"],
        ["Contact", "/contact"],
        ["Privacy", "/privacy"],
        ["User agreement", "/user-agreement"],
      ],
    ],
  ];

  return (
    <MDBox component="footer" bgColor="dark" px={{ xs: 2, md: 6 }} py={{ xs: 4, md: 5 }}>
      <Grid container spacing={{ xs: 3, md: 4 }}>
        <Grid item xs={12} md={4}>
          <MDBox display="flex" alignItems="center" gap={1} mb={1}>
            <img
              src={eduClubLogo}
              alt="eduClub logo"
              width="32"
              height="32"
              style={{ width: 32, height: 32 }}
            />
            <MDTypography component="p" variant="h5" color="white" fontWeight="bold">
              eduClub
            </MDTypography>
          </MDBox>
          <MDTypography variant="body2" color="white" lineHeight={1.7} sx={{ opacity: 0.82 }}>
            Practical digital skills, progressive courses and engaging learning tools for children,
            schools and academies in Kenya.
          </MDTypography>

          <MDBox mt={2}>
            <MDTypography variant="button" color="white" fontWeight="bold" display="block">
              Contact
            </MDTypography>
            <MDTypography
              component="a"
              href={SITE_CONTACT.emailHref}
              variant="body2"
              color="white"
              display="block"
              mt={0.5}
              sx={{ opacity: 0.82 }}
            >
              {SITE_CONTACT.email}
            </MDTypography>
            <MDTypography
              component="a"
              href={SITE_CONTACT.phoneHref}
              variant="body2"
              color="white"
              display="block"
              mt={0.25}
              sx={{ opacity: 0.82 }}
            >
              {SITE_CONTACT.phoneInternational}
            </MDTypography>
          </MDBox>
        </Grid>

        {columns.map(([heading, links]) => (
          <Grid item xs={6} md={2.6} key={heading}>
            <MDTypography variant="button" color="white" fontWeight="bold" display="block" mb={1}>
              {heading}
            </MDTypography>
            {links.map(([label, path]) => (
              <MDBox
                key={path}
                component="button"
                type="button"
                onClick={() => navigate(path)}
                sx={{
                  display: "block",
                  border: 0,
                  bgcolor: "transparent",
                  p: 0,
                  mb: 0.85,
                  font: "inherit",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.82)",
                  fontSize: "0.82rem",
                  "&:hover": { color: "#fff", textDecoration: "underline" },
                }}
              >
                {label}
              </MDBox>
            ))}
          </Grid>
        ))}
      </Grid>

      <MDBox
        mt={4}
        pt={2}
        sx={{ borderTop: "1px solid rgba(255,255,255,0.14)" }}
        display="flex"
        flexWrap="wrap"
        gap={1}
        justifyContent="space-between"
      >
        <MDTypography variant="caption" color="white" sx={{ opacity: 0.7 }}>
          &copy; {new Date().getFullYear()} eduClub. Empowering learners with digital skills for a
          brighter future.
        </MDTypography>
        <MDTypography variant="caption" color="white" sx={{ opacity: 0.7 }}>
          Nairobi, Kenya
        </MDTypography>
      </MDBox>
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
                <MDTypography variant="body2" mt={1} lineHeight={1.6} sx={{ color: "#455a64" }}>
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

// Only the home page gets the photographic hero. Every other public page keeps
// the light editorial layout, which suits long-form copy better and keeps the
// heaviest asset off pages that do not need it.
const HERO_SHOWCASE = "/hero-learners-1200.webp";

const HERO_STATS = [
  ["100,000+", "Learners"],
  ["2,000+", "Schools"],
  ["50+", "Counties"],
];

export default function PublicSite() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { path, page } = getPublicPage(pathname);
  usePublicSeo(pathname);

  if (!page) return <PublicNotFound />;

  const isHome = page.type === "home";

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
        <MDBox
          sx={
            isHome
              ? {
                  backgroundColor: "#0a0f2c",
                  backgroundImage:
                    "radial-gradient(circle at 82% 18%, rgba(124,58,237,0.42), transparent 46%)," +
                    "radial-gradient(circle at 8% 92%, rgba(37,99,235,0.30), transparent 44%)",
                  // 58px is the one-row header. The hero fills what is left of
                  // the first screen and stops there, so the section beneath it
                  // is always the next thing a visitor scrolls to.
                  minHeight: { md: "calc(100vh - 58px)" },
                  display: "flex",
                  alignItems: "center",
                }
              : undefined
          }
        >
          <MDBox
            px={{ xs: 2, md: 6, lg: 10 }}
            py={{ xs: isHome ? 3.5 : 6, md: isHome ? 4 : 9 }}
            maxWidth="1440px"
            mx="auto"
            width="100%"
          >
            <Grid container spacing={{ xs: 4, lg: 6 }} alignItems="center">
              <Grid item xs={12} lg={isHome ? 6 : 12}>
                <Chip
                  label={page.eyebrow}
                  color="info"
                  size="small"
                  sx={isHome ? { color: "#fff" } : undefined}
                />
                {/* h1, intro and CTAs are unchanged: they carry the page's
                    search value and are set per route in publicPages.js. */}
                <MDTypography
                  component="h1"
                  variant="h1"
                  fontWeight="bold"
                  mt={2}
                  sx={{
                    maxWidth: 980,
                    fontSize: isHome
                      ? { xs: "1.8rem", sm: "2.4rem", md: "3.5rem" }
                      : { xs: "2.35rem", md: "4rem" },
                    lineHeight: isHome ? 1.14 : 1.08,
                    ...(isHome && { color: "#ffffff" }),
                  }}
                >
                  {page.h1}
                </MDTypography>
                <MDTypography
                  component="p"
                  variant="h5"
                  mt={isHome ? 1.5 : 2.5}
                  sx={{
                    maxWidth: 900,
                    color: isHome ? "#c3c8e8" : "#455a64",
                    ...(isHome && {
                      fontSize: { xs: "0.92rem", sm: "1.05rem", md: "1.25rem" },
                      lineHeight: 1.55,
                    }),
                    ...(!isHome && { lineHeight: 1.65 }),
                  }}
                >
                  {page.intro}
                </MDTypography>
                <MDBox display="flex" flexWrap="wrap" gap={1.25} mt={isHome ? 2.5 : 3.5}>
                  <ActionButton action={page.primaryCta} size="large" />
                  {page.secondaryCta && (
                    <ActionButton
                      action={page.secondaryCta}
                      color={isHome ? "white" : "info"}
                      variant="outlined"
                      size="large"
                    />
                  )}
                  {page.tertiaryCta && (
                    <ActionButton
                      action={page.tertiaryCta}
                      color={isHome ? "white" : "dark"}
                      variant="text"
                      size="large"
                    />
                  )}
                </MDBox>

                {isHome && (
                  <MDBox
                    display="flex"
                    flexWrap="wrap"
                    gap={{ xs: 3, sm: 5 }}
                    mt={{ xs: 3, md: 5 }}
                  >
                    {HERO_STATS.map(([value, label]) => (
                      <MDBox key={label}>
                        <MDTypography
                          variant="h4"
                          sx={{ color: "#fff", fontWeight: 800, lineHeight: 1.1 }}
                        >
                          {value}
                        </MDTypography>
                        <MDTypography variant="caption" sx={{ color: "#9aa0c9" }}>
                          {label}
                        </MDTypography>
                      </MDBox>
                    ))}
                  </MDBox>
                )}
              </Grid>

              {isHome && (
                <Grid item xs={12} lg={6}>
                  <MDBox
                    sx={{
                      // No horizontal bleed: the group has to sit whole inside
                      // the column. Bleeding it past the gutter clipped the
                      // learner on the right against the viewport edge.
                      mt: { xs: 2, lg: -3 },
                      mb: { xs: -1, lg: -5 },
                    }}
                  >
                    <HeroShowcase
                      image={HERO_SHOWCASE}
                      alt="eduClub learners working together at a laptop"
                    />
                  </MDBox>
                </Grid>
              )}
            </Grid>
          </MDBox>
        </MDBox>

        {isHome && <HomeSections />}

        <MDBox px={{ xs: 2, md: 6, lg: 10 }} pt={0} pb={isHome ? 0 : 8} maxWidth="1440px" mx="auto">
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

          {!isHome && page.related?.length > 0 && (
            <MDBox mt={6}>
              <MDTypography component="h2" variant="h3" fontWeight="bold" mb={2}>
                Keep exploring eduClub
              </MDTypography>
              <RelatedPages paths={page.related} />
            </MDBox>
          )}

          {!isHome && (
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
          )}

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
      {isHome && <HomeClosing />}
      <PublicFooter />
    </MDBox>
  );
}
