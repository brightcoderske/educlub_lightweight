import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";

import DashboardIdentity from "components/DashboardIdentity";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDProgress from "components/MDProgress";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { activityLearningPath } from "../learningNavigation";
import { moduleLearningPath } from "../previewNavigation";

const SUPPORT_EMAIL = "support@educlub.co.ke";

function statusColor(status) {
  if (["completed", "graded"].includes(status)) return "success";
  if (["started", "in_progress", "submitted"].includes(status)) return "warning";
  return "default";
}

function statusLabel(status) {
  if (["completed", "graded"].includes(status)) return "Done";
  if (["started", "in_progress", "submitted"].includes(status)) return "In progress";
  return "Not done";
}

function progressColor(value) {
  if (Number(value) >= 85) return "success";
  if (Number(value) >= 45) return "info";
  return "warning";
}

function paymentSupportDetails({ user, course, txRef, transactionId, amount, currency }) {
  const learnerName = user?.fullName || user?.name || user?.full_name || "Learner";
  const learnerEmail = user?.email || "registered email";
  const courseName = course?.name || "Course";
  const paymentReference = txRef || "Not available";
  const lines = [
    "Hello eduClub Support,",
    "",
    "I paid for a course but my access has not opened.",
    "",
    `Name: ${learnerName}`,
    `Registered Email: ${learnerEmail}`,
    `Course: ${courseName}`,
    `Payment Reference: ${paymentReference}`,
    transactionId ? `Flutterwave Transaction ID: ${transactionId}` : null,
    amount ? `Amount: ${currency || "KES"} ${Number(amount).toLocaleString()}` : null,
    `Date: ${new Date().toLocaleString()}`,
    "",
    "Please help confirm and unlock my course access.",
    "",
    "Thank you.",
  ].filter(Boolean);

  return {
    subject: `Payment Support - ${courseName}`,
    body: lines.join("\n"),
  };
}

function supportMailto(details) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(details.subject)}&body=${encodeURIComponent(
    details.body
  )}`;
}

function CourseOverview() {
  const { courseId, templateId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const previewMode = pathname.includes("/preview");
  const templatePreviewMode = previewMode && pathname.startsWith("/system-admin");
  const entityId = templatePreviewMode ? templateId : courseId;
  const [overview, setOverview] = useState(null);
  const [openModules, setOpenModules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingModule, setDownloadingModule] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentSupport, setPaymentSupport] = useState(null);
  const [supportCopied, setSupportCopied] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(
        templatePreviewMode
          ? `/course-templates/${entityId}/learning-overview`
          : `/courses/${entityId}/learning-overview`
      );
      setOverview(response);
      const firstOpen = response.modules?.[0]?.id;
      setOpenModules(firstOpen ? { [firstOpen]: true } : {});
    } catch (err) {
      setError(err.message || "Failed to load course");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [entityId, templatePreviewMode]);

  useEffect(() => {
    const txRef = searchParams.get("course_tx_ref");
    const transactionId = searchParams.get("transaction_id");
    if (!txRef || !transactionId || previewMode) return;
    if (!overview?.course) return;

    const supportDetails = paymentSupportDetails({
      user,
      course: overview?.course,
      txRef,
      transactionId,
      amount: overview?.course?.independent_price_amount,
      currency: overview?.course?.independent_currency,
    });

    apiClient
      .post("/courses/payments/verify", {
        course_tx_ref: txRef,
        transaction_id: transactionId,
      })
      .then(() => {
        setPaymentMessage("Payment verified. Course access unlocked.");
        setPaymentSupport(null);
        setSearchParams({});
        loadOverview();
      })
      .catch((err) => {
        setPaymentSupport(supportDetails);
        setError(err.message || "Could not verify course payment.");
      });
  }, [searchParams, previewMode, setSearchParams, overview?.course?.id]);

  const toggleModule = (moduleId) => {
    setOpenModules((current) => ({ ...current, [moduleId]: !current[moduleId] }));
  };

  const downloadModulePdf = async (moduleId) => {
    setDownloadingModule(moduleId);
    setDownloadError("");
    try {
      const endpoint = templatePreviewMode
        ? `/course-templates/${entityId}/modules/${moduleId}/pdf`
        : `/courses/${entityId}/modules/${moduleId}/pdf`;
      const { blob, filename } = await apiClient.download(endpoint);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err.message || "Failed to download module PDF.");
    } finally {
      setDownloadingModule(null);
    }
  };

  const startCoursePayment = async () => {
    if (!overview?.course?.id) return;
    setPaying(true);
    setError("");
    setPaymentMessage("");
    setPaymentSupport(null);
    try {
      const result = await apiClient.post(`/courses/${overview.course.id}/payments/start`, {});
      if (result.status === "already_unlocked") {
        setPaymentMessage("This course is already unlocked.");
        await loadOverview();
        return;
      }
      const supportDetails = paymentSupportDetails({
        user,
        course: overview.course,
        txRef: result.txRef,
        amount: independentPrice,
        currency: independentCurrency,
      });
      setPaymentSupport(supportDetails);
      setPaymentMessage("Opening secure eduClub payment...");
      window.location.href = result.paymentLink;
    } catch (err) {
      setError(err.message || "Could not start course payment.");
    } finally {
      setPaying(false);
    }
  };

  const copySupportDetails = async () => {
    if (!paymentSupport?.body) return;
    try {
      await navigator.clipboard.writeText(`${paymentSupport.subject}\n\n${paymentSupport.body}`);
      setSupportCopied(true);
      window.setTimeout(() => setSupportCopied(false), 2500);
    } catch (err) {
      setSupportCopied(false);
    }
  };

  const independentPrice = Number(overview?.course?.independent_price_amount || 0);
  const independentCurrency = overview?.course?.independent_currency || "KES";

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3} display="flex" justifyContent="space-between" alignItems="center" gap={2}>
          <DashboardIdentity
            user={user}
            title={overview?.course?.name || "Course"}
            subtitle={overview?.course?.description || "Your modules and activities"}
          />
          <MDButton
            variant="outlined"
            color="dark"
            onClick={() =>
              navigate(
                templatePreviewMode
                  ? `/system-admin/courses/${entityId}/builder`
                  : previewMode
                  ? `/school-admin/courses/${entityId}/builder`
                  : "/learner"
              )
            }
          >
            {previewMode ? "Back to Builder" : "Back"}
          </MDButton>
        </MDBox>

        {previewMode && (
          <MDBox mb={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#fff7ed" }}>
            <MDTypography variant="body2" color="warning" fontWeight="medium">
              Preview mode uses learner sequencing but does not save learner progress.
            </MDTypography>
            {downloadError && (
              <MDTypography variant="caption" color="error" display="block" mt={0.5}>
                {downloadError}
              </MDTypography>
            )}
          </MDBox>
        )}

        {!previewMode && overview?.preview && (
          <MDBox mb={2} p={2} borderRadius="md" sx={{ bgcolor: "#fff7ed" }}>
            <MDBox
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1.5}
            >
              <MDBox>
                <MDTypography variant="button" color="warning" fontWeight="bold">
                  Course preview
                </MDTypography>
                <MDTypography variant="body2" color="text">
                  First {overview.preview.preview_activity_limit || 3} activities are open. Pay to
                  continue the full course with tutor guidance.
                </MDTypography>
                {independentPrice > 0 && (
                  <MDTypography variant="caption" color="text" display="block">
                    Course access: {independentCurrency}{" "}
                    {independentPrice.toLocaleString()}
                  </MDTypography>
                )}
                {paymentMessage && (
                  <MDTypography variant="caption" color="success" display="block">
                    {paymentMessage}
                  </MDTypography>
                )}
                {paymentSupport && (
                  <MDBox mt={1.5} display="flex" flexWrap="wrap" gap={1}>
                    <MDButton
                      component="a"
                      href={supportMailto(paymentSupport)}
                      variant="outlined"
                      color="dark"
                      size="small"
                      startIcon={<Icon fontSize="small">support_agent</Icon>}
                    >
                      Contact Support
                    </MDButton>
                    <MDButton
                      variant="text"
                      color="dark"
                      size="small"
                      startIcon={<Icon fontSize="small">content_copy</Icon>}
                      onClick={copySupportDetails}
                    >
                      {supportCopied ? "Copied" : "Copy Details"}
                    </MDButton>
                  </MDBox>
                )}
              </MDBox>
              <MDButton
                variant="gradient"
                color="warning"
                startIcon={<Icon fontSize="small">lock_open</Icon>}
                disabled={paying}
                onClick={startCoursePayment}
              >
                {paying ? "Opening..." : "Pay to continue"}
              </MDButton>
            </MDBox>
          </MDBox>
        )}

        {loading ? (
          <Card>
            <MDBox p={4}>
              <MDTypography variant="body2" color="text">
                Loading course...
              </MDTypography>
            </MDBox>
          </Card>
        ) : error ? (
          <Card>
            <MDBox p={4}>
              <MDTypography variant="body2" color="error" fontWeight="medium">
                {error}
              </MDTypography>
              {paymentSupport && (
                <MDBox mt={2} display="flex" flexWrap="wrap" gap={1}>
                  <MDButton
                    component="a"
                    href={supportMailto(paymentSupport)}
                    variant="gradient"
                    color="info"
                    startIcon={<Icon fontSize="small">support_agent</Icon>}
                  >
                    Contact Support
                  </MDButton>
                  <MDButton
                    variant="outlined"
                    color="dark"
                    startIcon={<Icon fontSize="small">content_copy</Icon>}
                    onClick={copySupportDetails}
                  >
                    {supportCopied ? "Copied" : "Copy Support Details"}
                  </MDButton>
                </MDBox>
              )}
            </MDBox>
          </Card>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <MDBox display="flex" flexDirection="column" gap={2}>
                {overview.modules.map((courseModule, index) => (
                  <Card key={courseModule.id}>
                    <MDBox p={2.5}>
                      <MDBox
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        flexWrap={{ xs: "wrap", md: "nowrap" }}
                        gap={2}
                      >
                        <MDBox flex={1} minWidth={0}>
                          <MDBox display="flex" alignItems="center" gap={1} mb={0.5}>
                            <Chip
                              size="small"
                              label={`Module ${index + 1}`}
                              color={courseModule.is_done ? "success" : "info"}
                            />
                            {courseModule.is_done && (
                              <Chip size="small" label="Complete" color="success" />
                            )}
                          </MDBox>
                          <MDTypography variant="h6" fontWeight="bold">
                            {courseModule.title}
                          </MDTypography>
                          <MDTypography variant="body2" color="text">
                            {courseModule.description || "Activities for this module."}
                          </MDTypography>
                        </MDBox>
                        <MDBox width={{ xs: 96, sm: 150 }} textAlign="right">
                          <MDTypography variant="button" color="text" fontWeight="medium">
                            {courseModule.completed_activities}/{courseModule.total_activities} done
                          </MDTypography>
                          <MDProgress
                            value={courseModule.progress_percent}
                            color={progressColor(courseModule.progress_percent)}
                            sx={{ mt: 0.75 }}
                          />
                          <MDTypography variant="caption" color="text">
                            {courseModule.score_percent}% marks
                          </MDTypography>
                        </MDBox>
                        <MDBox display="flex" alignItems="center" gap={0.75}>
                          {previewMode && (
                            <MDButton
                              size="small"
                              variant="outlined"
                              color="info"
                              disabled={downloadingModule === courseModule.id}
                              startIcon={<Icon fontSize="small">picture_as_pdf</Icon>}
                              onClick={() => downloadModulePdf(courseModule.id)}
                            >
                              {downloadingModule === courseModule.id
                                ? "Preparing..."
                                : "Download PDF"}
                            </MDButton>
                          )}
                          <IconButton
                            size="small"
                            aria-label="Toggle activities"
                            onClick={() => toggleModule(courseModule.id)}
                          >
                            <Icon>
                              {openModules[courseModule.id] ? "expand_less" : "expand_more"}
                            </Icon>
                          </IconButton>
                        </MDBox>
                      </MDBox>

                      <Collapse in={Boolean(openModules[courseModule.id])}>
                        <MDBox mt={2} borderTop="1px solid #e5e7eb" pt={1.5}>
                          {courseModule.activities.length === 0 ? (
                            <MDTypography variant="caption" color="text">
                              No activities have been added yet.
                            </MDTypography>
                          ) : (
                            courseModule.activities.map((activity) => (
                              <MDBox
                                key={activity.id}
                                component="button"
                                type="button"
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                width="100%"
                                py={1.25}
                                px={1}
                                border={0}
                                textAlign="left"
                                disabled={!activity.is_unlocked}
                                aria-disabled={!activity.is_unlocked}
                                title={activity.lock_reason || ""}
                                onClick={() => {
                                  if (!activity.is_unlocked) {
                                    setError(
                                      activity.lock_reason ||
                                        "Complete the previous required activity first."
                                    );
                                    return;
                                  }
                                  navigate(
                                    previewMode
                                      ? moduleLearningPath(
                                          overview.course.id,
                                          courseModule.id,
                                          activity.id,
                                          true,
                                          templatePreviewMode
                                        )
                                      : activityLearningPath(
                                          overview.course.id,
                                          courseModule.id,
                                          activity.id
                                        )
                                  );
                                }}
                                sx={{
                                  borderBottom: "1px solid #f1f3f4",
                                  bgcolor: "transparent",
                                  cursor: activity.is_unlocked ? "pointer" : "not-allowed",
                                  opacity: activity.is_unlocked ? 1 : 0.58,
                                  "&:hover": activity.is_unlocked
                                    ? { bgcolor: "#f8fafc" }
                                    : undefined,
                                }}
                              >
                                <MDBox display="flex" alignItems="center" gap={1.25} minWidth={0}>
                                  <Icon fontSize="small" color="action">
                                    {activity.status === "completed"
                                      ? "check_circle"
                                      : "radio_button_unchecked"}
                                  </Icon>
                                  <MDBox minWidth={0}>
                                    <MDTypography variant="button" fontWeight="medium">
                                      {activity.title}
                                    </MDTypography>
                                    <MDTypography variant="caption" color="text" display="block">
                                      {activity.activity_type} | {activity.points || 0} marks
                                    </MDTypography>
                                    {!activity.is_unlocked && (
                                      <MDTypography variant="caption" color="error" display="block">
                                        {activity.lock_reason ||
                                          "Complete the previous activity first."}
                                      </MDTypography>
                                    )}
                                  </MDBox>
                                </MDBox>
                                <Chip
                                  size="small"
                                  label={statusLabel(activity.status)}
                                  color={statusColor(activity.status)}
                                />
                              </MDBox>
                            ))
                          )}
                          <MDBox display="flex" justifyContent="flex-end" gap={1} mt={2}>
                            <MDButton
                              variant="gradient"
                              color={courseModule.is_unlocked ? "success" : "warning"}
                              disabled={!courseModule.is_unlocked}
                              startIcon={<Icon fontSize="small">open_in_new</Icon>}
                              onClick={() =>
                                navigate(
                                  moduleLearningPath(
                                    overview.course.id,
                                    courseModule.id,
                                    null,
                                    previewMode,
                                    templatePreviewMode
                                  )
                                )
                              }
                            >
                              {courseModule.is_unlocked ? "Open Module" : "Locked"}
                            </MDButton>
                          </MDBox>
                        </MDBox>
                      </Collapse>
                    </MDBox>
                  </Card>
                ))}
              </MDBox>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card>
                <MDBox p={3}>
                  <MDTypography variant="h6" fontWeight="bold">
                    Course Progress
                  </MDTypography>
                  <MDBox my={2}>
                    <MDProgress
                      value={overview.summary.progress_percent}
                      color={progressColor(overview.summary.progress_percent)}
                      label
                    />
                  </MDBox>
                  <MDTypography variant="body2" color="text">
                    {overview.summary.completed_activities} of {overview.summary.total_activities}{" "}
                    activities complete.
                  </MDTypography>
                  <MDBox display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mt={2}>
                    <MDBox p={1.5} border="1px solid #e5e7eb" borderRadius="md">
                      <MDTypography variant="caption" color="text">
                        Modules
                      </MDTypography>
                      <MDTypography variant="h5" fontWeight="bold">
                        {overview.summary.completed_modules}/{overview.summary.total_modules}
                      </MDTypography>
                    </MDBox>
                    <MDBox p={1.5} border="1px solid #e5e7eb" borderRadius="md">
                      <MDTypography variant="caption" color="text">
                        Marks
                      </MDTypography>
                      <MDTypography variant="h5" fontWeight="bold">
                        {overview.summary.score_percent}%
                      </MDTypography>
                    </MDBox>
                  </MDBox>
                  {overview.summary.is_done && (
                    <MDBox mt={2} p={2} bgColor="success" borderRadius="md">
                      <MDTypography variant="button" color="white" fontWeight="bold">
                        Course complete
                      </MDTypography>
                    </MDBox>
                  )}
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default CourseOverview;
