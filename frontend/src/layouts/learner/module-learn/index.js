import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Radio from "@mui/material/Radio";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function ActivityBody({
  activity,
  answers,
  discussion,
  discussionReply,
  submissionText,
  submissionFile,
  codeDraft,
  codeOutput,
  quizResult,
  saving,
  onAnswerChange,
  onCodeChange,
  onRunCode,
  onSubmissionFileChange,
  onSubmissionTextChange,
  onSubmitWork,
  onDiscussionReplyChange,
  onSubmitDiscussionReply,
  onSubmitQuiz,
}) {
  const content = activity?.content || {};
  const description = content.description || "";
  const body = content.body || content.text || content.instructions || "";
  const code = content.starter_code || content.code || content.template;
  const questions = Array.isArray(content.questions) ? content.questions : [];
  const richHtml = content.rich_html || "";
  const discussionPrompt = content.discussion_prompt || "";
  const activityPrompt =
    content.reflection_prompt || content.project_brief || content.submission_instructions;
  const prompt = activity.activity_type === "discussion" ? discussionPrompt : activityPrompt;
  const showLearningContent = activity.activity_type !== "discussion";

  return (
    <MDBox>
      <MDTypography variant="h5" fontWeight="bold">
        {activity.title}
      </MDTypography>
      <MDTypography variant="caption" color="text" textTransform="uppercase">
        {activity.activity_type} | {activity.points || 0} marks
      </MDTypography>

      {description && (
        <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "#f8fafc" }}>
          <MDTypography variant="caption" color="text" fontWeight="bold" textTransform="uppercase">
            {activity.activity_type === "discussion" ? "Instructions" : "Overview"}
          </MDTypography>
          <MDTypography variant="body2" color="text" sx={{ whiteSpace: "pre-wrap" }}>
            {asText(description)}
          </MDTypography>
        </MDBox>
      )}

      {showLearningContent && (
        <MDBox mt={2}>
          {(richHtml || body) && (
            <MDTypography
              variant="caption"
              color="text"
              fontWeight="bold"
              textTransform="uppercase"
            >
              Learning Content
            </MDTypography>
          )}
          {richHtml ? (
            <MDBox
              mt={1}
              sx={{
                color: "#344767",
                "& img": { maxWidth: "100%", borderRadius: "8px" },
                "& iframe": { maxWidth: "100%" },
                "& table": { width: "100%", borderCollapse: "collapse" },
                "& td, & th": { border: "1px solid #d1d5db", padding: "6px" },
              }}
              dangerouslySetInnerHTML={{ __html: richHtml }}
            />
          ) : body ? (
            <MDTypography variant="body2" color="text" mt={1} sx={{ whiteSpace: "pre-wrap" }}>
              {asText(body)}
            </MDTypography>
          ) : !description && !prompt ? (
            <MDTypography variant="body2" color="text">
              This activity is ready for the course builder content.
            </MDTypography>
          ) : null}
        </MDBox>
      )}

      {prompt && (
        <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "#f8fafc" }}>
          <MDTypography variant="caption" color="text" fontWeight="bold" textTransform="uppercase">
            {activity.activity_type === "discussion" ? "Discussion Prompt" : "Task"}
          </MDTypography>
          <MDTypography variant="body2" color="text" sx={{ whiteSpace: "pre-wrap" }}>
            {asText(prompt)}
          </MDTypography>
        </MDBox>
      )}

      {activity.activity_type === "quiz" && questions.length > 0 && (
        <MDBox mt={2}>
          {questions.map((question, index) => (
            <MDBox key={`${question.id || index}`} py={1.25} borderTop="1px solid #eef0f2">
              <MDTypography variant="button" fontWeight="medium">
                {index + 1}. {question.prompt || question.question || "Question"}
              </MDTypography>
              <MDBox mt={1} display="flex" flexDirection="column" gap={0.75}>
                {(question.options || []).map((option) => (
                  <MDBox
                    key={option}
                    display="flex"
                    alignItems="center"
                    gap={1}
                    p={1}
                    border="1px solid #d8dee9"
                    borderRadius="md"
                    sx={{ cursor: "pointer", bgcolor: "#ffffff" }}
                    onClick={() => onAnswerChange(question.id, option, question.question_type)}
                  >
                    {question.question_type === "multi_select" ? (
                      <Checkbox checked={(answers[question.id] || []).includes(option)} />
                    ) : (
                      <Radio checked={answers[question.id] === option} />
                    )}
                    <MDTypography variant="body2" color="text">
                      {option}
                    </MDTypography>
                  </MDBox>
                ))}
                {(!question.options || question.options.length === 0) && (
                  <MDInput
                    label="Your answer"
                    fullWidth
                    value={answers[question.id] || ""}
                    onChange={(event) => onAnswerChange(question.id, event.target.value)}
                  />
                )}
              </MDBox>
            </MDBox>
          ))}
          <MDBox mt={2}>
            <MDButton variant="gradient" color="success" disabled={saving} onClick={onSubmitQuiz}>
              Submit Quiz
            </MDButton>
          </MDBox>
          {quizResult && (
            <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "#ecfdf5" }}>
              <MDTypography variant="body2" color="success" fontWeight="bold">
                Score: {quizResult.score}% ({quizResult.earned_points}/{quizResult.total_points}{" "}
                marks)
              </MDTypography>
            </MDBox>
          )}
        </MDBox>
      )}

      {activity.activity_type === "discussion" && (
        <MDBox mt={3}>
          <MDTypography variant="button" fontWeight="bold">
            Class Discussion
          </MDTypography>
          <MDBox mt={1.5} display="flex" flexDirection="column" gap={1}>
            {(discussion?.replies || []).map((reply) => (
              <MDBox key={reply.id} p={1.5} borderRadius="md" sx={{ bgcolor: "#f8fafc" }}>
                <MDTypography variant="caption" color="text" fontWeight="bold">
                  {reply.author_name}
                </MDTypography>
                <MDTypography variant="body2" color="text" sx={{ whiteSpace: "pre-wrap" }}>
                  {reply.body}
                </MDTypography>
              </MDBox>
            ))}
          </MDBox>
          <MDBox mt={2}>
            <MDInput
              label="Reply"
              multiline
              rows={3}
              fullWidth
              value={discussionReply}
              onChange={(event) => onDiscussionReplyChange(event.target.value)}
            />
            <MDButton
              variant="gradient"
              color="info"
              disabled={saving || !discussionReply.trim()}
              sx={{ mt: 1 }}
              onClick={onSubmitDiscussionReply}
            >
              Post Reply
            </MDButton>
          </MDBox>
        </MDBox>
      )}

      {["assignment", "project", "reflection"].includes(activity.activity_type) && (
        <MDBox
          mt={3}
          p={2}
          borderRadius="md"
          sx={{ bgcolor: "#ffffff", border: "1px solid #e5e7eb" }}
        >
          <MDTypography variant="button" fontWeight="bold">
            Submit Your Work
          </MDTypography>
          <MDBox mt={1.5}>
            <MDInput
              label="Notes or answer"
              multiline
              rows={4}
              fullWidth
              value={submissionText}
              onChange={(event) => onSubmissionTextChange(event.target.value)}
            />
          </MDBox>
          <MDBox mt={1.5} display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
            <MDButton variant="outlined" color="dark" component="label">
              Upload File
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => onSubmissionFileChange(event.target.files?.[0] || null)}
              />
            </MDButton>
            <MDTypography variant="caption" color="text">
              {submissionFile?.name || "No file selected"}
            </MDTypography>
          </MDBox>
          <MDButton
            variant="gradient"
            color="success"
            disabled={saving || (!submissionText.trim() && !submissionFile)}
            sx={{ mt: 1.5 }}
            onClick={onSubmitWork}
          >
            Submit Work
          </MDButton>
        </MDBox>
      )}

      {activity.activity_type === "coding" && (
        <MDBox mt={3}>
          <MDTypography variant="button" fontWeight="bold">
            Code Workspace
          </MDTypography>
          <MDInput
            multiline
            rows={10}
            fullWidth
            value={codeDraft}
            onChange={(event) => onCodeChange(event.target.value)}
            sx={{ mt: 1, "& textarea": { fontFamily: "monospace" } }}
          />
          <MDBox mt={1.5} display="flex" gap={1} flexWrap="wrap">
            <MDButton variant="gradient" color="info" disabled={saving} onClick={onRunCode}>
              Run Code
            </MDButton>
            <MDButton variant="outlined" color="success" disabled={saving} onClick={onSubmitWork}>
              Submit Code
            </MDButton>
          </MDBox>
          <MDBox
            component="pre"
            mt={1.5}
            p={2}
            borderRadius="md"
            sx={{
              bgcolor: "#0f172a",
              color: "#e2e8f0",
              minHeight: 90,
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {codeOutput || "Output will appear here."}
          </MDBox>
        </MDBox>
      )}

      {code && activity.activity_type !== "coding" && (
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
  answers: PropTypes.object.isRequired,
  activity: PropTypes.shape({
    activity_type: PropTypes.string,
    content: PropTypes.object,
    points: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
  }).isRequired,
  discussion: PropTypes.object,
  discussionReply: PropTypes.string.isRequired,
  codeDraft: PropTypes.string.isRequired,
  codeOutput: PropTypes.string.isRequired,
  onCodeChange: PropTypes.func.isRequired,
  onAnswerChange: PropTypes.func.isRequired,
  onDiscussionReplyChange: PropTypes.func.isRequired,
  onRunCode: PropTypes.func.isRequired,
  onSubmissionFileChange: PropTypes.func.isRequired,
  onSubmissionTextChange: PropTypes.func.isRequired,
  onSubmitDiscussionReply: PropTypes.func.isRequired,
  onSubmitQuiz: PropTypes.func.isRequired,
  onSubmitWork: PropTypes.func.isRequired,
  quizResult: PropTypes.object,
  saving: PropTypes.bool.isRequired,
  submissionFile: PropTypes.object,
  submissionText: PropTypes.string.isRequired,
};

ActivityBody.defaultProps = {
  discussion: null,
  quizResult: null,
  submissionFile: null,
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
  const [answers, setAnswers] = useState({});
  const [discussion, setDiscussion] = useState(null);
  const [discussionReply, setDiscussionReply] = useState("");
  const [submissionText, setSubmissionText] = useState("");
  const [submissionFile, setSubmissionFile] = useState(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeOutput, setCodeOutput] = useState("");
  const [quizResult, setQuizResult] = useState(null);
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

  useEffect(() => {
    setAnswers({});
    setQuizResult(null);
    setDiscussion(null);
    setDiscussionReply("");
    setSubmissionText("");
    setSubmissionFile(null);
    setCodeDraft(activeActivity?.content?.starter_code || activeActivity?.content?.code || "");
    setCodeOutput("");

    async function loadDiscussion() {
      if (activeActivity?.activity_type !== "discussion") return;
      try {
        const response = await apiClient.get(`/courses/activities/${activeActivity.id}/discussion`);
        setDiscussion(response);
      } catch (err) {
        setError(err.message || "Failed to load discussion");
      }
    }

    loadDiscussion();
    const interval =
      activeActivity?.activity_type === "discussion" ? setInterval(loadDiscussion, 8000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeActivity?.id]);

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

  const updateAnswer = (questionId, value, questionType) => {
    setAnswers((current) => {
      if (questionType === "multi_select") {
        const currentValues = current[questionId] || [];
        return {
          ...current,
          [questionId]: currentValues.includes(value)
            ? currentValues.filter((item) => item !== value)
            : [...currentValues, value],
        };
      }
      return { ...current, [questionId]: value };
    });
  };

  const submitQuiz = async () => {
    if (!activeActivity) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiClient.post(
        `/courses/activities/${activeActivity.id}/quiz-attempts`,
        {
          answers,
        }
      );
      setQuizResult(response);
      await loadModule();
    } catch (err) {
      setError(err.message || "Failed to submit quiz");
    } finally {
      setSaving(false);
    }
  };

  const submitWork = async () => {
    if (!activeActivity) return;
    setSaving(true);
    setError("");
    try {
      let fileContent = null;
      if (submissionFile) {
        const dataUrl = await readFileAsDataUrl(submissionFile);
        const uploaded = await apiClient.post("/courses/submission-files", {
          fileName: submissionFile.name,
          dataUrl,
        });
        fileContent = {
          name: submissionFile.name,
          url: uploaded.url,
          size: submissionFile.size,
          type: submissionFile.type,
        };
      }
      await apiClient.post(`/courses/activities/${activeActivity.id}/submissions`, {
        submission_type:
          activeActivity.activity_type === "coding" ? "code" : fileContent ? "file" : "text",
        content: {
          text: activeActivity.activity_type === "coding" ? codeDraft : submissionText,
          file: fileContent,
          output: activeActivity.activity_type === "coding" ? codeOutput : null,
        },
      });
      await loadModule();
    } catch (err) {
      setError(err.message || "Failed to submit work");
    } finally {
      setSaving(false);
    }
  };

  const runCode = () => {
    if (!activeActivity) return;
    const language = activeActivity.content?.language || "javascript";
    if (!["javascript", "js"].includes(language.toLowerCase())) {
      setCodeOutput(`Running ${language} code will be supported in the server runner later.`);
      return;
    }
    const logs = [];
    try {
      const runner = new Function("console", `${codeDraft}\n//# sourceURL=educlub-activity.js`);
      runner({
        log: (...items) => logs.push(items.map((item) => asText(item)).join(" ")),
      });
      setCodeOutput(logs.join("\n") || "Code ran successfully.");
    } catch (err) {
      setCodeOutput(err.message || "Code failed to run.");
    }
  };

  const submitDiscussionReply = async () => {
    if (!activeActivity || !discussionReply.trim()) return;
    setSaving(true);
    setError("");
    try {
      await apiClient.post(`/courses/activities/${activeActivity.id}/discussion/replies`, {
        body: discussionReply,
      });
      setDiscussionReply("");
      const response = await apiClient.get(`/courses/activities/${activeActivity.id}/discussion`);
      setDiscussion(response);
      await loadModule();
    } catch (err) {
      setError(err.message || "Failed to post reply");
    } finally {
      setSaving(false);
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
    <MDBox minHeight="100vh" sx={{ bgcolor: "#eef4f8" }}>
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

      <MDBox px={{ xs: 2, md: 4, lg: 8 }} py={3} maxWidth="1480px" mx="auto">
        {error && (
          <MDBox mb={2} p={2} borderRadius="md" sx={{ bgcolor: "#fee2e2" }}>
            <MDTypography variant="body2" color="error" fontWeight="medium">
              {error}
            </MDTypography>
          </MDBox>
        )}

        <Grid container spacing={2.5}>
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
              <MDBox p={{ xs: 2.5, md: 4 }}>
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
                    <ActivityBody
                      activity={activeActivity}
                      answers={answers}
                      discussion={discussion}
                      discussionReply={discussionReply}
                      quizResult={quizResult}
                      saving={saving}
                      submissionText={submissionText}
                      submissionFile={submissionFile}
                      codeDraft={codeDraft}
                      codeOutput={codeOutput}
                      onAnswerChange={updateAnswer}
                      onCodeChange={setCodeDraft}
                      onDiscussionReplyChange={setDiscussionReply}
                      onRunCode={runCode}
                      onSubmissionFileChange={setSubmissionFile}
                      onSubmissionTextChange={setSubmissionText}
                      onSubmitDiscussionReply={submitDiscussionReply}
                      onSubmitQuiz={submitQuiz}
                      onSubmitWork={submitWork}
                    />
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
