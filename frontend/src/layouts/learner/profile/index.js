import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function LearnerProfile() {
  const { user, isLearner, resetPassword } = useAuth();
  const [learner, setLearner] = useState(null);
  const [profile, setProfile] = useState({
    email: "",
    grade: "",
    stream: "",
    term: "",
    academic_year: new Date().getFullYear(),
  });
  const [passwords, setPasswords] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLearner()) {
      loadProfile();
    }
  }, [user?.email]);

  const loadProfile = async () => {
    setError("");
    try {
      const learners = await apiClient.get(
        `/learners?email=${encodeURIComponent(user?.email || "")}`
      );
      const currentLearner = learners[0];
      setLearner(currentLearner || null);
      if (currentLearner) {
        setProfile({
          email: currentLearner.email || "",
          grade: currentLearner.grade || "",
          stream: currentLearner.stream || "",
          term: currentLearner.term || "",
          academic_year: currentLearner.academic_year || new Date().getFullYear(),
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const saveProfile = async () => {
    if (!learner) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await apiClient.put(`/learners/${learner.id}`, profile);
      setLearner(updated);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await resetPassword(passwords.oldPassword, passwords.newPassword);
      setPasswords({ oldPassword: "", newPassword: "" });
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isLearner()) {
    return <MDBox p={3}>Access denied. Learner only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="My Profile"
        subtitle="Keep your learner details complete and protect your password."
      />
      <MDBox py={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Learner Details
                </MDTypography>
                <Grid container spacing={2}>
                  {[
                    ["email", "Email"],
                    ["grade", "Grade"],
                    ["stream", "Class / Stream"],
                    ["term", "Term"],
                    ["academic_year", "Academic Year"],
                  ].map(([name, label]) => (
                    <Grid item xs={12} md={name === "email" ? 12 : 6} key={name}>
                      <MDInput
                        label={label}
                        fullWidth
                        type={name === "academic_year" ? "number" : "text"}
                        value={profile[name]}
                        onChange={(event) =>
                          setProfile((current) => ({ ...current, [name]: event.target.value }))
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
                <MDBox mt={3}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    onClick={saveProfile}
                    disabled={saving || !learner}
                  >
                    Save Profile
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={1}>
                  Change Password
                </MDTypography>
                <MDTypography variant="caption" color="text" display="block" mb={2}>
                  Use at least 8 characters with uppercase, lowercase, number, and symbol.
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <MDInput
                      label="Current Password"
                      type="password"
                      fullWidth
                      value={passwords.oldPassword}
                      onChange={(event) =>
                        setPasswords((current) => ({ ...current, oldPassword: event.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      label="New Password"
                      type="password"
                      fullWidth
                      value={passwords.newPassword}
                      onChange={(event) =>
                        setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                      }
                    />
                  </Grid>
                </Grid>
                <MDBox mt={3}>
                  <MDButton
                    variant="gradient"
                    color="warning"
                    onClick={changePassword}
                    disabled={saving || !passwords.oldPassword || !passwords.newPassword}
                  >
                    Change Password
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>

        {message && (
          <MDTypography variant="caption" color="success" display="block" mt={2}>
            {message}
          </MDTypography>
        )}
        {error && (
          <MDTypography variant="caption" color="error" display="block" mt={2}>
            {error}
          </MDTypography>
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default LearnerProfile;
