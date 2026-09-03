import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import MDInput from "components/MDInput";
import { useAppPalette } from "lib/appTheme";
import PropTypes from "prop-types";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { apiClient } from "lib/api";
import API_BASE_URL from "lib/apiBase";

const categories = [
  ["quiz_score", "Quizzes", "info"],
  ["typing_score", "Typing", "success"],
  ["active_course_score", "Courses", "warning"],
];

function average(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter((value) => !Number.isNaN(value));
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function LearnerDetailModal({ open, onClose, learnerId, onResetPassword }) {
  const palette = useAppPalette();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [learner, setLearner] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");

  const reportTerm = selectedTerm || learner?.term || "Term 1";
  const reportYear = selectedYear || learner?.academic_year || new Date().getFullYear();

  useEffect(() => {
    if (open && learnerId) {
      fetchLearnerDetails();
    }
  }, [open, learnerId]);

  const fetchLearnerDetails = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [learnerRes, termsRes, currentTermRes] = await Promise.all([
        apiClient.get(`/learners/${learnerId}`),
        apiClient.get("/academic/terms").catch(() => []),
        apiClient.get("/academic/terms/current").catch(() => null),
      ]);
      setLearner(learnerRes);
      setTerms(Array.isArray(termsRes) ? termsRes : []);

      const termName = currentTermRes?.name || learnerRes.term || "Term 1";
      const year =
        currentTermRes?.academic_year ||
        learnerRes.academic_year ||
        new Date(currentTermRes?.start_date || Date.now()).getFullYear();
      setSelectedTerm(termName);
      setSelectedYear(year);

      const [allocationsRes, certificatesRes, summaryRes] = await Promise.all([
        apiClient.get(`/allocations?learner_id=${learnerId}`),
        apiClient.get(`/certificates?learner_id=${learnerId}`),
        apiClient.get(`/leaderboard/summary/${learnerId}/${termName}/${year}`).catch(() => []),
      ]);
      setAllocations(allocationsRes);
      setCertificates(certificatesRes);
      setWeeklySummary(Array.isArray(summaryRes) ? summaryRes : []);
    } catch (error) {
      setMessage(error.message || "Failed to fetch learner details.");
    } finally {
      setLoading(false);
    }
  };

  const refreshPerformance = async (termName = reportTerm, year = reportYear) => {
    try {
      const summary = await apiClient
        .get(`/leaderboard/summary/${learnerId}/${termName}/${year}`)
        .catch(() => []);
      setWeeklySummary(Array.isArray(summary) ? summary : []);
    } catch (error) {
      setMessage(error.message || "Failed to load performance records.");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
      case "issued":
      case "approved":
        return "success";
      case "active":
        return "info";
      case "in_progress":
      case "pending":
        return "warning";
      case "dropped":
        return "error";
      default:
        return "default";
    }
  };

  const printReportCard = async () => {
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/reports/pdf/${learnerId}/${reportTerm}/${reportYear}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not generate report card.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleResetPassword = async () => {
    if (!onResetPassword) return;
    try {
      const result = await onResetPassword(learnerId, temporaryPassword);
      setMessage(result || "Password reset completed.");
      setTemporaryPassword("");
    } catch (error) {
      setMessage(error.message || "Password reset failed.");
    }
  };

  const handleEmailReset = async () => {
    if (!learner?.user_id) {
      setMessage("Learner login account is not linked yet.");
      return;
    }

    try {
      const result = await apiClient.put(`/users/${learner.user_id}/reset-password-email`, {});
      setMessage(result.message || "Password reset email sent.");
    } catch (error) {
      setMessage(error.message || "Password reset email failed.");
    }
  };

  const performance = categories.map(([key, label, color]) => ({
    key,
    label,
    color,
    value: average(weeklySummary, key),
  }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      // A large modal on a phone is mostly margin. Below sm it takes the whole
      // screen instead, so the learner detail is actually readable there.
      fullScreen={isSmallScreen}
      PaperProps={{
        sx: {
          borderRadius: isSmallScreen ? 0 : "14px",
          bgcolor: palette.surface,
          backgroundImage: "none",
          color: palette.text,
          "& .MuiTypography-root": { color: palette.text },
          "& .MuiTypography-caption, & .MuiTypography-body2": { color: palette.textMuted },
          // One nesting level only: the panels inside are groupings, not extra
          // raised surfaces.
          "& .MuiCard-root": {
            bgcolor: palette.surface,
            backgroundImage: "none",
            border: `1px solid ${palette.border}`,
            boxShadow: "none",
            borderRadius: "11px",
          },
          "& .MuiTableCell-head": {
            bgcolor: palette.surfaceSunken,
            color: palette.textMuted,
            fontWeight: 700,
          },
          "& .MuiTableCell-body": { borderColor: palette.borderSoft, color: palette.text },
          "& .MuiOutlinedInput-root": { bgcolor: palette.surface, color: palette.text },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: palette.border },
          "& .MuiInputLabel-root, & .MuiInputBase-input": { color: palette.text },
          "& .MuiTableContainer-root": { overflowX: "auto" },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center">
          <MDBox>
            <MDTypography variant="h6" fontWeight="bold">
              Learner Account
            </MDTypography>
            {learner && (
              <MDTypography variant="caption" color="text">
                {learner.full_name} | {learner.grade || "Grade not set"} |{" "}
                {learner.stream || "Class not set"}
              </MDTypography>
            )}
          </MDBox>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </MDBox>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {loading ? (
          <MDBox display="flex" justifyContent="center" py={5}>
            <MDTypography variant="body2" color="text">
              Loading learner details...
            </MDTypography>
          </MDBox>
        ) : learner ? (
          <MDBox>
            <Card sx={{ mb: 1.5 }}>
              <MDBox
                p={1.75}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
              >
                <MDBox display="flex" alignItems="center" gap={2}>
                  <MDBox
                    width="58px"
                    height="58px"
                    borderRadius="50%"
                    bgcolor="info.main"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color="white"
                  >
                    <Icon fontSize="medium">person</Icon>
                  </MDBox>
                  <MDBox>
                    <MDTypography variant="h5" fontWeight="bold">
                      {learner.full_name}
                    </MDTypography>
                    <MDTypography variant="body2" color="text">
                      Username: {learner.username || "-"} | Email: {learner.email || "-"}
                    </MDTypography>
                  </MDBox>
                </MDBox>
                <MDBox minWidth={{ xs: "100%", md: 260 }}>
                  <MDInput
                    label="Temporary password"
                    fullWidth
                    type="text"
                    value={temporaryPassword}
                    onChange={(event) => setTemporaryPassword(event.target.value)}
                  />
                  <MDTypography variant="caption" color="text">
                    Leave blank to send email or generate one if email is unreachable.
                  </MDTypography>
                </MDBox>
                <MDBox display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
                  <MDButton variant="outlined" color="info" size="small" onClick={printReportCard}>
                    <Icon fontSize="small">print</Icon>&nbsp;Report Card
                  </MDButton>
                  <MDButton
                    variant="text"
                    color="warning"
                    size="small"
                    onClick={handleResetPassword}
                  >
                    <Icon fontSize="small">lock_reset</Icon>&nbsp;Reset Password
                  </MDButton>
                  <MDButton variant="text" color="info" size="small" onClick={handleEmailReset}>
                    <Icon fontSize="small">mail</Icon>&nbsp;Email Reset
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>

            {message && (
              <MDTypography
                variant="caption"
                color={
                  message.includes("sent") ||
                  message.includes("generated") ||
                  message.includes("Temporary")
                    ? "success"
                    : "error"
                }
                display="block"
                mb={2}
              >
                {message}
              </MDTypography>
            )}

            <MDBox display="flex" gap={1} mb={2} flexWrap="wrap">
              {["overview", "courses", "certificates"].map((tab) => (
                <MDButton
                  key={tab}
                  variant={activeTab === tab ? "gradient" : "text"}
                  color="info"
                  onClick={() => setActiveTab(tab)}
                  size="small"
                >
                  {tab}
                </MDButton>
              ))}
            </MDBox>

            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={6}>
                <MDInput
                  select
                  label="Term records"
                  fullWidth
                  value={selectedTerm}
                  onChange={(event) => {
                    setSelectedTerm(event.target.value);
                    refreshPerformance(event.target.value, selectedYear);
                  }}
                  SelectProps={{ native: true }}
                >
                  {terms.length === 0 && <option value="">No terms configured</option>}
                  {terms.map((termItem) => (
                    <option key={termItem.id} value={termItem.name}>
                      {termItem.name} ({termItem.academic_year || "Year not set"})
                    </option>
                  ))}
                </MDInput>
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  label="Year"
                  type="number"
                  fullWidth
                  value={selectedYear}
                  onChange={(event) => {
                    setSelectedYear(event.target.value);
                    refreshPerformance(selectedTerm, event.target.value);
                  }}
                />
              </Grid>
            </Grid>

            {activeTab === "overview" && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={5}>
                  <Card>
                    <MDBox p={1.75}>
                      <MDTypography variant="h6" fontWeight="bold" mb={2}>
                        Profile
                      </MDTypography>
                      {[
                        ["Grade", learner.grade || "-"],
                        ["Class / Stream", learner.stream || "-"],
                        ["Term", learner.term || "-"],
                        ["Academic Year", learner.academic_year || "-"],
                      ].map(([label, value]) => (
                        <MDBox key={label} display="flex" justifyContent="space-between" py={0.75}>
                          <MDTypography variant="body2" color="text">
                            {label}
                          </MDTypography>
                          <MDTypography variant="body2" fontWeight="medium">
                            {value}
                          </MDTypography>
                        </MDBox>
                      ))}
                    </MDBox>
                  </Card>
                </Grid>
                <Grid item xs={12} md={7}>
                  <Card>
                    <MDBox p={1.75}>
                      <MDTypography variant="h6" fontWeight="bold" mb={2}>
                        Performance
                      </MDTypography>
                      {performance.map((item) => (
                        <MDBox key={item.key} mb={2}>
                          <MDBox display="flex" justifyContent="space-between" mb={0.75}>
                            <MDTypography variant="body2" fontWeight="medium">
                              {item.label}
                            </MDTypography>
                            <MDTypography variant="body2" color="text">
                              {item.value}%
                            </MDTypography>
                          </MDBox>
                          <LinearProgress
                            variant="determinate"
                            value={item.value}
                            color={item.color}
                          />
                        </MDBox>
                      ))}
                    </MDBox>
                  </Card>
                </Grid>
              </Grid>
            )}

            {activeTab === "courses" && (
              <Card>
                <MDBox p={1.75}>
                  {allocations.length === 0 ? (
                    <MDTypography variant="body2" color="text">
                      No courses allocated yet.
                    </MDTypography>
                  ) : (
                    allocations.map((allocation, index) => (
                      <MDBox key={allocation.id} py={1.5}>
                        <MDBox
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={2}
                        >
                          <MDBox>
                            <MDTypography variant="body2" fontWeight="medium">
                              {allocation.course_name}
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {allocation.term} | {allocation.academic_year}
                            </MDTypography>
                          </MDBox>
                          <Chip
                            label={allocation.status}
                            color={getStatusColor(allocation.status)}
                            size="small"
                          />
                        </MDBox>
                        {index < allocations.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                      </MDBox>
                    ))
                  )}
                </MDBox>
              </Card>
            )}

            {activeTab === "certificates" && (
              <Card>
                <MDBox p={1.75}>
                  {certificates.length === 0 ? (
                    <MDTypography variant="body2" color="text">
                      No certificates issued yet.
                    </MDTypography>
                  ) : (
                    certificates.map((certificate, index) => (
                      <MDBox key={certificate.id} py={1.5}>
                        <MDBox
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={2}
                        >
                          <MDBox>
                            <MDTypography variant="body2" fontWeight="medium">
                              {certificate.course_name}
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {certificate.term} | {certificate.academic_year}
                            </MDTypography>
                          </MDBox>
                          <Chip
                            label={certificate.status || certificate.completion_status}
                            color={getStatusColor(
                              certificate.status || certificate.completion_status
                            )}
                            size="small"
                          />
                        </MDBox>
                        {index < certificates.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                      </MDBox>
                    ))
                  )}
                </MDBox>
              </Card>
            )}
          </MDBox>
        ) : (
          <MDBox textAlign="center" py={5}>
            <MDTypography variant="body2" color="text">
              Learner not found.
            </MDTypography>
          </MDBox>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <MDButton onClick={onClose} color="info" variant="gradient">
          Close
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

export default LearnerDetailModal;

LearnerDetailModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  learnerId: PropTypes.number,
  onResetPassword: PropTypes.func,
};

LearnerDetailModal.defaultProps = {
  learnerId: null,
  onResetPassword: null,
};
