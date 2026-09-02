import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Card from "@mui/material/Card";
import Alert from "@mui/material/Alert";
import Icon from "@mui/material/Icon";

import AdminFeedbackPanel from "components/AdminFeedbackPanel";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";

function SchoolAdminDashboard() {
  const [loadErrors, setLoadErrors] = useState([]);
  const { user, isSchoolAdmin } = useAuth();
  const [stats, setStats] = useState({
    learners: 0,
    allocated: 0,
    completed: 0,
    certificates: 0,
    courses: 0,
    activeTerms: 0,
    completionRate: 0,
    syncedAllocations: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [currentTerm, setCurrentTerm] = useState(null);
  const cacheKey = `school-admin:${user?.schoolId}:dashboard`;

  useEffect(() => {
    if (!isSchoolAdmin()) {
      return;
    }

    const fetchData = async () => {
      setLoadErrors([]);
      const load = (endpoint) =>
        apiClient.get(endpoint).catch((error) => {
          setLoadErrors((current) => [...current, error.message]);
          return null;
        });
      const cached = getCachedPage(cacheKey)?.value;
      if (cached) {
        setStats(cached.stats || stats);
        setRecentActivity(cached.recentActivity || []);
        setCurrentTerm(cached.currentTerm || null);
      }
      try {
        const [learnersRes, allocationsRes, certificatesRes, coursesRes, termsRes] =
          await Promise.all([
            load(`/learners?school_id=${user?.schoolId}`),
            load(`/allocations?school_id=${user?.schoolId}`),
            load(`/certificates?school_id=${user?.schoolId}`),
            load("/courses"),
            load("/academic/terms"),
          ]);
        const todayTerm = await apiClient.get("/academic/terms/current").catch(() => null);
        const completionSummary = await apiClient
          .get(
            `/leaderboard/school-completion-summary?${
              todayTerm?.name
                ? new URLSearchParams({
                    term: todayTerm.name,
                    academicYear: String(
                      todayTerm.academic_year || new Date(todayTerm.start_date).getFullYear()
                    ),
                  }).toString()
                : ""
            }`
          )
          .catch(() => null);
        setCurrentTerm(todayTerm);

        const nextStats = {
          learners: learnersRes?.length ?? "—",
          allocated: allocationsRes?.length ?? "—",
          completed: allocationsRes?.filter((a) => a.status === "completed").length ?? "—",
          certificates: certificatesRes?.length ?? "—",
          courses: coursesRes?.length ?? "—",
          activeTerms:
            termsRes?.filter((termItem) => new Date(termItem.end_date) < new Date()).length ?? "—",
          completionRate:
            completionSummary?.completion_rate ??
            (allocationsRes?.length > 0
              ? Math.round(
                  (allocationsRes.filter((a) => a.status === "completed").length /
                    allocationsRes.length) *
                    100
                )
              : 0),
          syncedAllocations: completionSummary?.synced_allocations || 0,
        };

        setStats(nextStats);
        setRecentActivity(allocationsRes?.slice(0, 5) || []);
        setCachedPage(cacheKey, {
          stats: nextStats,
          recentActivity: allocationsRes?.slice(0, 5) || [],
          currentTerm: todayTerm,
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    };

    fetchData();
  }, [user?.role, user?.schoolId]);

  if (!isSchoolAdmin()) {
    return <MDBox>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="School Admin Dashboard"
        subtitle="Manage learners, course allocations, progress, reports, and certificates."
        actions={
          <>
            {" "}
            <MDButton
              component={Link}
              to="/school-admin/learners"
              variant="outlined"
              color="info"
              size="small"
            >
              Manage Learners
            </MDButton>{" "}
          </>
        }
      />
      <MDBox py={2}>
        {loadErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Some data could not refresh: {[...new Set(loadErrors)].join("; ")}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} lg={2.4}>
            <MDBox mb={0}>
              <ComplexStatisticsCard
                color="dark"
                icon="school"
                title="Total Learners"
                to="/school-admin/learners"
                count={stats.learners}
              />
            </MDBox>
          </Grid>
          <Grid item xs={6} sm={4} lg={2.4}>
            <MDBox mb={0}>
              <ComplexStatisticsCard
                icon="assignment_turned_in"
                title="Allocations"
                to="/school-admin/allocations"
                count={stats.allocated}
              />
            </MDBox>
          </Grid>
          <Grid item xs={6} sm={4} lg={2.4}>
            <MDBox mb={0}>
              <ComplexStatisticsCard
                color="success"
                icon="check_circle"
                title="Completed"
                to="/school-admin/progress"
                count={stats.completed}
              />
            </MDBox>
          </Grid>
          <Grid item xs={6} sm={4} lg={2.4}>
            <MDBox mb={0}>
              <ComplexStatisticsCard
                color="primary"
                icon="card_membership"
                title="Certificates"
                to="/school-admin/certificates"
                count={stats.certificates}
              />
            </MDBox>
          </Grid>
          <Grid item xs={6} sm={4} lg={2.4}>
            <MDBox mb={0}>
              <ComplexStatisticsCard
                color="warning"
                icon="menu_book"
                title="Courses"
                to="/school-admin/courses"
                count={stats.courses}
              />
            </MDBox>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="h6" fontWeight="bold" mb={2}>
                  Recent Activity
                </MDTypography>
                {recentActivity.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No recent activity
                  </MDTypography>
                ) : (
                  <MDBox>
                    {recentActivity.map((activity, index) => (
                      <MDBox
                        key={activity.id || index}
                        display="flex"
                        alignItems="center"
                        py={1.5}
                        borderBottom={
                          index !== recentActivity.length - 1 ? "1px solid #e0e0e0" : "none"
                        }
                      >
                        <MDBox
                          mr={2}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          width="40px"
                          height="40px"
                          borderRadius="50%"
                          bgcolor={activity.status === "completed" ? "success.main" : "info.main"}
                          color="white"
                        >
                          <Icon fontSize="small">
                            {activity.status === "completed" ? "verified" : "person_add"}
                          </Icon>
                        </MDBox>
                        <MDBox flex={1}>
                          <MDTypography variant="body2" fontWeight="medium">
                            {activity.learner_name} allocated to {activity.course_name}
                          </MDTypography>
                          <MDTypography variant="caption" color="text">
                            {activity.term || "Current term"} {activity.academic_year || ""}
                          </MDTypography>
                        </MDBox>
                      </MDBox>
                    ))}
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="h6" fontWeight="bold" mb={2}>
                  Quick Stats
                </MDTypography>
                <MDBox display="flex" flexDirection="column" gap={2}>
                  <MDBox display="flex" justifyContent="space-between" alignItems="center">
                    <MDTypography variant="body2" color="text">
                      Current Term
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {currentTerm?.name || "None"}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" justifyContent="space-between" alignItems="center">
                    <MDTypography variant="body2" color="text">
                      Past Terms
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {stats.activeTerms}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" justifyContent="space-between" alignItems="center">
                    <MDTypography variant="body2" color="text">
                      Completion Rate
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold" color="success">
                      {stats.completionRate}%
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" justifyContent="space-between" alignItems="center">
                    <MDTypography variant="body2" color="text">
                      Certificates/Learner
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {stats.learners > 0 ? (stats.certificates / stats.learners).toFixed(1) : 0}
                    </MDTypography>
                  </MDBox>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <AdminFeedbackPanel title="Learner Messages" />
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolAdminDashboard;
