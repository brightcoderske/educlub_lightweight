import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { LearnerHero, LearningArt, learningTheme } from "components/DashboardIdentity";
import MDProgress from "components/MDProgress";
import { getUserDisplayName } from "lib/userDisplay";
import { useAppPalette } from "lib/appTheme";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import API_BASE_URL from "lib/apiBase";
import { activityLearningPath, findContinueLearning } from "./learningNavigation";
import { buildDueThisWeekItems, findActiveWeekLearning } from "./dashboardDueItems";
import {
  academicPeriodOptions,
  filterAcademicPeriod,
  currentLearningAllocations,
} from "lib/academicHistory";

const apiOrigin = new URL(API_BASE_URL).origin;

function resolveAssetUrl(url) {
  if (!url) {
    return "";
  }

  if (url.startsWith("/")) {
    return `${apiOrigin}${url}`;
  }

  return url;
}

function formatCompetitionDate(value, options = {}) {
  if (!value) {
    return "";
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: options.weekday || "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function competitionWindow(competition) {
  return `Open from ${formatCompetitionDate(competition.start_date)} to ${formatCompetitionDate(
    competition.end_date
  )}`;
}

function cleanCompetitionDescription(description) {
  const text = String(description || "Join the latest eduClub competition.")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 150 ? `${text.slice(0, 147)}...` : text;
}

let learnerDashboardCache = null;
const LEARNER_DASHBOARD_CACHE_MS = 2 * 60 * 1000;

function LearnerDashboard() {
  const { user, isLearner } = useAuth();
  const palette = useAppPalette();
  const navigate = useNavigate();
  const coursesView = useLocation().pathname === "/learner/courses";
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const requestVersion = useRef(0);
  const cached = learnerDashboardCache?.userId === user?.id ? learnerDashboardCache.data : null;
  const [allocations, setAllocations] = useState(cached?.allocations || []);
  const [learner, setLearner] = useState(cached?.learner || null);
  const [loading, setLoading] = useState(!cached);
  const [courseSummaries, setCourseSummaries] = useState(cached?.courseSummaries || {});
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [error, setError] = useState("");
  const [stats, setStats] = useState(
    cached?.stats || {
      total: 0,
      active: 0,
      completed: 0,
      inProgress: 0,
    }
  );
  const [currentTerm, setCurrentTerm] = useState(cached?.currentTerm || null);
  const [featuredCompetition, setFeaturedCompetition] = useState(null);
  const [showFeaturedCompetition, setShowFeaturedCompetition] = useState(false);
  const [badges, setBadges] = useState(cached?.badges || []);
  const [dueItems, setDueItems] = useState(cached?.dueItems || []);
  const [continueLearning, setContinueLearning] = useState(cached?.continueLearning || null);
  const [streak, setStreak] = useState(cached?.streak || null);
  const visibleAllocations = filterAcademicPeriod(allocations, selectedPeriod).filter(
    (allocation) =>
      (allocation.course_name || "").toLowerCase().includes(search.trim().toLowerCase()) &&
      (courseFilter === "all" ||
        (courseFilter === "completed"
          ? allocation.status === "completed"
          : ["active", "in_progress"].includes(allocation.status)))
  );

  useEffect(() => {
    if (!isLearner()) {
      return;
    }

    const hasFreshCache =
      learnerDashboardCache &&
      learnerDashboardCache.userId === user?.id &&
      Date.now() - learnerDashboardCache.savedAt < LEARNER_DASHBOARD_CACHE_MS;

    if (hasFreshCache) {
      applyDashboardData(learnerDashboardCache.data, { showFeatured: false });
      fetchLearnerData({ quiet: true });
    } else {
      fetchLearnerData();
    }
    return () => {
      requestVersion.current += 1;
    };
  }, [user?.role, user?.id]);

  const applyDashboardData = (data) => {
    setLearner(data.learner);
    setAllocations(data.allocations);
    setStats(data.stats);
    setCurrentTerm(data.currentTerm);
    setFeaturedCompetition(data.featuredCompetition);
    setBadges(data.badges || []);
    setDueItems(data.dueItems || []);
    setContinueLearning(data.continueLearning || null);
    setCourseSummaries(data.courseSummaries || {});
    setStreak(data.streak || null);
  };

  const fetchLearnerData = async ({ quiet = false } = {}) => {
    const version = ++requestVersion.current;
    if (!quiet) {
      setLoading(true);
    }
    setError("");
    try {
      const [
        learners,
        currentTermRes,
        competitionsRes,
        badgesRes,
        typingTestsRes,
        quizTestsRes,
        response,
      ] = await Promise.all([
        apiClient.get("/learners"),
        apiClient.get("/academic/terms/current").catch(() => null),
        apiClient.get("/competitions").catch(() => []),
        apiClient.get("/courses/learner/badges").catch(() => []),
        apiClient.get("/typing/tests?test_type=weekly").catch(() => []),
        apiClient.get("/quiz-tests/tests?quiz_type=weekly").catch(() => []),
        apiClient.get("/allocations"),
      ]);
      if (version !== requestVersion.current) return;
      const featured =
        competitionsRes.find(
          (competition) => competition.is_featured && competition.enrollment_status !== "enrolled"
        ) || null;
      const currentLearner = learners[0];

      if (!currentLearner) {
        const emptyData = {
          learner: null,
          allocations: [],
          stats: { total: 0, active: 0, completed: 0, inProgress: 0 },
          currentTerm: currentTermRes,
          featuredCompetition: featured,
          badges: badgesRes,
          dueItems: [],
          continueLearning: null,
        };
        learnerDashboardCache = {
          userId: user?.id,
          savedAt: Date.now(),
          data: emptyData,
        };
        applyDashboardData(emptyData, { showFeatured: !quiet });
        return;
      }

      const nextDueItems = buildDueThisWeekItems({
        typingTests: typingTestsRes,
        quizTests: quizTestsRes,
        continueLearning: null,
      });
      const nextStats = {
        total: response.length || 0,
        active: response.filter((a) => a.status === "active").length || 0,
        completed: response.filter((a) => a.status === "completed").length || 0,
        inProgress: response.filter((a) => a.status === "in_progress").length || 0,
      };
      const nextData = {
        learner: currentLearner,
        allocations: response,
        stats: nextStats,
        currentTerm: currentTermRes,
        featuredCompetition: featured,
        badges: badgesRes,
        dueItems: nextDueItems,
        continueLearning: null,
      };

      learnerDashboardCache = {
        userId: user?.id,
        savedAt: Date.now(),
        data: nextData,
      };
      applyDashboardData(nextData, { showFeatured: !quiet });
      setLoading(false);

      apiClient
        .get(`/learners/${currentLearner.id}/streak`)
        .then((value) => {
          if (version !== requestVersion.current) return;
          nextData.streak = value;
          setStreak(value);
        })
        .catch(() => {
          // A streak is encouragement, not information the page needs.
        });

      const queue = currentLearningAllocations(response, currentTermRes);
      const overviews = [];
      await Promise.all(
        Array.from({ length: Math.min(queue.length, 3) }, async () => {
          while (queue.length && version === requestVersion.current) {
            const allocation = queue.shift();
            try {
              const overview = await apiClient.get(
                `/courses/${allocation.course_id}/learning-overview`
              );
              overviews.push({ allocation, overview });
            } catch {
              /* A course can be opened directly even when its summary fails. */
            }
          }
        })
      );
      if (version !== requestVersion.current) return;
      const nextContinueLearning = findContinueLearning(overviews);
      nextData.continueLearning = nextContinueLearning;
      nextData.courseSummaries = Object.fromEntries(
        overviews.map(({ allocation, overview }) => [allocation.course_id, overview.summary])
      );
      nextData.dueItems = buildDueThisWeekItems({
        typingTests: typingTestsRes,
        quizTests: quizTestsRes,
        continueLearning: findActiveWeekLearning(overviews) || nextContinueLearning,
      });
      applyDashboardData(nextData, { showFeatured: false });
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError("Failed to fetch courses");
      console.error(err);
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  };

  if (!isLearner()) {
    return <MDBox>Access denied. Learner only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title={coursesView ? "My Courses" : "Home"}
        subtitle={
          learner
            ? [learner.grade, currentTerm?.name].filter(Boolean).join(" · ")
            : "Your learning adventure"
        }
      />
      <MDBox py={2}>
        <LearnerHero
          eyebrow={coursesView ? "YOUR NEXT DISCOVERY" : "LET’S MAKE SOMETHING GREAT"}
          title={
            coursesView
              ? "A world of things to learn."
              : `Hey, ${getUserDisplayName(user).split(" ")[0]}! Ready to create?`
          }
          description={
            coursesView
              ? "Pick a course and turn your ideas into amazing creations."
              : "Continue your adventure or try a new challenge today."
          }
          art={coursesView ? "rocket" : "kid"}
        >
          {!coursesView && (
            <Chip
              size="small"
              label={`${stats.total} ${stats.total === 1 ? "course" : "courses"} to explore`}
              sx={{ bgcolor: palette.chipSurface, color: palette.accentText }}
            />
          )}
          {!coursesView && (
            <Chip
              size="small"
              label={`${badges.length} badges earned`}
              sx={{
                bgcolor: palette.dark ? "#4a3a12" : "#fff5cf",
                color: palette.dark ? "#ffd77a" : "#8b5900",
              }}
            />
          )}
          {!coursesView && streak?.current > 0 && (
            <Chip
              size="small"
              icon={<Icon sx={{ color: "inherit !important" }}>local_fire_department</Icon>}
              label={`${streak.current} day streak`}
              sx={{
                bgcolor: palette.dark ? "#4d2417" : "#ffe9df",
                color: palette.dark ? "#ffb08a" : "#a23c11",
              }}
            />
          )}
        </LearnerHero>
        {!coursesView && (
          <>
            <Grid container spacing={1.5} mb={1.5}>
              <Grid item xs={12} sm={7} md={8}>
                <Card sx={{ height: "100%" }}>
                  <MDBox p={1.75}>
                    <MDTypography variant="h6" fontWeight="bold" mb={1.25}>
                      Continue Learning
                    </MDTypography>
                    <MDBox display="flex" alignItems="center" gap={1.5}>
                      <MDBox
                        sx={{ bgcolor: palette.accentSoft, borderRadius: "16px", flexShrink: 0 }}
                      >
                        <LearningArt
                          kind={learningTheme(continueLearning?.courseName).art}
                          size={48}
                        />
                      </MDBox>
                      <MDBox flex={1} minWidth={0}>
                        <MDTypography variant="h6">
                          {continueLearning?.courseName ||
                            (loading
                              ? "Finding your next adventure…"
                              : "Your next adventure starts here")}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block" mb={1.25}>
                          {continueLearning?.activityTitle || "Choose a course and start creating."}
                        </MDTypography>
                        <MDButton
                          color="info"
                          variant="contained"
                          size="small"
                          endIcon={<Icon>arrow_forward</Icon>}
                          onClick={() =>
                            navigate(
                              continueLearning
                                ? activityLearningPath(
                                    continueLearning.courseId,
                                    continueLearning.moduleId,
                                    continueLearning.activityId
                                  )
                                : "/learner/courses"
                            )
                          }
                        >
                          {continueLearning ? "Continue Learning" : "Explore Courses"}
                        </MDButton>
                      </MDBox>
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
              <Grid item xs={12} sm={5} md={4}>
                <Card sx={{ height: "100%" }}>
                  <MDBox p={1.75}>
                    <MDTypography variant="h6" fontWeight="bold">
                      Look how far you’ve come
                    </MDTypography>
                    <MDBox
                      display="grid"
                      gridTemplateColumns="repeat(4, minmax(0, 1fr))"
                      gap={0.5}
                      mt={1}
                    >
                      {[
                        [stats.active + stats.inProgress, "Learning", "#653bdd"],
                        [stats.completed, "Completed", "#138653"],
                        [badges.length, "Badges", "#b17508"],
                        [streak?.current ?? 0, "Day streak", "#c1521f"],
                      ].map(([value, label, color]) => (
                        <MDBox key={label} textAlign="center">
                          <MDTypography
                            variant="h4"
                            sx={{ color, fontWeight: 800, lineHeight: 1.15 }}
                          >
                            {loading ? "—" : value}
                          </MDTypography>
                          <MDTypography variant="caption" color="text">
                            {label}
                          </MDTypography>
                        </MDBox>
                      ))}
                    </MDBox>
                    <MDButton
                      variant="text"
                      color="info"
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => navigate("/learner/progress")}
                    >
                      See my progress <Icon>chevron_right</Icon>
                    </MDButton>
                  </MDBox>
                </Card>
              </Grid>
            </Grid>
            <MDTypography variant="h6" fontWeight="bold" mb={1.25}>
              What will you discover today?
            </MDTypography>
            <MDBox
              display="grid"
              gridTemplateColumns={{ xs: "repeat(3,minmax(0,1fr))", md: "repeat(6,minmax(0,1fr))" }}
              gap={1.25}
              mb={1.5}
            >
              {[
                ["Learn", "My courses", "rocket", "#3f5fe9", "/learner/courses"],
                ["Typing", "Practise & play", "keyboard", "#118755", "/learner/my-typing-tutor"],
                ["Challenges", "Quizzes & tasks", "trophy", "#c97e08", "/learner/typing-quizzes"],
                ["Compete", "Join the fun", "game", "#bd357e", "/learner/competitions"],
                ["Progress", "Watch me grow", "python", "#7241c3", "/learner/progress"],
                ["Awards", "Celebrate wins", "trophy", "#008693", "/learner/certificates"],
              ].map(([label, subtitle, art, color, path]) => (
                <MDBox
                  component="button"
                  type="button"
                  key={label}
                  onClick={() => navigate(path)}
                  sx={{
                    cursor: "pointer",
                    border: 0,
                    borderRadius: "13px",
                    py: 0.85,
                    px: 0.85,
                    background: `linear-gradient(140deg, ${color}, ${color}dd)`,
                    boxShadow: `0 5px 0 ${color}22`,
                    color: "white",
                    transition: "transform 150ms ease",
                    "&:hover": { transform: "translateY(-3px)" },
                  }}
                >
                  <LearningArt kind={art} size={40} />
                  <MDTypography
                    variant="button"
                    sx={{ color: "#fff", display: "block", fontWeight: 800 }}
                  >
                    {label}
                  </MDTypography>
                  <MDTypography variant="caption" sx={{ color: "#fff", fontSize: ".68rem" }}>
                    {subtitle}
                  </MDTypography>
                </MDBox>
              ))}
            </MDBox>
            <Grid container spacing={2.5} mb={3}>
              <Grid item xs={12} md={7}>
                <Card sx={{ height: "100%" }}>
                  <MDBox p={1.75}>
                    <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <MDTypography variant="h6" fontWeight="bold">
                        Your weekly missions
                      </MDTypography>
                      <Chip
                        size="small"
                        label={`${dueItems.length} to explore`}
                        sx={{ bgcolor: palette.accentSoft, color: palette.accentText }}
                      />
                    </MDBox>
                    {dueItems.length ? (
                      dueItems.map((item) => (
                        <MDBox
                          key={item.id}
                          display="flex"
                          alignItems="center"
                          gap={1.25}
                          py={1}
                          sx={{ borderBottom: `1px solid ${palette.borderSoft}` }}
                        >
                          <Icon
                            sx={{
                              color: palette.accentText,
                              bgcolor: palette.accentSoft,
                              borderRadius: "9px",
                              width: 32,
                              height: 32,
                              p: 0.75,
                            }}
                          >
                            {item.type === "course" ? "menu_book" : "flag"}
                          </Icon>
                          <MDBox flex={1} minWidth={0}>
                            <MDTypography variant="button" fontWeight="bold">
                              {item.title}
                            </MDTypography>
                            <MDTypography variant="caption" color="text" display="block">
                              {item.subtitle}
                            </MDTypography>
                          </MDBox>
                          <MDButton
                            color="info"
                            variant="text"
                            size="small"
                            onClick={() => navigate(item.path)}
                          >
                            Start <Icon>arrow_forward</Icon>
                          </MDButton>
                        </MDBox>
                      ))
                    ) : (
                      <MDTypography variant="body2" color="text">
                        You’re all caught up! Explore a course or practise your typing.
                      </MDTypography>
                    )}
                  </MDBox>
                </Card>
              </Grid>
              <Grid item xs={12} md={5}>
                <Card sx={{ height: "100%" }}>
                  <MDBox p={1.75}>
                    <MDTypography variant="h6" fontWeight="bold">
                      Your badge collection
                    </MDTypography>
                    <MDBox
                      display="flex"
                      alignItems="center"
                      gap={1.25}
                      mt={1.25}
                      sx={{ overflowX: "auto" }}
                    >
                      {badges.length ? (
                        badges.slice(0, 4).map((badge) => (
                          <MDBox
                            key={badge.id}
                            sx={{
                              minWidth: 82,
                              textAlign: "center",
                              bgcolor: palette.surfaceMuted,
                              borderRadius: "11px",
                              p: 0.85,
                            }}
                          >
                            <LearningArt kind="trophy" size={52} />
                            <MDTypography variant="caption" fontWeight="bold" display="block">
                              {badge.badge_name || badge.module_title}
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {badge.label}
                            </MDTypography>
                          </MDBox>
                        ))
                      ) : (
                        <>
                          <LearningArt kind="trophy" size={64} />
                          <MDTypography variant="body2" color="text">
                            Your first badge is waiting. Complete a module or a typing assessment to
                            earn it!
                          </MDTypography>
                        </>
                      )}
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
        <MDBox display="flex" justifyContent="space-between" alignItems="center" gap={2} mb={2}>
          <MDBox>
            <MDTypography variant="h6" fontWeight="bold">
              {coursesView ? "Explore your courses" : "My Courses"}
            </MDTypography>
          </MDBox>
          <MDButton
            color="info"
            variant="text"
            onClick={() =>
              coursesView ? fetchLearnerData({ quiet: true }) : navigate("/learner/courses")
            }
          >
            {coursesView ? "Refresh" : "View all"} <Icon>arrow_forward</Icon>
          </MDButton>
        </MDBox>
        {coursesView && (
          <>
            <MDBox display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={2} mb={2}>
              <MDInput
                label="Search your courses"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: <Icon sx={{ mr: 1, color: palette.textMuted }}>search</Icon>,
                }}
              />
              <MDInput
                select
                label="Course term"
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value)}
                SelectProps={{ native: true }}
                sx={{ minWidth: 190 }}
              >
                <option value="all">All terms</option>
                {academicPeriodOptions(allocations).map((period) => (
                  <option key={period.key} value={period.key}>
                    {period.label}
                  </option>
                ))}
              </MDInput>
            </MDBox>
            <MDBox display="flex" gap={1} mb={2.5} flexWrap="wrap">
              {[
                ["all", "All courses"],
                ["active", "Learning now"],
                ["completed", "Completed"],
              ].map(([value, label]) => (
                <MDButton
                  key={value}
                  size="small"
                  variant={courseFilter === value ? "contained" : "outlined"}
                  color="info"
                  aria-pressed={courseFilter === value}
                  onClick={() => setCourseFilter(value)}
                >
                  {label}
                </MDButton>
              ))}
            </MDBox>
          </>
        )}
        {error && (
          <MDTypography role="alert" variant="body2" color="error" mb={2}>
            {error}
          </MDTypography>
        )}
        {loading ? (
          <Card>
            <MDBox p={2.5} role="status">
              <MDTypography>Loading your courses…</MDTypography>
            </MDBox>
          </Card>
        ) : visibleAllocations.length === 0 ? (
          <Card>
            <MDBox p={2.5} textAlign="center">
              <LearningArt kind="robot" size={96} />
              <MDTypography variant="h6">
                {allocations.length
                  ? "No courses match just yet"
                  : "Your adventure is getting ready"}
              </MDTypography>
              <MDTypography variant="body2" color="text" mt={1}>
                {allocations.length
                  ? "Try another search or choose a different filter."
                  : "Your teacher will help you join your first course. You can try typing practice while you wait."}
              </MDTypography>
              <MDButton
                color="info"
                variant="contained"
                sx={{ mt: 2 }}
                onClick={() =>
                  allocations.length
                    ? (setSearch(""), setCourseFilter("all"), setSelectedPeriod("all"))
                    : navigate("/learner/my-typing-tutor")
                }
              >
                {allocations.length ? "Clear filters" : "Try Typing"}
              </MDButton>
            </MDBox>
          </Card>
        ) : (
          <Grid container spacing={1.5}>
            {(coursesView ? visibleAllocations : visibleAllocations.slice(0, 3)).map(
              (allocation) => {
                const theme = learningTheme(allocation.course_name);
                const summary = courseSummaries[allocation.course_id];
                const progress =
                  summary?.progress_percent ?? (allocation.status === "completed" ? 100 : null);
                return (
                  <Grid item xs={12} sm={6} lg={4} key={allocation.id}>
                    <Card
                      sx={{
                        height: "100%",
                        transition: "transform 150ms ease, box-shadow 150ms ease",
                        "&:hover": {
                          transform: "translateY(-3px)",
                          boxShadow: "0 12px 28px #27164c12",
                        },
                      }}
                    >
                      <MDBox
                        sx={{
                          position: "relative",
                          background: `linear-gradient(140deg, ${theme.color}55, #13152f 85%)`,
                          bgcolor: "#151731",
                          px: 1.5,
                          pt: 1.25,
                          overflow: "hidden",
                        }}
                      >
                        <MDTypography
                          variant="caption"
                          sx={{
                            color: "#fff",
                            letterSpacing: ".08em",
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {theme.label}
                        </MDTypography>
                        <MDBox textAlign="center" height={66}>
                          <LearningArt kind={theme.art} size={78} />
                        </MDBox>
                      </MDBox>
                      <MDBox p={1.5} display="flex" flexDirection="column" flex={1}>
                        <MDTypography variant="h6" fontWeight="bold">
                          {allocation.course_name}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" mt={0.5}>
                          {[allocation.term, allocation.academic_year].filter(Boolean).join(" · ")}
                        </MDTypography>
                        <MDBox mt={1.25} mb={1.5}>
                          <MDBox display="flex" justifyContent="space-between" mb={0.5}>
                            <MDTypography variant="caption" fontWeight="bold">
                              {allocation.status === "completed" ? "Completed!" : "Your progress"}
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {progress === null ? "Open to explore" : `${Math.round(progress)}%`}
                            </MDTypography>
                          </MDBox>
                          {progress !== null && (
                            <MDProgress
                              color="success"
                              value={Math.max(0, Math.min(100, Number(progress)))}
                            />
                          )}
                        </MDBox>
                        <MDButton
                          fullWidth
                          color="info"
                          variant="contained"
                          endIcon={<Icon>arrow_forward</Icon>}
                          sx={{ mt: "auto" }}
                          onClick={() => navigate(`/learner/courses/${allocation.course_id}`)}
                        >
                          {allocation.status === "completed" ? "Revisit Course" : "Open Course"}
                        </MDButton>
                      </MDBox>
                    </Card>
                  </Grid>
                );
              }
            )}
          </Grid>
        )}
        {!coursesView && featuredCompetition && (
          <Card sx={{ mt: 1.5 }}>
            <MDBox p={1.75} display="flex" alignItems="center" gap={1.75}>
              <LearningArt kind="trophy" size={68} />
              <MDBox flex={1}>
                <MDTypography variant="caption" color="info" fontWeight="bold">
                  READY FOR A CHALLENGE?
                </MDTypography>
                <MDTypography variant="h6">{featuredCompetition.name}</MDTypography>
                <MDTypography variant="body2" color="text">
                  {competitionWindow(featuredCompetition)}
                </MDTypography>
                <MDButton
                  color="info"
                  variant="contained"
                  size="small"
                  sx={{ mt: 1.25 }}
                  onClick={() => setShowFeaturedCompetition(true)}
                >
                  Explore competition
                </MDButton>
              </MDBox>
            </MDBox>
          </Card>
        )}
      </MDBox>
      {featuredCompetition && (
        <Dialog
          open={showFeaturedCompetition}
          onClose={() => setShowFeaturedCompetition(false)}
          maxWidth="sm"
          fullWidth
        >
          <MDBox position="relative">
            <MDButton
              variant="text"
              color="white"
              onClick={() => setShowFeaturedCompetition(false)}
              sx={{
                position: "absolute",
                right: 8,
                top: 8,
                zIndex: 2,
                minWidth: 34,
                width: 34,
                height: 34,
                p: 0,
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.38)",
              }}
            >
              <Icon fontSize="small">close</Icon>
            </MDButton>
            <MDBox
              height={{ xs: 170, sm: 220 }}
              sx={{
                backgroundImage: featuredCompetition.image_url
                  ? `url("${resolveAssetUrl(featuredCompetition.image_url)}")`
                  : "linear-gradient(135deg, #1A73E8, #111827)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          </MDBox>
          <DialogContent>
            <Chip color="warning" label="Featured Competition" size="small" />
            <MDTypography variant="h4" fontWeight="bold" mt={1}>
              {featuredCompetition.name}
            </MDTypography>
            <MDTypography variant="body2" color="text" mt={1}>
              {cleanCompetitionDescription(featuredCompetition.description)}
            </MDTypography>
            <MDTypography variant="button" color="text" display="block" mt={1.5}>
              {competitionWindow(featuredCompetition)}
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block" mt={0.5}>
              Practice is open daily. The final quiz opens on{" "}
              {formatCompetitionDate(featuredCompetition.end_date, { weekday: "long" })}.
            </MDTypography>
            <MDBox display="flex" gap={1.5} mt={2.5}>
              <MDButton
                variant="gradient"
                color="warning"
                fullWidth
                onClick={() => navigate("/learner/competitions")}
              >
                Enroll Now
              </MDButton>
              <MDButton
                variant="outlined"
                color="dark"
                fullWidth
                onClick={() => setShowFeaturedCompetition(false)}
              >
                Later
              </MDButton>
            </MDBox>
          </DialogContent>
        </Dialog>
      )}
      <Footer />
    </DashboardLayout>
  );
}

export default LearnerDashboard;
