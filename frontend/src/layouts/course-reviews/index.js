import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import {
  buildReportQuery,
  canRevealIdentity,
  formatRating,
  getRatingDistribution,
  getRatingPercent,
  getRatingPresentation,
  reportMatchesMode,
} from "./reportUtils";

const initialFilters = {
  page: 1,
  pageSize: 10,
  search: "",
  moduleId: "",
  rating: "",
  from: "",
  to: "",
};

function RatingChip({ value }) {
  const presentation = getRatingPresentation(value);
  return (
    <Chip
      size="small"
      color={presentation.color}
      label={value ? `${formatRating(value)} · ${presentation.label}` : presentation.label}
    />
  );
}

function SummaryCard({ label, value, icon, color = "info" }) {
  return (
    <Card sx={{ height: "100%" }}>
      <MDBox p={2.5} display="flex" alignItems="center" justifyContent="space-between" gap={2}>
        <MDBox minWidth={0}>
          <MDTypography variant="caption" color="text">
            {label}
          </MDTypography>
          <MDTypography variant="h4" fontWeight="bold">
            {value}
          </MDTypography>
        </MDBox>
        <MDBox
          width={42}
          height={42}
          borderRadius="8px"
          bgcolor={`${color}.main`}
          color="white"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon>{icon}</Icon>
        </MDBox>
      </MDBox>
    </Card>
  );
}

function RatingDistribution({ summary }) {
  const rows = getRatingDistribution(summary);
  const total = Number(summary?.response_count || 0);
  return (
    <Card sx={{ height: "100%" }}>
      <MDBox p={2.5}>
        <MDTypography variant="h6" mb={2}>
          Rating distribution
        </MDTypography>
        {rows.map((row) => (
          <MDBox
            key={row.rating}
            display="grid"
            gridTemplateColumns="44px 1fr 36px"
            alignItems="center"
            gap={1}
            mb={1}
          >
            <MDTypography variant="caption">{row.rating} star</MDTypography>
            <MDBox height={7} bgcolor="#e2e8f0" borderRadius="4px" overflow="hidden">
              <MDBox
                height="100%"
                width={`${getRatingPercent(row.count, total)}%`}
                bgcolor={row.rating >= 4 ? "#16a34a" : row.rating === 3 ? "#d97706" : "#dc2626"}
              />
            </MDBox>
            <MDTypography variant="caption" textAlign="right">
              {row.count}
            </MDTypography>
          </MDBox>
        ))}
      </MDBox>
    </Card>
  );
}

function Pager({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <MDBox mt={2} display="flex" alignItems="center" justifyContent="space-between" gap={2}>
      <MDTypography variant="caption" color="text">
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
      </MDTypography>
      <MDBox display="flex" gap={1}>
        <MDButton
          variant="outlined"
          color="dark"
          size="small"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
        >
          Previous
        </MDButton>
        <MDButton
          variant="outlined"
          color="dark"
          size="small"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
        >
          Next
        </MDButton>
      </MDBox>
    </MDBox>
  );
}

function TemplateReport({ report, draft, setDraft, applyFilters, openCourse, setPage }) {
  const versions = report.schoolVersions || [];
  return (
    <>
      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label="Overall rating"
            value={formatRating(report.summary?.average_rating)}
            icon="star"
            color="warning"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard label="Reviews" value={report.summary?.response_count || 0} icon="reviews" />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label="Schools"
            value={report.summary?.school_count || 0}
            icon="domain"
            color="success"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label="Modules needing attention"
            value={report.summary?.low_rated_module_count || 0}
            icon="priority_high"
            color="error"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Card>
            <MDBox p={2.5}>
              <MDBox display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={1} mb={2}>
                <MDInput
                  label="Search school or course"
                  fullWidth
                  value={draft.search}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, search: event.target.value }))
                  }
                  onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                />
                <MDButton color="info" onClick={applyFilters}>
                  Search
                </MDButton>
              </MDBox>

              {versions.length === 0 ? (
                <MDTypography variant="body2" color="text">
                  No school versions match this search.
                </MDTypography>
              ) : (
                <>
                  <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                    <Table>
                      <TableHead sx={{ display: "table-header-group" }}>
                        <TableRow>
                          <TableCell>School version</TableCell>
                          <TableCell>Reviews</TableCell>
                          <TableCell>Overall</TableCell>
                          <TableCell>Lowest module</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versions.map((version) => (
                          <TableRow key={version.course_id} hover>
                            <TableCell>
                              <MDTypography variant="button" fontWeight="medium">
                                {version.school_name}
                              </MDTypography>
                              <MDTypography variant="caption" color="text" display="block">
                                {version.course_name} · School v{version.school_version}
                              </MDTypography>
                            </TableCell>
                            <TableCell>{version.response_count}</TableCell>
                            <TableCell>
                              <RatingChip value={version.average_rating} />
                            </TableCell>
                            <TableCell>
                              <RatingChip value={version.lowest_module_rating} />
                            </TableCell>
                            <TableCell align="right">
                              <MDButton
                                size="small"
                                color="info"
                                onClick={() => openCourse(version.course_id)}
                              >
                                Open report
                              </MDButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <MDBox display={{ xs: "grid", md: "none" }} gap={1.5}>
                    {versions.map((version) => (
                      <MDBox
                        key={version.course_id}
                        p={1.75}
                        border="1px solid"
                        borderColor={
                          Number(version.lowest_module_rating) < 3 ? "error.main" : "grey.300"
                        }
                        borderRadius="8px"
                      >
                        <MDTypography variant="button" fontWeight="medium">
                          {version.school_name}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block" mb={1}>
                          {version.course_name} · {version.response_count} reviews
                        </MDTypography>
                        <MDBox display="flex" gap={1} flexWrap="wrap" mb={1.5}>
                          <RatingChip value={version.average_rating} />
                          <RatingChip value={version.lowest_module_rating} />
                        </MDBox>
                        <MDButton
                          size="small"
                          color="info"
                          fullWidth
                          onClick={() => openCourse(version.course_id)}
                        >
                          Open report
                        </MDButton>
                      </MDBox>
                    ))}
                  </MDBox>
                </>
              )}
              <Pager pagination={report.pagination} onPage={setPage} />
            </MDBox>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <RatingDistribution summary={report.summary} />
        </Grid>
      </Grid>
    </>
  );
}

function CourseReport({
  report,
  draft,
  setDraft,
  applyFilters,
  setPage,
  allowReveal,
  requestReveal,
}) {
  const modules = report.modules || [];
  const comments = report.comments || [];
  return (
    <>
      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label="Course rating"
            value={formatRating(report.summary?.average_rating)}
            icon="star"
            color="warning"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard
            label="Responses"
            value={report.summary?.response_count || 0}
            icon="reviews"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <RatingDistribution summary={report.summary} />
        </Grid>
      </Grid>

      <Card sx={{ mb: 2 }}>
        <MDBox p={2.5}>
          <MDTypography variant="h6" mb={2}>
            Filter reviews
          </MDTypography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                size="small"
                fullWidth
                label="Module"
                value={draft.moduleId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, moduleId: event.target.value }))
                }
              >
                <MenuItem value="">All modules</MenuItem>
                {modules.map((module) => (
                  <MenuItem key={module.module_id} value={module.module_id}>
                    {module.module_title}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                select
                size="small"
                fullWidth
                label="Rating"
                value={draft.rating}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, rating: event.target.value }))
                }
              >
                <MenuItem value="">All</MenuItem>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <MenuItem key={rating} value={rating}>
                    {rating} star
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                size="small"
                fullWidth
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={draft.from}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, from: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                size="small"
                fullWidth
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={draft.to}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, to: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={6} sm={3} md={3}>
              <MDButton color="info" fullWidth onClick={applyFilters}>
                Apply filters
              </MDButton>
            </Grid>
          </Grid>
        </MDBox>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={5}>
          <Card sx={{ height: "100%" }}>
            <MDBox p={2.5}>
              <MDTypography variant="h6" mb={2}>
                Module ratings
              </MDTypography>
              {modules.length === 0 ? (
                <MDTypography variant="body2" color="text">
                  No modules match the current filters.
                </MDTypography>
              ) : (
                <MDBox display="grid" gap={1.25}>
                  {modules.map((module) => {
                    const attention =
                      Number(module.average_rating) < 3 && module.response_count > 0;
                    return (
                      <MDBox
                        key={module.module_id}
                        p={1.5}
                        border="1px solid"
                        borderColor={attention ? "error.main" : "grey.300"}
                        borderRadius="8px"
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                      >
                        <MDBox minWidth={0}>
                          <MDTypography variant="button" fontWeight="medium">
                            {module.module_title}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            {module.response_count} responses
                          </MDTypography>
                        </MDBox>
                        <RatingChip value={module.average_rating} />
                      </MDBox>
                    );
                  })}
                </MDBox>
              )}
            </MDBox>
          </Card>
        </Grid>
        <Grid item xs={12} lg={7}>
          <Card>
            <MDBox p={2.5}>
              <MDTypography variant="h6" mb={2}>
                Anonymous learner comments
              </MDTypography>
              {comments.length === 0 ? (
                <MDTypography variant="body2" color="text">
                  No written reviews match the current filters.
                </MDTypography>
              ) : (
                <MDBox display="grid" gap={1.25}>
                  {comments.map((comment) => (
                    <MDBox
                      key={comment.id}
                      p={1.75}
                      bgcolor="#f8fafc"
                      border="1px solid"
                      borderColor="grey.200"
                      borderRadius="8px"
                    >
                      <MDBox
                        display="flex"
                        alignItems="flex-start"
                        justifyContent="space-between"
                        gap={1}
                        mb={1}
                      >
                        <MDBox>
                          <MDTypography variant="button" fontWeight="medium">
                            {comment.module_title}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            {new Date(comment.updated_at).toLocaleDateString()}
                          </MDTypography>
                        </MDBox>
                        <Chip size="small" color="warning" label={`${comment.rating} star`} />
                      </MDBox>
                      <MDTypography variant="body2">{comment.comment}</MDTypography>
                      {allowReveal && (
                        <MDBox mt={1.5}>
                          <MDButton
                            variant="text"
                            color="dark"
                            size="small"
                            onClick={() => requestReveal(comment)}
                          >
                            Reveal identity
                          </MDButton>
                        </MDBox>
                      )}
                    </MDBox>
                  ))}
                </MDBox>
              )}
              <Pager pagination={report.pagination} onPage={setPage} />
            </MDBox>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}

function CourseReviews() {
  const { templateId, courseId } = useParams();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTemplateMode = Boolean(templateId);
  const selectedCourseId = isTemplateMode ? new URLSearchParams(search).get("courseId") : courseId;
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revealComment, setRevealComment] = useState(null);
  const [revealReason, setRevealReason] = useState("");
  const [revealedIdentity, setRevealedIdentity] = useState(null);
  const [revealing, setRevealing] = useState(false);

  const detailMode = Boolean(selectedCourseId);
  const endpoint = useMemo(() => {
    const query = buildReportQuery(filters);
    const base = detailMode
      ? `/courses/${selectedCourseId}/feedback-report`
      : `/courses/templates/${templateId}/feedback-report`;
    return query ? `${base}?${query}` : base;
  }, [detailMode, filters, selectedCourseId, templateId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await apiClient.get(endpoint));
    } catch (requestError) {
      setError(requestError.message || "Failed to load course reviews");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const applyFilters = () => {
    setFilters((current) => ({ ...current, ...draft, page: 1 }));
  };

  const setPage = (page) => {
    setFilters((current) => ({ ...current, page }));
    setDraft((current) => ({ ...current, page }));
  };

  const openCourse = (id) => {
    setFilters(initialFilters);
    setDraft(initialFilters);
    navigate(`${pathname}?courseId=${id}`);
  };

  const goBack = () => {
    if (isTemplateMode && detailMode) {
      setFilters(initialFilters);
      setDraft(initialFilters);
      navigate(pathname);
      return;
    }
    navigate(isTemplateMode ? "/system-admin/courses" : "/school-admin/courses");
  };

  const revealIdentity = async () => {
    if (!revealReason.trim()) return;
    setRevealing(true);
    try {
      const identity = await apiClient.post(`/courses/feedback/${revealComment.id}/reveal`, {
        reason: revealReason,
      });
      setRevealedIdentity(identity);
    } catch (requestError) {
      setError(requestError.message || "Failed to reveal learner identity");
    } finally {
      setRevealing(false);
    }
  };

  const title = detailMode
    ? report?.course?.name || "Course reviews"
    : report?.template?.name || "Course reviews";
  const subtitle = detailMode
    ? `${report?.course?.school_name || ""} · School course version ${
        report?.course?.school_version || 1
      }`
    : "Compare learner feedback across adopted school versions.";

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox
          mb={2.5}
          display="flex"
          flexDirection={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          gap={1.5}
        >
          <MDBox>
            <MDButton variant="text" color="dark" size="small" onClick={goBack}>
              <Icon sx={{ mr: 0.5 }}>arrow_back</Icon>
              Back
            </MDButton>
            <MDTypography variant="h3" mt={0.5}>
              {title}
            </MDTypography>
            <MDTypography variant="body2" color="text">
              {subtitle}
            </MDTypography>
          </MDBox>
          <MDButton variant="outlined" color="info" onClick={loadReport}>
            <Icon sx={{ mr: 0.5 }}>refresh</Icon>
            Refresh
          </MDButton>
        </MDBox>

        {error && (
          <Card sx={{ mb: 2, borderLeft: "4px solid", borderColor: "error.main" }}>
            <MDBox p={2} display="flex" alignItems="center" justifyContent="space-between" gap={2}>
              <MDTypography variant="body2" color="error">
                {error}
              </MDTypography>
              <MDButton size="small" color="error" onClick={loadReport}>
                Retry
              </MDButton>
            </MDBox>
          </Card>
        )}

        {loading && !reportMatchesMode(report, detailMode) ? (
          <Card>
            <MDBox p={4} textAlign="center">
              <MDTypography variant="body2" color="text">
                Loading course reviews...
              </MDTypography>
            </MDBox>
          </Card>
        ) : reportMatchesMode(report, detailMode) ? (
          detailMode ? (
            <CourseReport
              report={report}
              draft={draft}
              setDraft={setDraft}
              applyFilters={applyFilters}
              setPage={setPage}
              allowReveal={canRevealIdentity(user?.role)}
              requestReveal={(comment) => {
                setRevealComment(comment);
                setRevealReason("");
                setRevealedIdentity(null);
              }}
            />
          ) : (
            <TemplateReport
              report={report}
              draft={draft}
              setDraft={setDraft}
              applyFilters={applyFilters}
              openCourse={openCourse}
              setPage={setPage}
            />
          )
        ) : null}
      </MDBox>
      <Footer />

      <Dialog
        open={Boolean(revealComment)}
        onClose={() => setRevealComment(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Reveal learner identity</DialogTitle>
        <DialogContent>
          <MDTypography variant="body2" color="text" mb={2}>
            This action is audited. Enter the reason identity is required for this review.
          </MDTypography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Moderation reason"
            value={revealReason}
            onChange={(event) => setRevealReason(event.target.value)}
          />
          {revealedIdentity && (
            <MDBox mt={2} p={2} bgcolor="#f0fdf4" borderRadius="8px">
              <MDTypography variant="button" fontWeight="medium" display="block">
                {revealedIdentity.learner_name}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                {revealedIdentity.email || "No learner email"}
              </MDTypography>
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="dark" onClick={() => setRevealComment(null)}>
            Close
          </MDButton>
          {!revealedIdentity && (
            <MDButton
              color="error"
              disabled={!revealReason.trim() || revealing}
              onClick={revealIdentity}
            >
              {revealing ? "Revealing..." : "Reveal and audit"}
            </MDButton>
          )}
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

RatingChip.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

RatingChip.defaultProps = {
  value: null,
};

SummaryCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  icon: PropTypes.string.isRequired,
  color: PropTypes.string,
};

SummaryCard.defaultProps = {
  color: "info",
};

RatingDistribution.propTypes = {
  summary: PropTypes.object,
};

RatingDistribution.defaultProps = {
  summary: {},
};

Pager.propTypes = {
  pagination: PropTypes.object,
  onPage: PropTypes.func.isRequired,
};

Pager.defaultProps = {
  pagination: null,
};

TemplateReport.propTypes = {
  report: PropTypes.object.isRequired,
  draft: PropTypes.object.isRequired,
  setDraft: PropTypes.func.isRequired,
  applyFilters: PropTypes.func.isRequired,
  openCourse: PropTypes.func.isRequired,
  setPage: PropTypes.func.isRequired,
};

CourseReport.propTypes = {
  report: PropTypes.object.isRequired,
  draft: PropTypes.object.isRequired,
  setDraft: PropTypes.func.isRequired,
  applyFilters: PropTypes.func.isRequired,
  setPage: PropTypes.func.isRequired,
  allowReveal: PropTypes.bool.isRequired,
  requestReveal: PropTypes.func.isRequired,
};

export default CourseReviews;
