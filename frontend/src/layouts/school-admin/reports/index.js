import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Autocomplete from "@mui/material/Autocomplete";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import API_BASE_URL from "lib/apiBase";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";

const feedbackTemplates = [
  "Excellent effort, {learnerName}. Keep building on this strong progress.",
  "{learnerName} is showing steady improvement and should continue practicing consistently.",
  "{learnerName} participates well and is beginning to gain confidence in digital skills.",
  "A good term overall for {learnerName}. More revision will help improve accuracy and speed.",
  "{learnerName} has potential to do even better with regular weekly practice.",
  "Well done, {learnerName}. Your commitment to learning is clearly visible in this report.",
  "{learnerName} should focus on completing all assigned activities to strengthen overall progress.",
  "This has been a promising term for {learnerName}. Keep aiming higher in quizzes and typing.",
  "{learnerName} is encouraged to stay consistent and ask for support where needed.",
  "Keep going, {learnerName}. Small improvements each week will lead to strong results.",
];

const defaultReportSettings = {
  show_weekly_typing: true,
  show_weekly_quizzes: true,
  show_active_courses: true,
  show_competitions: true,
  show_badges: true,
  show_teacher_feedback: true,
};

const reportSettingOptions = [
  ["show_weekly_typing", "Weekly typing"],
  ["show_weekly_quizzes", "Weekly quizzes"],
  ["show_active_courses", "Active courses"],
  ["show_competitions", "Competitions"],
  ["show_badges", "Badges"],
  ["show_teacher_feedback", "Teacher feedback"],
];

function Reports() {
  const { user, isSchoolAdmin } = useAuth();
  const [reportType, setReportType] = useState("single"); // single, class, school
  const [learner, setLearner] = useState(null);
  const [learners, setLearners] = useState([]);
  const [terms, setTerms] = useState([]);
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState(2024);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTemplate, setFeedbackTemplate] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [reportSettings, setReportSettings] = useState(defaultReportSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const isStaff = isSchoolAdmin() || user?.role === "teacher";
  const optionsCacheKey = `school-admin:${user?.schoolId}:reports-options`;

  useEffect(() => {
    const loadOptions = async () => {
      const cached = getCachedPage(optionsCacheKey)?.value;
      if (cached) {
        setLearners(cached.learners || []);
        setTerms(cached.terms || []);
        setReportSettings(cached.reportSettings || defaultReportSettings);
      }
      try {
        const [learnersRes, termsRes, settingsRes] = await Promise.all([
          apiClient.get(`/learners?school_id=${user?.schoolId}`),
          apiClient.get("/academic/terms"),
          apiClient.get("/reports/settings"),
        ]);
        setLearners(learnersRes);
        setTerms(termsRes);
        setReportSettings(settingsRes || defaultReportSettings);
        setCachedPage(optionsCacheKey, {
          learners: learnersRes,
          terms: termsRes,
          reportSettings: settingsRes || defaultReportSettings,
        });
        const activeTerm = termsRes.find((item) => item.is_active) || termsRes[0];
        if (activeTerm) {
          setTerm(activeTerm.name);
          setAcademicYear(activeTerm.academic_year || activeTerm.year || new Date().getFullYear());
        }
      } catch (err) {
        setError(err.message);
      }
    };

    if (isStaff && user?.schoolId) loadOptions();
  }, [user?.schoolId]);

  useEffect(() => {
    const loadFeedback = async () => {
      if (!learner?.id || !term || !academicYear) {
        setFeedbackText("");
        setFeedbackTemplate("");
        setFeedbackMessage("");
        return;
      }
      setFeedbackLoading(true);
      try {
        const response = await apiClient.get(
          `/reports/feedback/${learner.id}?term=${encodeURIComponent(
            term
          )}&academicYear=${academicYear}`
        );
        setFeedbackText(response?.comment_text || "");
        setFeedbackTemplate("");
      } catch (err) {
        setError(err.message);
      } finally {
        setFeedbackLoading(false);
      }
    };

    if (reportType === "single") {
      loadFeedback();
    }
  }, [learner?.id, term, academicYear, reportType]);

  if (!isStaff) {
    return <MDBox>Access denied. School staff only.</MDBox>;
  }

  const applyTemplate = (template) => {
    setFeedbackTemplate(template);
    setFeedbackText(template.replaceAll("{learnerName}", learner?.full_name || "the learner"));
  };

  const saveFeedback = async () => {
    if (!learner) {
      setError("Choose a learner first.");
      return;
    }
    setFeedbackSaving(true);
    setError("");
    setFeedbackMessage("");
    try {
      await apiClient.put(`/reports/feedback/${learner.id}`, {
        term,
        academicYear,
        comment_text: feedbackText,
      });
      setFeedbackMessage(
        feedbackText.trim()
          ? "Teacher feedback saved. It will appear on the report card."
          : "Teacher feedback cleared. It will not appear on the report card."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setFeedbackSaving(false);
    }
  };

  const updateReportSetting = (key) => {
    setSettingsMessage("");
    setReportSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const saveReportSettings = async () => {
    if (!isSchoolAdmin()) return;
    setSettingsSaving(true);
    setSettingsMessage("");
    setError("");
    try {
      const saved = await apiClient.put("/reports/settings", {
        settings: reportSettings,
      });
      const nextSettings = saved || reportSettings;
      setReportSettings(nextSettings);
      setCachedPage(optionsCacheKey, {
        learners,
        terms,
        reportSettings: nextSettings,
      });
      setSettingsMessage("Report card sections updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    setError("");
    setLoading(true);

    try {
      let url = "";
      let filename = "";

      if (reportType === "single") {
        if (!learner) {
          setError("Please choose a learner from the search results.");
          setLoading(false);
          return;
        }
        url = `${API_BASE_URL}/reports/pdf/${learner.id}/${term}/${academicYear}`;
        filename = `report_${learner.full_name}_${term}_${academicYear}.pdf`;
      } else if (reportType === "class") {
        if (!grade) {
          setError("Please enter a grade");
          setLoading(false);
          return;
        }
        const response = await fetch(`${API_BASE_URL}/reports/pdf/class`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ grade, stream, term, academicYear }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `reports_${grade}_${stream}_${term}_${academicYear}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setLoading(false);
        return;
      } else if (reportType === "school") {
        const response = await fetch(`${API_BASE_URL}/reports/pdf/school`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ term, academicYear }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `reports_school_${term}_${academicYear}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setLoading(false);
        return;
      }

      // For single learner PDF
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Performance Reports"
        subtitle="Generate branded PDF reports with course performance and weekly progress."
      />
      <MDBox py={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Report Configuration
                </MDTypography>

                <MDBox mb={2}>
                  <MDTypography variant="body2" mb={1}>
                    Report Type
                  </MDTypography>
                  <MDButton
                    variant={reportType === "single" ? "contained" : "outlined"}
                    color="info"
                    onClick={() => setReportType("single")}
                    sx={{ mr: 1 }}
                  >
                    Single Learner
                  </MDButton>
                  <MDButton
                    variant={reportType === "class" ? "contained" : "outlined"}
                    color="info"
                    onClick={() => setReportType("class")}
                    sx={{ mr: 1 }}
                  >
                    Class
                  </MDButton>
                  <MDButton
                    variant={reportType === "school" ? "contained" : "outlined"}
                    color="info"
                    onClick={() => setReportType("school")}
                  >
                    Whole School
                  </MDButton>
                </MDBox>

                <Divider sx={{ my: 2 }} />

                <MDBox mb={2}>
                  <MDBox
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={2}
                    flexWrap="wrap"
                    mb={1}
                  >
                    <MDBox>
                      <MDTypography variant="h6">Report Sections</MDTypography>
                      <MDTypography variant="caption" color="text">
                        Choose what appears on generated report cards for this school.
                      </MDTypography>
                    </MDBox>
                    {isSchoolAdmin() && (
                      <MDButton
                        variant="outlined"
                        color="info"
                        size="small"
                        onClick={saveReportSettings}
                        disabled={settingsSaving}
                      >
                        {settingsSaving ? "Saving..." : "Save Sections"}
                      </MDButton>
                    )}
                  </MDBox>
                  <Grid container spacing={1}>
                    {reportSettingOptions.map(([key, label]) => (
                      <Grid item xs={12} sm={6} md={4} key={key}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Boolean(reportSettings[key])}
                              onChange={() => updateReportSetting(key)}
                              disabled={!isSchoolAdmin() || settingsSaving}
                            />
                          }
                          label={label}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  {user?.role === "teacher" && (
                    <MDTypography variant="caption" color="text">
                      Report sections are controlled by the school admin.
                    </MDTypography>
                  )}
                  {settingsMessage && (
                    <MDTypography variant="caption" color="success" display="block">
                      {settingsMessage}
                    </MDTypography>
                  )}
                </MDBox>

                {reportType === "single" && (
                  <>
                    <MDBox mb={2}>
                      <Autocomplete
                        options={learners}
                        getOptionLabel={(option) =>
                          `${option.full_name} - ${option.grade || "No grade"} ${
                            option.stream || ""
                          }`
                        }
                        value={learner}
                        onChange={(_, value) => setLearner(value)}
                        renderInput={(params) => (
                          <MDInput {...params} label="Search learner by name" />
                        )}
                      />
                    </MDBox>
                    <Card sx={{ p: 2, mb: 2, bgcolor: "#f8fafc" }}>
                      <MDTypography variant="h6" mb={1}>
                        Teacher Feedback
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block" mb={2}>
                        Optional. If no feedback is saved, nothing will show on the report card.
                      </MDTypography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <MDInput
                            select
                            label="Comment Template"
                            fullWidth
                            value={feedbackTemplate}
                            onChange={(event) => applyTemplate(event.target.value)}
                            SelectProps={{ native: true }}
                            disabled={!learner || feedbackLoading}
                          >
                            <option value="">Choose a template</option>
                            {feedbackTemplates.map((template, index) => (
                              <option key={template} value={template}>
                                Template {index + 1}
                              </option>
                            ))}
                          </MDInput>
                        </Grid>
                        <Grid item xs={12} md={8}>
                          <MDInput
                            label="Feedback"
                            multiline
                            rows={4}
                            fullWidth
                            value={feedbackText}
                            onChange={(event) => setFeedbackText(event.target.value)}
                            disabled={!learner || feedbackLoading}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <MDButton
                            variant="outlined"
                            color="info"
                            onClick={saveFeedback}
                            disabled={!learner || feedbackLoading || feedbackSaving}
                          >
                            {feedbackSaving ? "Saving..." : "Save Feedback"}
                          </MDButton>
                          {feedbackMessage && (
                            <MDTypography variant="caption" color="success" display="block" mt={1}>
                              {feedbackMessage}
                            </MDTypography>
                          )}
                        </Grid>
                      </Grid>
                    </Card>
                  </>
                )}

                {reportType === "class" && (
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={6}>
                      <MDInput
                        label="Grade"
                        fullWidth
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <MDInput
                        label="Stream"
                        fullWidth
                        value={stream}
                        onChange={(e) => setStream(e.target.value)}
                      />
                    </Grid>
                  </Grid>
                )}

                <Grid container spacing={2} mb={2}>
                  <Grid item xs={6}>
                    <MDInput
                      select
                      label="Term"
                      fullWidth
                      value={term}
                      onChange={(e) => {
                        const selected = terms.find((item) => item.name === e.target.value);
                        setTerm(e.target.value);
                        if (selected) {
                          setAcademicYear(
                            selected.academic_year || selected.year || new Date().getFullYear()
                          );
                        }
                      }}
                      SelectProps={{ native: true }}
                    >
                      <option value="" />
                      {terms.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name} - {item.academic_year || item.year}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      label="Academic Year"
                      fullWidth
                      type="number"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(parseInt(e.target.value))}
                    />
                  </Grid>
                </Grid>

                {error && (
                  <MDBox mb={2}>
                    <MDTypography variant="caption" color="error">
                      {error}
                    </MDTypography>
                  </MDBox>
                )}

                <MDButton
                  variant="gradient"
                  color="success"
                  fullWidth
                  onClick={handleGenerateReport}
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate Report"}
                </MDButton>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default Reports;
