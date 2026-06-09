import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDProgress from "components/MDProgress";
import MDTypography from "components/MDTypography";
import { apiClient } from "lib/api";

function done(status) {
  return ["completed", "graded"].includes(status);
}

function activityIcon(type) {
  const icons = {
    assignment: "assignment",
    coding: "code",
    discussion: "forum",
    quiz: "quiz",
    reflection: "rate_review",
    typing: "keyboard",
    project: "workspaces",
  };
  return icons[type] || "article";
}

function asText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function ActivityBody({ activity }) {
  const content = activity?.content || {};
  const body = content.body || content.text || content.instructions || content.description;
  const code = content.starter_code || content.code || content.template;
  const questions = Array.isArray(content.questions) ? content.questions : [];

  return (
    <MDBox>
      <MDTypography variant="h5" fontWeight="bold">
        {activity.title}
      </MDTypography>
      <MDTypography variant="caption" color="text" textTransform="uppercase">
        {activity.activity_type} | {activity.points || 0} marks
      </MDTypography>

      <MDBox mt={2}>
        {body ? (
          <MDTypography variant="body2" color="text" sx={{ whiteSpace: "pre-wrap" }}>
            {asText(body)}
          </MDTypography>
        ) : (
          <MDTypography variant="body2" color="text">
            This activity is ready for the course builder content.
          </MDTypography>
        )}
      </MDBox>

      {questions.length > 0 && (
        <MDBox mt={2}>
          {questions.map((question, index) => (
            <MDBox key={`${question.id || index}`} py={1.25} borderTop="1px solid #eef0f2">
              <MDTypography variant="button" fontWeight="medium">
                {index + 1}. {question.prompt || question.question || "Question"}
              </MDTypography>
            </MDBox>
          ))}
        </MDBox>
      )}

      {code && (
        <MDBox
          component="pre"
          mt={2}
          p={2}
          borderRadius="md"
          sx={{
            bgcolor: "#111827",
            color: "#e5e7eb",
            overflow: "auto",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {asText(code)}
        </MDBox>
      )}
    </MDBox>
  );
}

ActivityBody.propTypes = {
  activity: PropTypes.shape({
    activity_type: PropTypes.string,
    content: PropTypes.object,
    points: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
  }).isRequired,
};

function CompletionCelebration({ data, onNext, onClose }) {
  const moduleDone = data?.module?.is_done;
  const courseDone = data?.course_summary?.is_done;

  if (!moduleDone) return null;

  return (
    <MDBox
      mt={2}
      p={3}
      borderRadius="md"
      position="relative"
      overflow="hidden"
      sx={{ background: "linear-gradient(135deg, #0f766e, #1d4ed8)" }}
    >
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <MDBox
          key={item}
          position="absolute"
          width={22}
          height={28}
          borderRadius="50%"
          sx={{
            left: `${10 + item * 15}%`,
            bottom: `${10 + (item % 3) * 14}px`,
            bgcolor: ["#f59e0b", "#22c55e", "#38bdf8", "#f97316", "#a78bfa", "#ef4444"][item],
            opacity: 0.9,
          }}
        />
      ))}
      <MDBox position="relative" zIndex={1}>
        <MDTypography variant="h4" color="white" fontWeight="bold">
          {courseDone ? "Congratulations, course complete!" : "Module complete!"}
        </MDTypography>
        <MDTypography variant="body2" color="white" mt={1}>
          Performance: {data.module.score_percent}% marks, {data.module.completed_activities} of{" "}
          {data.module.total_activities} activities done.
        </MDTypography>
        <MDBox display="flex" gap={1.5} flexWrap="wrap" mt={2}>
          {data.next_module?.is_open && (
            <MDButton variant="contained" color="white" onClick={onNext}>
              Next Module
            </MDButton>
          )}
          <MDButton variant="outlined" color="white" onClick={onClose}>
            Close Learning Page
          </MDButton>
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

CompletionCelebration.propTypes = {
  data: PropTypes.shape({
    course_summary: PropTypes.shape({
      is_done: PropTypes.bool,
    }),
    module: PropTypes.shape({
      completed_activities: PropTypes.number,
      is_done: PropTypes.bool,
      score_percent: PropTypes.number,
      total_activities: PropTypes.number,
    }),
    next_module: PropTypes.shape({
      is_open: PropTypes.bool,
    }),
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
};

function ModuleLearn() {
  const { courseId, moduleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activeActivityId, setActiveActivityId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeActivity = useMemo(
    () => data?.module?.activities?.find((activity) => activity.id === activeActivityId) || null,
    [data, activeActivityId]
  );

  const loadModule = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(`/courses/${courseId}/modules/${moduleId}/learn`);
      setData(response);
      setActiveActivityId((current) => current || response.module.activities?.[0]?.id || null);
    } catch (err) {
      setError(err.message || "Failed to load module");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveActivityId(null);
    loadModule();
  }, [courseId, moduleId]);

  const updateProgress = async (activity, status) => {
    if (!activity) return;
    setSaving(true);
    try {
      await apiClient.post(`/courses/activities/${activity.id}/progress`, { status });
      await loadModule();
    } catch (err) {
      setError(err.message || "Failed to save progress");
    } finally {
      setSaving(false);
    }
  };

  const selectActivity = async (activity) => {
    setActiveActivityId(activity.id);
    if (activity.status === "not_started") {
      await updateProgress(activity, "in_progress");
    }
  };

  const goNextActivity = () => {
    const activities = data?.module?.activities || [];
    const index = activities.findIndex((activity) => activity.id === activeActivityId);
    const next = activities[index + 1];
    if (next) {
      selectActivity(next);
    }
  };

  if (loading) {
    return (
      <MDBox minHeight="100vh" display="flex" alignItems="center" justifyContent="center">
        <MDTypography variant="body2" color="text">
          Loading module...
        </MDTypography>
      </MDBox>
    );
  }

  return (
    <MDBox minHeight="100vh" bgColor="light">
      <MDBox
        px={{ xs: 2, md: 3 }}
        py={1.5}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        sx={{ bgcolor: "#ffffff", borderBottom: "1px solid #e5e7eb" }}
      >
        <MDBox minWidth={0}>
          <MDTypography variant="button" color="text">
            {data?.course?.name || "Course"}
          </MDTypography>
          <MDTypography variant="h6" fontWeight="bold">
            {data?.module?.title || "Module"}
          </MDTypography>
        </MDBox>
        <MDBox width={{ xs: 110, sm: 220 }}>
          <MDProgress value={data?.module?.progress_percent || 0} color="success" />
        </MDBox>
        <IconButton
          aria-label="Close learning page"
          onClick={() => navigate(`/learner/courses/${courseId}`)}
        >
          <Icon>close</Icon>
        </IconButton>
      </MDBox>

      <MDBox px={{ xs: 2, md: 3 }} py={3}>
        {error && (
          <MDBox mb={2} p={2} borderRadius="md" sx={{ bgcolor: "#fee2e2" }}>
            <MDTypography variant="body2" color="error" fontWeight="medium">
              {error}
            </MDTypography>
          </MDBox>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" color="text" fontWeight="bold">
                  Activities
                </MDTypography>
                <MDBox mt={1} display="flex" flexDirection="column" gap={1}>
                  {(data?.module?.activities || []).map((activity) => (
                    <MDButton
                      key={activity.id}
                      variant={activity.id === activeActivityId ? "gradient" : "outlined"}
                      color={
                        done(activity.status)
                          ? "success"
                          : activity.id === activeActivityId
                          ? "info"
                          : "dark"
                      }
                      size="small"
                      fullWidth
                      startIcon={
                        <Icon fontSize="small">{activityIcon(activity.activity_type)}</Icon>
                      }
                      onClick={() => selectActivity(activity)}
                      sx={{ justifyContent: "flex-start", minHeight: 40 }}
                    >
                      {activity.title}
                    </MDButton>
                  ))}
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} md={9}>
            <Card>
              <MDBox p={{ xs: 2, md: 3 }}>
                {activeActivity ? (
                  <>
                    <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Chip
                        size="small"
                        label={done(activeActivity.status) ? "Done" : "In progress"}
                        color={done(activeActivity.status) ? "success" : "warning"}
                      />
                      <MDTypography variant="caption" color="text">
                        {data.module.completed_activities}/{data.module.total_activities} complete
                      </MDTypography>
                    </MDBox>
                    <ActivityBody activity={activeActivity} />
                    <MDBox
                      display="flex"
                      justifyContent="space-between"
                      flexWrap="wrap"
                      gap={1.5}
                      mt={3}
                    >
                      <MDButton variant="outlined" color="dark" onClick={goNextActivity}>
                        Next Activity
                      </MDButton>
                      <MDButton
                        variant="gradient"
                        color="success"
                        disabled={saving || done(activeActivity.status)}
                        onClick={() => updateProgress(activeActivity, "completed")}
                      >
                        {done(activeActivity.status) ? "Completed" : "Mark Complete"}
                      </MDButton>
                    </MDBox>
                  </>
                ) : (
                  <MDTypography variant="body2" color="text">
                    No activities have been added to this module yet.
                  </MDTypography>
                )}
              </MDBox>
            </Card>

            <CompletionCelebration
              data={data}
              onNext={() =>
                navigate(`/learner/courses/${courseId}/modules/${data.next_module.id}/learn`)
              }
              onClose={() => navigate(`/learner/courses/${courseId}`)}
            />
          </Grid>
        </Grid>
      </MDBox>
    </MDBox>
  );
}

export default ModuleLearn;
