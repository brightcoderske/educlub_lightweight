import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

const allGrades = Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);

function normalizeList(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

function SchoolSettings() {
  const { user, isSchoolAdmin } = useAuth();
  const [school, setSchool] = useState(null);
  const [grades, setGrades] = useState([]);
  const [streams, setStreams] = useState([]);
  const [streamInput, setStreamInput] = useState("");
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSchool = async () => {
      try {
        const response = await apiClient.get(`/schools/${user?.schoolId}`);
        setSchool(response);
        setGrades(response.grades_config?.length ? response.grades_config : allGrades);
        setStreams(normalizeList(response.streams_config || []));
        setAllowSelfRegistration(Boolean(response.allow_self_registration));
      } catch (err) {
        setError(err.message);
      }
    };

    if (isSchoolAdmin() && user?.schoolId) loadSchool();
  }, [user?.schoolId]);

  const toggleGrade = (grade) => {
    setGrades((current) =>
      current.includes(grade) ? current.filter((item) => item !== grade) : [...current, grade]
    );
  };

  const addStream = () => {
    const value = streamInput.trim();
    if (!value) return;
    setStreams((current) => normalizeList([...current, value]));
    setStreamInput("");
  };

  const removeStream = (stream) => {
    setStreams((current) => current.filter((item) => item !== stream));
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await apiClient.put(`/schools/${user.schoolId}`, {
        ...school,
        grades_config: grades,
        streams_config: streams,
        allow_self_registration: allowSelfRegistration,
      });
      setSchool(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isSchoolAdmin()) {
    return <MDBox p={3}>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <DashboardIdentity
            user={user}
            title="School Settings"
            subtitle="Configure grades and streams so learner forms and uploads stay consistent."
          />
        </MDBox>
        <Card>
          <MDBox p={3}>
            <MDTypography variant="h5" mb={2}>
              Grades Offered
            </MDTypography>
            <MDBox display="flex" flexWrap="wrap" gap={1} mb={3}>
              {allGrades.map((grade) => (
                <Chip
                  key={grade}
                  label={grade}
                  color={grades.includes(grade) ? "info" : "default"}
                  onClick={() => toggleGrade(grade)}
                />
              ))}
            </MDBox>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <MDTypography variant="h6" fontWeight="bold" mb={1}>
                  Streams / Classes
                </MDTypography>
                <MDBox display="flex" gap={1} flexWrap="wrap" mb={1.5}>
                  {streams.length === 0 ? (
                    <MDTypography variant="caption" color="text">
                      No streams added yet.
                    </MDTypography>
                  ) : (
                    streams.map((stream) => (
                      <Chip
                        key={stream}
                        label={stream}
                        color="info"
                        onDelete={() => removeStream(stream)}
                        size="small"
                      />
                    ))
                  )}
                </MDBox>
                <MDBox display="flex" gap={1} flexWrap="wrap">
                  <MDBox flex={1} minWidth="240px">
                    <MDInput
                      label="Add stream"
                      fullWidth
                      value={streamInput}
                      onChange={(event) => setStreamInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addStream();
                        }
                      }}
                      helperText="Examples: North, South, Blue, Red"
                    />
                  </MDBox>
                  <MDButton variant="outlined" color="info" onClick={addStream}>
                    Add
                  </MDButton>
                </MDBox>
              </Grid>
              <Grid item xs={12}>
                <Card variant="outlined">
                  <MDBox p={2} display="flex" alignItems="center">
                    <Checkbox
                      checked={allowSelfRegistration}
                      onChange={(event) => setAllowSelfRegistration(event.target.checked)}
                    />
                    <MDBox>
                      <MDTypography variant="button" fontWeight="bold">
                        Allow learner self-registration
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block">
                        When this is off, your school is hidden from the public registration form.
                      </MDTypography>
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
            </Grid>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mt={2}>
                {error}
              </MDTypography>
            )}
            <MDBox mt={3}>
              <MDButton variant="gradient" color="info" disabled={saving} onClick={saveSettings}>
                {saving ? "Saving..." : "Save School Settings"}
              </MDButton>
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolSettings;
