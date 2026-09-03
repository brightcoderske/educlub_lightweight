import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

/**
 * The visual bands on the home page, between the hero and the written sections.
 *
 * These sit above the existing `page.sections` copy rather than replacing it:
 * that copy carries the page's search value, so it stays exactly where it was.
 * Every card here links to a real public route.
 */

const PERSONAS = [
  ["Coder", "code", "#2563eb", "#e8f0fe", "/courses"],
  ["AI Explorer", "smart_toy", "#7c3aed", "#f1eafe", "/courses"],
  ["Web Creator", "web", "#0d9488", "#e2f7f4", "/courses"],
  ["Digital Designer", "brush", "#ea580c", "#fdeee2", "/courses"],
  ["Data Thinker", "insights", "#0891b2", "#e0f5fa", "/quizzes"],
  ["Fast Typist", "keyboard", "#db2777", "#fdeaf3", "/typing"],
];

const STEPS = [
  ["Learn", "Structured courses in Scratch, Python, web and more.", "menu_book"],
  ["Practise", "Improve with typing lessons, quizzes and challenges.", "keyboard"],
  ["Build", "Create real projects and bring your ideas to life.", "construction"],
  ["Compete", "Join competitions and represent your school.", "emoji_events"],
  ["Grow", "Earn badges and achievements as you learn.", "trending_up"],
];

const EXPLORE = [
  [
    "My Typing Tutor",
    "Build speed. Improve accuracy. Beat your personal best.",
    "Start Typing",
    "/typing",
    "linear-gradient(140deg,#2563eb,#1e40af)",
  ],
  [
    "Courses",
    "Step-by-step courses for beginners to advanced learners.",
    "Explore Courses",
    "/courses",
    "linear-gradient(140deg,#7c3aed,#4c1d95)",
  ],
  [
    "Challenges & Quizzes",
    "Test what you know with daily quizzes and challenges.",
    "Try a Quiz",
    "/quizzes",
    "linear-gradient(140deg,#059669,#065f46)",
  ],
  [
    "Competitions",
    "Represent your school. Compete. Win. Make your name.",
    "View Competitions",
    "/competitions",
    "linear-gradient(140deg,#ea580c,#9a3412)",
  ],
  [
    "Holiday Bootcamps",
    "Build something amazing during the holidays.",
    "See Bootcamps",
    "/holiday-bootcamps",
    "linear-gradient(140deg,#db2777,#9d174d)",
  ],
];

function SectionHeading({ title, subtitle }) {
  return (
    <MDBox textAlign="center" mb={3}>
      <MDTypography component="h2" variant="h3" fontWeight="bold" sx={{ color: "#101828" }}>
        {title}
      </MDTypography>
      {subtitle && (
        <MDTypography variant="body2" mt={0.75} sx={{ color: "#667085" }}>
          {subtitle}
        </MDTypography>
      )}
    </MDBox>
  );
}

const LAB_POINTS = [
  "Ready-made courses",
  "Learner progress tracking",
  "Competitions and challenges",
  "Projects and assessments",
];

// A sketch of the school dashboard, drawn rather than screenshotted so it stays
// legible at any width and costs nothing to load. The figures are sample values
// illustrating the product, like any product screenshot on a marketing page.
function DashboardSketch() {
  return (
    <MDBox
      aria-hidden
      sx={{
        borderRadius: "14px",
        border: "1px solid #2b3166",
        bgcolor: "#111634",
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(3,6,28,0.45)",
      }}
    >
      <MDBox
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: "1px solid #2b3166",
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((colour) => (
          <MDBox key={colour} sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: colour }} />
        ))}
        <MDTypography variant="caption" sx={{ color: "#8f96c9", ml: 1 }}>
          School Dashboard
        </MDTypography>
      </MDBox>

      <MDBox p={2}>
        <Grid container spacing={1.25}>
          {[
            ["1,245", "Learners"],
            ["78", "Courses"],
            ["23", "Challenges"],
            ["12", "Competitions"],
          ].map(([value, label]) => (
            <Grid item xs={6} sm={3} key={label}>
              <MDBox
                sx={{
                  p: 1.25,
                  borderRadius: "10px",
                  bgcolor: "#1a2050",
                  border: "1px solid #2b3166",
                }}
              >
                <MDTypography variant="h6" sx={{ color: "#fff", fontWeight: 800, lineHeight: 1.1 }}>
                  {value}
                </MDTypography>
                <MDTypography variant="caption" sx={{ color: "#8f96c9" }}>
                  {label}
                </MDTypography>
              </MDBox>
            </Grid>
          ))}
        </Grid>

        <MDBox
          sx={{
            mt: 1.5,
            p: 1.5,
            borderRadius: "10px",
            bgcolor: "#1a2050",
            border: "1px solid #2b3166",
          }}
        >
          <MDTypography variant="caption" sx={{ color: "#8f96c9", display: "block", mb: 1 }}>
            Learner progress
          </MDTypography>
          {/* A rising trend line, drawn as bars so it needs no chart library. */}
          <MDBox display="flex" alignItems="flex-end" gap={0.75} sx={{ height: 64 }}>
            {[28, 34, 30, 46, 52, 48, 62, 70, 66, 80, 88, 96].map((value, index) => (
              <MDBox
                key={`${value}-${index}`}
                sx={{
                  flex: 1,
                  height: `${value}%`,
                  borderRadius: "3px 3px 1px 1px",
                  background: "linear-gradient(#7dd3fc,#2563eb)",
                }}
              />
            ))}
          </MDBox>
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

function SchoolLabBand() {
  const navigate = useNavigate();

  return (
    <MDBox sx={{ bgcolor: "#0a0f2c" }}>
      <MDBox px={{ xs: 2, md: 6, lg: 10 }} py={{ xs: 5, md: 8 }} maxWidth="1440px" mx="auto">
        <Grid container spacing={{ xs: 3, md: 6 }} alignItems="center">
          <Grid item xs={12} md={6}>
            <MDTypography
              component="h2"
              variant="h3"
              fontWeight="bold"
              sx={{ color: "#fff", fontSize: { xs: "1.6rem", md: "2.2rem" }, lineHeight: 1.2 }}
            >
              Turn your computer lab into a{" "}
              <MDBox
                component="span"
                sx={{
                  background: "linear-gradient(90deg,#4cc9f0,#a78bfa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                future-skills lab.
              </MDBox>
            </MDTypography>
            <MDTypography variant="body2" mt={1.5} sx={{ color: "#c3c8e8", lineHeight: 1.6 }}>
              Everything your school needs to run an exciting coding and digital-skills programme.
            </MDTypography>

            <MDBox mt={2}>
              {LAB_POINTS.map((point) => (
                <MDBox key={point} display="flex" alignItems="center" gap={1} mt={1}>
                  <Icon sx={{ color: "#4ade80" }} fontSize="small">
                    check_circle
                  </Icon>
                  <MDTypography variant="body2" sx={{ color: "#dfe3f7" }}>
                    {point}
                  </MDTypography>
                </MDBox>
              ))}
            </MDBox>

            <MDButton
              variant="gradient"
              color="warning"
              size="large"
              sx={{ mt: 3 }}
              onClick={() => navigate("/for-schools")}
            >
              Bring eduClub to your school
            </MDButton>
          </Grid>

          <Grid item xs={12} md={6}>
            <DashboardSketch />
          </Grid>
        </Grid>
      </MDBox>
    </MDBox>
  );
}

function ClosingCta() {
  const navigate = useNavigate();

  return (
    <MDBox
      sx={{
        background: "linear-gradient(120deg,#4c1d95 0%,#1e3a8a 55%,#0e7490 100%)",
      }}
    >
      <MDBox
        px={{ xs: 2, md: 6 }}
        py={{ xs: 5, md: 7 }}
        maxWidth="900px"
        mx="auto"
        textAlign="center"
      >
        <MDTypography
          component="h2"
          variant="h3"
          fontWeight="bold"
          sx={{ color: "#fff", fontSize: { xs: "1.6rem", md: "2.3rem" }, lineHeight: 1.2 }}
        >
          Every child can create with technology.
        </MDTypography>
        <MDTypography variant="body2" mt={1.25} sx={{ color: "rgba(255,255,255,.86)" }}>
          Give them somewhere to start.
        </MDTypography>
        <MDBox display="flex" flexWrap="wrap" gap={1.25} justifyContent="center" mt={3}>
          <MDButton
            variant="gradient"
            color="warning"
            size="large"
            onClick={() => navigate("/register")}
          >
            Start learning free
          </MDButton>
          <MDButton
            variant="outlined"
            color="white"
            size="large"
            onClick={() => navigate("/for-schools")}
          >
            eduClub for schools
          </MDButton>
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

function HomeSections() {
  const navigate = useNavigate();

  return (
    <>
      <MDBox px={{ xs: 2, md: 6, lg: 10 }} py={{ xs: 5, md: 7 }} maxWidth="1440px" mx="auto">
        <SectionHeading
          title="What will you become?"
          subtitle="Explore fun paths and discover your passion."
        />
        <Grid container spacing={2}>
          {PERSONAS.map(([label, icon, colour, tint, path]) => (
            <Grid item xs={6} sm={4} md={2} key={label}>
              <Card
                sx={{
                  height: "100%",
                  cursor: "pointer",
                  transition: "transform 160ms ease, box-shadow 160ms ease",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: "0 12px 28px #1018281f" },
                  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                }}
                onClick={() => navigate(path)}
              >
                <MDBox p={2} textAlign="center">
                  <Icon
                    sx={{
                      color: colour,
                      bgcolor: tint,
                      p: 1.25,
                      width: 52,
                      height: 52,
                      borderRadius: "14px",
                      fontSize: "26px !important",
                    }}
                  >
                    {icon}
                  </Icon>
                  <MDTypography variant="button" fontWeight="bold" display="block" mt={1.25}>
                    {label}
                  </MDTypography>
                </MDBox>
              </Card>
            </Grid>
          ))}
        </Grid>
      </MDBox>

      <MDBox sx={{ bgcolor: "#f7f8fc" }}>
        <MDBox px={{ xs: 2, md: 6, lg: 10 }} py={{ xs: 5, md: 7 }} maxWidth="1440px" mx="auto">
          <SectionHeading title="One platform. Many ways to grow." />
          <Grid container spacing={2}>
            {STEPS.map(([title, body, icon], index) => (
              <Grid item xs={12} sm={6} md key={title}>
                <MDBox
                  sx={{
                    height: "100%",
                    p: 2,
                    borderRadius: "14px",
                    bgcolor: "#fff",
                    border: "1px solid #e7e9f2",
                  }}
                >
                  <MDBox display="flex" alignItems="center" gap={1} mb={1}>
                    <MDBox
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        bgcolor: "#4338ca",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: ".72rem",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </MDBox>
                    <Icon sx={{ color: "#4338ca" }} fontSize="small">
                      {icon}
                    </Icon>
                    <MDTypography variant="button" fontWeight="bold">
                      {title}
                    </MDTypography>
                  </MDBox>
                  <MDTypography variant="caption" sx={{ color: "#667085" }}>
                    {body}
                  </MDTypography>
                </MDBox>
              </Grid>
            ))}
          </Grid>
        </MDBox>
      </MDBox>

      <MDBox px={{ xs: 2, md: 6, lg: 10 }} py={{ xs: 5, md: 7 }} maxWidth="1440px" mx="auto">
        <SectionHeading title="Explore eduClub" />
        <Grid container spacing={2}>
          {EXPLORE.map(([title, body, cta, path, background]) => (
            <Grid item xs={12} sm={6} lg key={title}>
              <MDBox
                component="button"
                type="button"
                onClick={() => navigate(path)}
                sx={{
                  width: "100%",
                  height: "100%",
                  minHeight: 168,
                  textAlign: "left",
                  border: 0,
                  cursor: "pointer",
                  font: "inherit",
                  p: 2,
                  borderRadius: "16px",
                  background,
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 160ms ease",
                  "&:hover": { transform: "translateY(-4px)" },
                  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                }}
              >
                <MDTypography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>
                  {title}
                </MDTypography>
                <MDTypography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,.88)", display: "block", mt: 0.75, flex: 1 }}
                >
                  {body}
                </MDTypography>
                <MDTypography variant="button" sx={{ color: "#fff", fontWeight: 800, mt: 1.5 }}>
                  {cta} →
                </MDTypography>
              </MDBox>
            </Grid>
          ))}
        </Grid>
      </MDBox>
    </>
  );
}

// Rendered after the written sections: the school pitch and the closing call to
// action belong at the end of the page, not between the discovery bands and the
// copy.
export function HomeClosing() {
  return (
    <>
      <SchoolLabBand />
      <ClosingCta />
    </>
  );
}

export default HomeSections;
