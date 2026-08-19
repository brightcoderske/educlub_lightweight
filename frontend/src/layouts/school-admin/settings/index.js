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
  const [aiSettings, setAiSettings] = useState({
    is_enabled: false,
    school_admin_enabled: true,
    teacher_enabled: false,
    learner_enabled: false,
    notes: "",
  });
  const [aiAvailability, setAiAvailability] = useState(null);
  const [grades, setGrades] = useState([]);
  const [streams, setStreams] = useState([]);
  const [streamInput, setStreamInput] = useState("");
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [response, aiResponse] = await Promise.all([
          apiClient.get(`/schools/${user?.schoolId}`),
          apiClient.get("/ai/school-settings").catch((err) => ({ error: err.message })),
        ]);
        setSchool(response);
        setGrades(response.grades_config?.length ? response.grades_config : allGrades);
        setStreams(normalizeList(response.streams_config || []));
        setAllowSelfRegistration(Boolean(response.allow_self_registration));
        if (!aiResponse.error) {
          setAiSettings((current) => ({ ...current, ...(aiResponse.settings || {}) }));
          setAiAvailability(aiResponse.availability || null);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    if (isSchoolAdmin() && user?.schoolId) loadSettings();
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
    setMessage("");
    try {
      const updated = await apiClient.put(`/schools/${user.schoolId}`, {
        ...school,
        grades_config: grades,
        streams_config: streams,
        allow_self_registration: allowSelfRegistration,
      });
      setSchool(updated);
      setMessage("School settings saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveAiSettings = async () => {
    setSavingAi(true);
    setError("");
    setMessage("");
    try {
      const response = await apiClient.put("/ai/school-settings", aiSettings);
      setAiSettings((current) => ({ ...current, ...(response.settings || {}) }));
      setAiAvailability(response.availability || null);
      setMessage("School AI settings saved.");
    } catch (err) {
      setError(err.message || "Failed to save school AI settings.");
    } finally {
      setSavingAi(false);
    }
  };

  if (!isSchoolAdmin()) {
    return <MDBox p={3}>Access denied. School Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={2}>
          <DashboardIdentity
            user={user}
            title="School Settings"
            subtitle="Configure grades and streams so learner forms and uploads stay consistent."
          />
        </MDBox>
        {message && (
          <MDBox mb={2} p={2} borderRadius="lg" bgColor="success">
            <MDTypography variant="button" color="white">
              {message}
            </MDTypography>
          </MDBox>
        )}
        {error && (
          <MDBox mb={2} p={2} borderRadius="lg" bgColor="error">
            <MDTypography variant="button" color="white">
              {error}
            </MDTypography>
          </MDBox>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
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
                            When this is off, your school is hidden from the public registration
                            form.
                          </MDTypography>
                        </MDBox>
                      </MDBox>
                    </Card>
                  </Grid>
                </Grid>
                <MDBox mt={3}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    disabled={saving}
                    onClick={saveSettings}
                  >
                    {saving ? "Saving..." : "Save School Settings"}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <MDBox>
                    <MDTypography variant="h5">School AI Access</MDTypography>
                    <MDTypography variant="caption" color="text">
                      System admin enables AI globally; your school decides who can use it.
                    </MDTypography>
                  </MDBox>
                  <Chip
                    color={aiSettings.is_enabled ? "success" : "default"}
                    label={aiSettings.is_enabled ? "Open" : "Closed"}
                  />
                </MDBox>

                {aiAvailability && !aiAvailability.global_enabled && (
                  <MDBox mb={2} p={1.5} borderRadius="md" bgColor="warning">
                    <MDTypography variant="caption" color="dark">
                      AI is still disabled globally by the system admin.
                    </MDTypography>
                  </MDBox>
                )}

                {[
                  ["is_enabled", "Enable AI for this school"],
                  ["school_admin_enabled", "Allow school admins"],
                  ["teacher_enabled", "Allow teachers"],
                  ["learner_enabled", "Allow learners"],
                ].map(([field, label]) => (
                  <Card variant="outlined" key={field} sx={{ mb: 1.25 }}>
                    <MDBox p={1.5} display="flex" alignItems="center">
                      <Checkbox
                        checked={Boolean(aiSettings[field])}
                        onChange={(event) =>
                          setAiSettings((current) => ({
                            ...current,
                            [field]: event.target.checked,
                          }))
                        }
                      />
                      <MDTypography variant="button" fontWeight="bold">
                        {label}
                      </MDTypography>
                    </MDBox>
                  </Card>
                ))}

                <MDInput
                  label="Internal note"
                  fullWidth
                  multiline
                  rows={3}
                  value={aiSettings.notes || ""}
                  onChange={(event) =>
                    setAiSettings((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Example: Enable learners during guided projects only."
                />

                <MDBox mt={2} display="flex" flexWrap="wrap" gap={1}>
                  {aiAvailability?.limits &&
                    Object.entries(aiAvailability.limits).map(([key, value]) => (
                      <Chip
                        key={key}
                        size="small"
                        label={`${key.replaceAll("_", " ")}: ${value}`}
                      />
                    ))}
                </MDBox>

                <MDBox mt={3}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    disabled={savingAi}
                    onClick={saveAiSettings}
                  >
                    {savingAi ? "Saving..." : "Save AI Access"}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SchoolSettings;
