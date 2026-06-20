import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import MDTypography from "components/MDTypography";
import AdminFeedbackPanel from "components/AdminFeedbackPanel";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";

const CACHE_KEY = "system-admin:dashboard";

function SystemAdminDashboard() {
  const { user, isSystemAdmin } = useAuth();
  const [stats, setStats] = useState({
    schools: 0,
    learners: 0,
    courses: 0,
    schoolAdmins: 0,
    pastTerms: 0,
  });
  const [currentTerm, setCurrentTerm] = useState(null);
  const [mfaPolicy, setMfaPolicy] = useState({
    system_admin: true,
    school_admin: true,
  });
  const [mfaPolicyMessage, setMfaPolicyMessage] = useState("");

  useEffect(() => {
    if (!isSystemAdmin()) {
      return;
    }

    // Fetch statistics
    const fetchStats = async () => {
      const cached = getCachedPage(CACHE_KEY)?.value;
      if (cached) {
        setStats(cached.stats || stats);
        setCurrentTerm(cached.currentTerm || null);
        setMfaPolicy(cached.mfaPolicy || mfaPolicy);
      }
      try {
        const [
          schoolsRes,
          learnersRes,
          coursesRes,
          schoolAdminsRes,
          termsRes,
          currentTermRes,
          mfaPolicyRes,
        ] = await Promise.all([
          apiClient.get("/schools"),
          apiClient.get("/learners"),
          apiClient.get("/courses"),
          apiClient.get("/users?role=school_admin"),
          apiClient.get("/academic/terms"),
          apiClient.get("/academic/terms/current").catch(() => null),
          apiClient.get("/auth/mfa-policy").catch(() => ({
            system_admin: true,
            school_admin: true,
          })),
        ]);

        const nextStats = {
          schools: schoolsRes.length || 0,
          learners: learnersRes.length || 0,
          courses: coursesRes.length || 0,
          schoolAdmins: schoolAdminsRes.length || 0,
          pastTerms:
            termsRes.filter((termItem) => new Date(termItem.end_date) < new Date()).length || 0,
        };
        setStats(nextStats);
        setCurrentTerm(currentTermRes);
        setMfaPolicy(mfaPolicyRes);
        setCachedPage(CACHE_KEY, {
          stats: nextStats,
          currentTerm: currentTermRes,
          mfaPolicy: mfaPolicyRes,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    fetchStats();
  }, [isSystemAdmin]);

  const updateMfaPolicy = async (role, checked) => {
    const nextPolicy = { ...mfaPolicy, [role]: checked };
    setMfaPolicy(nextPolicy);
    setMfaPolicyMessage("");

    try {
      const savedPolicy = await apiClient.put("/auth/mfa-policy", nextPolicy);
      setMfaPolicy(savedPolicy);
      setMfaPolicyMessage("MFA policy updated.");
    } catch (error) {
      setMfaPolicy((current) => ({ ...current, [role]: !checked }));
      setMfaPolicyMessage(error.message || "Could not update MFA policy.");
    }
  };

  if (!isSystemAdmin()) {
    return <div>Access denied. System Admin only.</div>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <h2>System Admin Dashboard</h2>
          <p>Welcome, {user?.fullName}</p>
        </MDBox>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              <ComplexStatisticsCard
                color="dark"
                icon="school"
                title="Schools"
                count={stats.schools}
                percentage={{
                  color: "success",
                  amount: "+5%",
                  label: "than last month",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              <ComplexStatisticsCard
                icon="people"
                title="Learners"
                count={stats.learners}
                percentage={{
                  color: "success",
                  amount: "+12%",
                  label: "than last month",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              <ComplexStatisticsCard
                color="success"
                icon="menu_book"
                title="Courses"
                count={stats.courses}
                percentage={{
                  color: "success",
                  amount: "+3%",
                  label: "than last month",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              <ComplexStatisticsCard
                color="primary"
                icon="admin_panel_settings"
                title="School Admins"
                count={stats.schoolAdmins}
                percentage={{
                  color: "success",
                  amount: "+2",
                  label: "Just added",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12}>
            <MDTypography variant="body2" color="text">
              Current active term: {currentTerm?.name || "None for today's date"} | Past terms:{" "}
              {stats.pastTerms}
            </MDTypography>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="bold" mb={1}>
                  Administrator MFA
                </MDTypography>
                <MDTypography variant="body2" color="text" mb={2}>
                  Choose which administrator roles must confirm the email code during login.
                </MDTypography>
                <Grid container spacing={1}>
                  {[
                    ["system_admin", "System Admin MFA"],
                    ["school_admin", "School Admin MFA"],
                  ].map(([role, label]) => (
                    <Grid item xs={12} md={6} key={role}>
                      <MDBox display="flex" alignItems="center">
                        <Checkbox
                          checked={Boolean(mfaPolicy[role])}
                          onChange={(event) => updateMfaPolicy(role, event.target.checked)}
                        />
                        <MDTypography variant="button" color="text">
                          {label}
                        </MDTypography>
                      </MDBox>
                    </Grid>
                  ))}
                </Grid>
                {mfaPolicyMessage && (
                  <MDTypography
                    variant="caption"
                    color={mfaPolicyMessage.includes("Could not") ? "error" : "success"}
                  >
                    {mfaPolicyMessage}
                  </MDTypography>
                )}
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <AdminFeedbackPanel />
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminDashboard;
