import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import eduClubLogo from "assets/images/brand/educlub-logo.png";
import heroImage from "assets/images/bg-sign-up-cover.jpeg";
import { apiClient } from "lib/api";
import { useAuth } from "context/AuthContext";
import { passwordIssues, registrationIssues } from "./registrationValidation";

const initialForm = {
  first_name: "",
  second_name: "",
  third_name: "",
  grade: "",
  school_id: "",
  term_id: "",
  email: "",
  parent_full_name: "",
  parent_phone: "",
  parent_email: "",
  password: "",
  confirm_password: "",
  parent_consent: false,
  consent_competition_updates: true,
  consent_open_course_updates: true,
};

const grades = Array.from({ length: 12 }, (_, index) => String(index + 1));

const searchPhrases = [
  "online LMS for kids",
  "digital skills for children",
  "monthly national learner competitions",
  "typing competitions for students",
  "maths and STEM competitions",
  "safe online learning platform",
];

const benefits = [
  {
    icon: "workspace_premium",
    title: "National Monthly Competitions",
    text: "Typing, maths, science and STEM challenges give learners a reason to practise, improve and compete.",
  },
  {
    icon: "devices",
    title: "Digital Literacy Courses",
    text: "Over 20 digital literacy courses help children build practical skills for school, creativity and future careers.",
  },
  {
    icon: "verified_user",
    title: "Parent Consent Built In",
    text: "Learner registration includes guardian details, consent capture and a focused dashboard for safe participation.",
  },
];

const partnerLinks = [
  {
    name: "Bright Coders Kenya",
    url: "https://www.brightcoderske.co.ke",
  },
  {
    name: "Code Champions",
    url: "https://codechampions.co.ke",
  },
];

const sectionByPath = {
  "/why-choose-us": "why-choose-us",
  "/why-chose-us": "why-choose-us",
  "/why_chose_us": "why-choose-us",
  "/why-choose": "why-choose-us",
  "/talk-to-us": "talk-to-us",
  "/contact": "talk-to-us",
  "/partners": "partners",
  "/digital-skills": "digital-skills",
  "/competitions": "competitions",
};

function updateStructuredData(origin) {
  const id = "educlub-structured-data";
  document.getElementById(id)?.remove();

  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "eduClub LMS",
    url: `${origin}/`,
    logo: `${origin}/apple-icon.png`,
    description:
      "eduClub LMS provides online learning, digital literacy courses, learner dashboards and national monthly competitions for kids.",
    educationalCredentialAwarded:
      "Digital literacy course completion and competition participation",
    knowsAbout: [
      "Digital literacy for children",
      "Online learning for kids",
      "Typing competitions",
      "Maths competitions",
      "Science competitions",
      "STEM competitions",
      "Learning management systems",
    ],
  });
  document.head.appendChild(script);
}

function upsertMeta(selector, attributes) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function upsertLink(rel, href) {
  let element = document.querySelector(`link[rel='${rel}']`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function RegistrationLanding() {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const { login } = useAuth();
  const [schools, setSchools] = useState([]);
  const [terms, setTerms] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [courseCount, setCourseCount] = useState(0);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const title = "eduClub LMS | Digital Skills, Online Learning and Monthly Competitions for Kids";
    const description =
      "eduClub is a safe online learning platform for kids with digital literacy courses, learner dashboards, typing competitions, maths challenges, science and STEM competitions, secure course access and parent consent.";
    const keywords =
      "LMS for kids, learn online for kids, digital skills for children, digital literacy courses, monthly competitions, typing competition, maths competition, STEM competition, science competition, online learning platform for schools, learner dashboard, online courses for children";
    const canonicalUrl = `${window.location.origin}${pathname === "/register" ? "/register" : "/"}`;

    document.title = title;
    upsertMeta("meta[name='description']", {
      name: "description",
      content: description,
    });
    upsertMeta("meta[name='keywords']", {
      name: "keywords",
      content: keywords,
    });
    upsertMeta("meta[name='robots']", {
      name: "robots",
      content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    });
    upsertMeta("meta[property='og:title']", {
      property: "og:title",
      content: title,
    });
    upsertMeta("meta[property='og:description']", {
      property: "og:description",
      content: description,
    });
    upsertMeta("meta[property='og:type']", {
      property: "og:type",
      content: "website",
    });
    upsertMeta("meta[property='og:url']", {
      property: "og:url",
      content: canonicalUrl,
    });
    upsertMeta("meta[property='og:image']", {
      property: "og:image",
      content: `${window.location.origin}/apple-icon.png`,
    });
    upsertMeta("meta[property='og:image:alt']", {
      property: "og:image:alt",
      content: "eduClub LMS logo",
    });
    upsertMeta("meta[name='twitter:card']", {
      name: "twitter:card",
      content: "summary_large_image",
    });
    upsertMeta("meta[name='twitter:title']", {
      name: "twitter:title",
      content: title,
    });
    upsertMeta("meta[name='twitter:description']", {
      name: "twitter:description",
      content: description,
    });
    upsertMeta("meta[name='twitter:image']", {
      name: "twitter:image",
      content: `${window.location.origin}/apple-icon.png`,
    });
    upsertLink("canonical", canonicalUrl);
    updateStructuredData(window.location.origin);

    apiClient
      .get("/public/schools")
      .then(setSchools)
      .catch(() => setError("Could not load registered schools."));
    apiClient
      .get("/public/terms")
      .then((rows) => {
        const termRows = Array.isArray(rows) ? rows : [];
        setTerms(termRows);
        const defaultTerm =
          termRows.find((term) => term.is_current) ||
          termRows.find((term) => term.is_active) ||
          termRows[0];
        if (defaultTerm) {
          setForm((current) => ({
            ...current,
            term_id: current.term_id || String(defaultTerm.id),
          }));
        }
      })
      .catch(() => setError("Could not load academic terms."));

    let current = 0;
    const counter = setInterval(() => {
      current += 1;
      setCourseCount(current);
      if (current >= 20) {
        clearInterval(counter);
      }
    }, 45);

    return () => clearInterval(counter);
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/register") {
      setRegistrationOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    // Friendly marketing URLs share one component and scroll to stable section anchors.
    const sectionId = hash ? hash.replace("#", "") : sectionByPath[pathname];
    if (!sectionId) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const timer = setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [hash, pathname]);

  const issues = useMemo(() => passwordIssues(form.password), [form.password]);
  const missingRequirements = useMemo(() => registrationIssues(form), [form]);
  const canSubmit = missingRequirements.length === 0;

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const openRegistration = () => {
    setError("");
    setMessage("");
    setRegistrationOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!canSubmit) {
      setError(`Complete before registering: ${missingRequirements.join("; ")}.`);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post("/public/register/learner", form);
      setMessage("Registration complete. Opening your learner dashboard...");
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const registrationForm = (
    <MDBox component="form" onSubmit={submit}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <MDInput
            label="First name *"
            fullWidth
            value={form.first_name}
            onChange={(e) => setField("first_name", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MDInput
            label="Second name *"
            fullWidth
            value={form.second_name}
            onChange={(e) => setField("second_name", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MDInput
            label="Third name"
            fullWidth
            value={form.third_name}
            onChange={(e) => setField("third_name", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MDInput
            select
            fullWidth
            label="Grade *"
            value={form.grade}
            SelectProps={{ native: true }}
            onChange={(e) => setField("grade", e.target.value)}
          >
            <option value="">Choose grade</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={4}>
          <MDInput
            select
            fullWidth
            label="School *"
            value={form.school_id}
            SelectProps={{ native: true }}
            onChange={(e) => setField("school_id", e.target.value)}
          >
            <option value="">
              {schools.length
                ? "Choose school"
                : "No schools currently accepting self-registration"}
            </option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={4}>
          <MDInput
            select
            fullWidth
            label="Academic term *"
            value={form.term_id}
            SelectProps={{ native: true }}
            onChange={(e) => setField("term_id", e.target.value)}
          >
            <option value="">{terms.length ? "Choose term" : "No academic terms available"}</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.term_label || `${term.academic_year} - ${term.name}`}
                {term.is_current ? " (Current)" : term.is_active ? " (Active)" : ""}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12}>
          <MDInput
            type="email"
            label="Learner email *"
            fullWidth
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <MDInput
            label="Parent full name *"
            fullWidth
            value={form.parent_full_name}
            onChange={(e) => setField("parent_full_name", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <MDInput
            label="Parent phone *"
            fullWidth
            value={form.parent_phone}
            onChange={(e) => setField("parent_phone", e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <MDInput
            type="email"
            label="Parent email"
            fullWidth
            value={form.parent_email}
            onChange={(e) => setField("parent_email", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <MDInput
            type={showPassword ? "text" : "password"}
            label="Password *"
            fullWidth
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                    edge="end"
                  >
                    <Icon>{showPassword ? "visibility_off" : "visibility"}</Icon>
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <MDInput
            type={showConfirmPassword ? "text" : "password"}
            label="Confirm password *"
            fullWidth
            value={form.confirm_password}
            onChange={(e) => setField("confirm_password", e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={
                      showConfirmPassword
                        ? "Hide password confirmation"
                        : "Show password confirmation"
                    }
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    edge="end"
                  >
                    <Icon>{showConfirmPassword ? "visibility_off" : "visibility"}</Icon>
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      </Grid>

      <MDTypography
        variant="caption"
        color={issues.length ? "error" : "success"}
        display="block"
        mt={1}
      >
        {issues.length
          ? `Password needs: ${issues.join(", ")}.`
          : "Password meets the security policy."}
      </MDTypography>
      {!canSubmit && (
        <MDTypography variant="caption" color="error" display="block" mt={1}>
          Complete before registering: {missingRequirements.join("; ")}.
        </MDTypography>
      )}
      {schools.length === 0 && (
        <MDTypography variant="caption" color="text" display="block" mt={1}>
          Ask your school administrator to enable learner self-registration for your school.
        </MDTypography>
      )}

      <MDBox mt={2}>
        <MDBox display="flex" alignItems="flex-start">
          <Checkbox
            checked={form.parent_consent}
            onChange={(e) => setField("parent_consent", e.target.checked)}
          />
          <MDTypography variant="caption" color="text">
            I am the parent or guardian and consent to eduClub collecting and using the learner,
            school, account, security, course access, competition, open course, and progress details
            needed to provide the platform.
          </MDTypography>
        </MDBox>
        <MDBox display="flex" alignItems="center">
          <Checkbox
            checked={form.consent_competition_updates}
            onChange={(e) => setField("consent_competition_updates", e.target.checked)}
          />
          <MDTypography variant="caption" color="text">
            Send updates about upcoming competitions.
          </MDTypography>
        </MDBox>
        <MDBox display="flex" alignItems="center">
          <Checkbox
            checked={form.consent_open_course_updates}
            onChange={(e) => setField("consent_open_course_updates", e.target.checked)}
          />
          <MDTypography variant="caption" color="text">
            Send updates about open courses and learning opportunities.
          </MDTypography>
        </MDBox>
      </MDBox>

      <MDButton
        type="submit"
        variant="gradient"
        color="info"
        fullWidth
        sx={{ mt: 2 }}
        startIcon={<Icon>how_to_reg</Icon>}
        disabled={submitting || !canSubmit}
      >
        {submitting ? "Registering..." : "Register learner"}
      </MDButton>
    </MDBox>
  );

  return (
    <MDBox minHeight="100vh" bgColor="grey-100">
      <MDBox
        minHeight={{ xs: "auto", lg: "88vh" }}
        sx={{
          backgroundImage: `linear-gradient(90deg, rgba(10,20,35,0.9), rgba(10,20,35,0.48)), url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <MDBox px={{ xs: 2, md: 6 }} py={3} display="flex" justifyContent="space-between">
          <MDBox display="flex" alignItems="center">
            <MDBox component="img" src={eduClubLogo} alt="eduClub LMS logo" width="56px" mr={1.5} />
            <MDTypography variant="h4" color="white" fontWeight="bold">
              eduClub LMS
            </MDTypography>
          </MDBox>
          <MDBox display="flex" gap={1}>
            <MDButton variant="outlined" color="white" onClick={openRegistration}>
              Register
            </MDButton>
            <MDButton variant="outlined" color="white" onClick={() => navigate("/login")}>
              Login
            </MDButton>
          </MDBox>
        </MDBox>

        <Grid container px={{ xs: 2, md: 6 }} py={{ xs: 4, lg: 7 }} spacing={4} alignItems="center">
          <Grid item xs={12} lg={7}>
            <MDTypography
              variant="h1"
              color="white"
              fontWeight="bold"
              sx={{ maxWidth: 820, lineHeight: 1.05 }}
            >
              Online learning and national competitions for curious kids.
            </MDTypography>
            <MDTypography
              variant="h5"
              color="white"
              mt={2.5}
              lineHeight={1.5}
              sx={{ maxWidth: 760 }}
            >
              eduClub helps learners build digital literacy, practise school-friendly online
              courses, and join monthly typing, maths, science and STEM competitions from one safe
              LMS dashboard.
            </MDTypography>
            <MDBox display="flex" flexWrap="wrap" gap={1.2} mt={3}>
              {[
                `${courseCount}+ Digital literacy courses`,
                "Monthly typing competitions",
                "Maths competitions",
                "Science and STEM competitions",
              ].map((label) => (
                <MDBox
                  key={label}
                  px={1.5}
                  py={0.75}
                  borderRadius="md"
                  sx={{ backgroundColor: "rgba(255,255,255,0.16)" }}
                >
                  <MDTypography variant="button" color="white">
                    {label}
                  </MDTypography>
                </MDBox>
              ))}
            </MDBox>
            <MDBox display="flex" flexWrap="wrap" gap={1.5} mt={4}>
              <MDButton
                variant="gradient"
                color="warning"
                size="large"
                startIcon={<Icon>how_to_reg</Icon>}
                onClick={openRegistration}
              >
                Register Learner
              </MDButton>
              <MDButton
                variant="outlined"
                color="white"
                size="large"
                startIcon={<Icon>emoji_events</Icon>}
                onClick={openRegistration}
              >
                Join Competitions
              </MDButton>
            </MDBox>
          </Grid>

          <Grid item xs={12} lg={5}>
            <MDBox
              p={{ xs: 2, md: 3 }}
              borderRadius="lg"
              sx={{ backgroundColor: "rgba(255,255,255,0.13)", backdropFilter: "blur(3px)" }}
            >
              <MDTypography variant="h4" color="white" fontWeight="bold">
                Register. Enrol. Learn. Compete.
              </MDTypography>
              <Grid container spacing={1.2} mt={1}>
                {[
                  "Register safely",
                  "Enrol in open competitions",
                  "Learn online",
                  "Compete monthly",
                ].map((step, index) => (
                  <Grid item xs={12} sm={6} key={step}>
                    <MDBox
                      p={1.5}
                      borderRadius="md"
                      sx={{ backgroundColor: "rgba(255,255,255,0.14)" }}
                    >
                      <MDTypography variant="caption" color="white" display="block">
                        Step {index + 1}
                      </MDTypography>
                      <MDTypography variant="button" color="white" fontWeight="bold">
                        {step}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                ))}
              </Grid>
              <MDTypography variant="body2" color="white" lineHeight={1.6} mt={2}>
                Built for schools, parents and learners who want a focused online learning platform
                with secure course access, progress visibility, competition enrolment and digital
                skills that children can practise every week.
              </MDTypography>
            </MDBox>
          </Grid>
        </Grid>
      </MDBox>

      <MDBox component="main" px={{ xs: 2, md: 6 }} py={5}>
        <Grid id="competitions" container spacing={3} sx={{ scrollMarginTop: 24 }}>
          {benefits.map((benefit) => (
            <Grid item xs={12} md={4} key={benefit.title}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={3}>
                  <Icon color="info" fontSize="large">
                    {benefit.icon}
                  </Icon>
                  <MDTypography variant="h5" fontWeight="bold" mt={1}>
                    {benefit.title}
                  </MDTypography>
                  <MDTypography variant="body2" color="text" lineHeight={1.6} mt={1}>
                    {benefit.text}
                  </MDTypography>
                </MDBox>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid
          id="digital-skills"
          container
          spacing={4}
          mt={2}
          alignItems="center"
          sx={{ scrollMarginTop: 24 }}
        >
          <Grid item xs={12} lg={7}>
            <MDTypography variant="h3" fontWeight="bold">
              A kids learning platform made for skill, confidence and healthy competition.
            </MDTypography>
            <MDTypography variant="body1" color="text" lineHeight={1.8} mt={2}>
              eduClub combines an LMS for schools, online courses for kids, digital literacy
              learning, secure course access, learner progress, parent consent and national monthly
              competitions. Learners can register, join open competitions, pay where required, open
              course activities and return to eduClub to see performance and position.
            </MDTypography>
            <MDBox display="flex" flexWrap="wrap" gap={1} mt={2}>
              {searchPhrases.map((phrase) => (
                <MDBox key={phrase} px={1.5} py={0.75} borderRadius="md" bgColor="white">
                  <MDTypography variant="caption" color="text" fontWeight="medium">
                    {phrase}
                  </MDTypography>
                </MDBox>
              ))}
            </MDBox>
          </Grid>
          <Grid id="why-choose-us" item xs={12} lg={5} sx={{ scrollMarginTop: 24 }}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h4" fontWeight="bold">
                  Why parents and schools choose eduClub
                </MDTypography>
                {[
                  "Safe learner registration with guardian consent.",
                  "Open competitions available without school course allocation.",
                  "Digital skills, typing, maths, science and STEM in one dashboard.",
                  "Learning access with eduClub progress and reports.",
                ].map((item) => (
                  <MDBox key={item} display="flex" alignItems="flex-start" mt={2}>
                    <Icon color="success" fontSize="small">
                      check_circle
                    </Icon>
                    <MDTypography variant="body2" color="text" ml={1} lineHeight={1.6}>
                      {item}
                    </MDTypography>
                  </MDBox>
                ))}
                <MDButton
                  variant="gradient"
                  color="info"
                  fullWidth
                  sx={{ mt: 3 }}
                  onClick={openRegistration}
                >
                  Start learner registration
                </MDButton>
              </MDBox>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} mt={2}>
          <Grid id="talk-to-us" item xs={12} md={6} sx={{ scrollMarginTop: 24 }}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={3}>
                <MDTypography variant="h4" fontWeight="bold">
                  Talk to eduClub
                </MDTypography>
                <MDTypography variant="body2" color="text" lineHeight={1.7} mt={1}>
                  Have a school, learner group, digital skills club or competition idea? Call or
                  message eduClub and we will help you get started.
                </MDTypography>
                <MDBox display="flex" flexWrap="wrap" gap={1.2} mt={2}>
                  <MDButton
                    component="a"
                    href="tel:+254740073575"
                    variant="gradient"
                    color="info"
                    startIcon={<Icon>call</Icon>}
                  >
                    Call +254 740 073 575
                  </MDButton>
                  <MDButton
                    component="a"
                    href="https://wa.me/254740073575"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    color="success"
                    startIcon={<Icon>chat</Icon>}
                  >
                    WhatsApp
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
          <Grid id="partners" item xs={12} md={6} sx={{ scrollMarginTop: 24 }}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={3}>
                <MDTypography variant="h4" fontWeight="bold">
                  Partners
                </MDTypography>
                <MDTypography variant="body2" color="text" lineHeight={1.7} mt={1}>
                  eduClub works with learning and coding partners who support digital literacy,
                  coding skills and practical technology education for children.
                </MDTypography>
                <MDBox display="flex" flexWrap="wrap" gap={1.2} mt={2}>
                  {partnerLinks.map((partner) => (
                    <MDButton
                      key={partner.url}
                      component="a"
                      href={partner.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      color="dark"
                      startIcon={<Icon>open_in_new</Icon>}
                    >
                      {partner.name}
                    </MDButton>
                  ))}
                </MDBox>
                <MDTypography variant="caption" color="text" display="block" mt={2}>
                  Facebook link will be added after the official page is confirmed.
                </MDTypography>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <Dialog
        open={registrationOpen}
        onClose={() => setRegistrationOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <MDBox display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <MDBox>
              <MDTypography variant="h4" fontWeight="bold">
                Register a learner
              </MDTypography>
              <MDTypography variant="body2" color="text">
                Parent or guardian consent is required for learner registration.
              </MDTypography>
            </MDBox>
            <MDButton
              variant="text"
              color="dark"
              onClick={() => setRegistrationOpen(false)}
              sx={{ minWidth: 36, p: 0 }}
            >
              <Icon>close</Icon>
            </MDButton>
          </MDBox>

          {error && (
            <MDTypography variant="caption" color="error" display="block" mb={1}>
              {error}
            </MDTypography>
          )}
          {message && (
            <MDTypography variant="caption" color="success" display="block" mb={1}>
              {message}
            </MDTypography>
          )}

          {registrationForm}
        </DialogContent>
      </Dialog>
    </MDBox>
  );
}

export default RegistrationLanding;
