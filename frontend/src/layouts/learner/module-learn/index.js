import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
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
import { selectActivityContent, starterCode } from "./activityContent";

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

function shuffled(items = []) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildDiscussionThreads(replies = []) {
  const byId = new Map();
  const roots = [];
  replies.forEach((reply) => byId.set(reply.id, { ...reply, children: [] }));
  replies.forEach((reply) => {
    const item = byId.get(reply.id);
    if (reply.parent_reply_id && byId.has(reply.parent_reply_id)) {
      byId.get(reply.parent_reply_id).children.push(item);
    } else {
      roots.push(item);
    }
  });
  return roots;
}

function discussionCardColor(index, depth = 0) {
  const colors = ["#f8fafc", "#eff6ff", "#f0fdf4", "#fff7ed", "#faf5ff"];
  return colors[(index + depth) % colors.length];
}

function DiscussionReplyCard({ reply, index, depth, onReply }) {
  return (
    <MDBox>
      <MDBox
        p={1.75}
        ml={depth ? 2 : 0}
        borderRadius="md"
        sx={{
          bgcolor: discussionCardColor(index, depth),
          border: "1px solid #d8dee9",
        }}
      >
        <MDBox display="flex" justifyContent="space-between" gap={1} flexWrap="wrap">
          <MDTypography variant="caption" color="text" fontWeight="bold">
            {reply.author_name}
          </MDTypography>
          <MDButton variant="text" color="info" size="small" onClick={() => onReply(reply)}>
            Reply
          </MDButton>
        </MDBox>
        <MDTypography variant="body2" color="text" sx={{ whiteSpace: "pre-wrap" }}>
          {reply.body}
        </MDTypography>
      </MDBox>
      {reply.children?.length > 0 && (
        <MDBox mt={1} display="flex" flexDirection="column" gap={1}>
          {reply.children.map((child, childIndex) => (
            <DiscussionReplyCard
              key={child.id}
              reply={child}
              index={childIndex}
              depth={depth + 1}
              onReply={onReply}
            />
          ))}
        </MDBox>
      )}
    </MDBox>
  );
}

DiscussionReplyCard.propTypes = {
  depth: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  onReply: PropTypes.func.isRequired,
  reply: PropTypes.shape({
    author_name: PropTypes.string,
    body: PropTypes.string,
    children: PropTypes.array,
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
};

function ActivityBody({
  activity,
  answers,
  discussion,
  discussionReply,
  submissionText,
  submissionFile,
  codeDraft,
  htmlDraft,
  cssDraft,
  codeOutput,
  codePreviewHtml,
  quizResult,
  replyTarget,
  saving,
  onAnswerChange,
  onCodeChange,
  onHtmlChange,
  onCssChange,
  onRunCode,
  onSetReplyTarget,
  onSubmissionFileChange,
  onSubmissionTextChange,
  onSubmitWork,
  onDiscussionReplyChange,
  onSubmitDiscussionReply,
  onSubmitQuiz,
}) {
  const [previewImage, setPreviewImage] = useState("");
  const content = activity?.content || {};
  const learnerContent = selectActivityContent(content, quizResult || {});
  const description = content.description || "";
  const body = content.body || content.text || content.instructions || "";
  const code = content.starter_code || content.code || content.template;
  const questions = Array.isArray(content.questions) ? content.questions : [];
  const discussionThreads = buildDiscussionThreads(discussion?.replies || []);
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
      {learnerContent.badgeName && (
        <Chip label={learnerContent.badgeName} color="info" size="small" sx={{ ml: 1 }} />
      )}

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

      {(learnerContent.media.image_url || learnerContent.media.video_url || learnerContent.media.transcript) && (
        <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "#f8fafc" }}>
          {learnerContent.media.image_url && (
            <MDBox component="img" src={learnerContent.media.image_url} alt={learnerContent.media.image_alt || ""} sx={{ display: "block", maxWidth: "100%", maxHeight: 320, objectFit: "contain", borderRadius: "8px" }} />
          )}
          {learnerContent.media.video_url && (
            <MDButton component="a" href={learnerContent.media.video_url} target="_blank" rel="noopener noreferrer" variant="outlined" color="info" sx={{ mt: 1 }}>
              Watch {learnerContent.media.video_title || "video"}
            </MDButton>
          )}
          {learnerContent.media.transcript && (
            <MDTypography variant="body2" color="text" mt={1} sx={{ whiteSpace: "pre-wrap" }}>
              {learnerContent.media.transcript}
            </MDTypography>
          )}
        </MDBox>
      )}

      {learnerContent.hints.length > 0 && (
        <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "#fff7ed", border: "1px solid #fed7aa" }}>
          <MDTypography variant="button" fontWeight="bold">Need a hint?</MDTypography>
          {learnerContent.hints.map((hint) => (
            <MDTypography key={hint} variant="body2" color="text">• {hint}</MDTypography>
          ))}
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
            <MDBox
              key={`${question.id || index}`}
              p={2}
              mt={1.5}
              borderRadius="md"
              sx={{
                bgcolor: ["#eff6ff", "#f0fdf4", "#fff7ed", "#faf5ff"][index % 4],
                border: "1px solid #dbeafe",
              }}
            >
              <MDTypography variant="button" fontWeight="medium">
                {index + 1}. {question.prompt || question.question || "Question"}
              </MDTypography>
              {question.image_url && (
                <MDBox
                  component="img"
                  src={question.image_url}
                  alt=""
                  onClick={() => setPreviewImage(question.image_url)}
                  sx={{
                    display: "block",
                    width: "min(100%, 360px)",
                    maxHeight: 240,
                    objectFit: "contain",
                    mt: 1.25,
                    borderRadius: "6px",
                    cursor: "zoom-in",
                    bgcolor: "#ffffff",
                  }}
                />
              )}
              <MDBox mt={1} display="flex" flexDirection="column" gap={0.75}>
                {question.question_type === "matching" &&
                  (question.options || []).map((pair) => (
                    <Grid container spacing={1} key={pair.left}>
                      <Grid item xs={12} sm={5}>
                        <MDTypography variant="body2" fontWeight="bold">
                          {pair.left}
                        </MDTypography>
                      </Grid>
                      <Grid item xs={12} sm={7}>
                        <MDInput
                          select
                          fullWidth
                          value={answers[question.id]?.[pair.left] || ""}
                          onChange={(event) =>
                            onAnswerChange(
                              question.id,
                              {
                                ...(answers[question.id] || {}),
                                [pair.left]: event.target.value,
                              },
                              "matching"
                            )
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">Choose match</option>
                          {(question.options || []).map((choice) => (
                            <option key={choice.right} value={choice.right}>
                              {choice.right}
                            </option>
                          ))}
                        </MDInput>
                      </Grid>
                    </Grid>
                  ))}
                {question.question_type === "ordering" && (
                  <MDBox display="flex" flexDirection="column" gap={1}>
                    {(answers[question.id] || question.options || []).map((option, optionIndex) => (
                      <MDBox
                        key={`${option}-${optionIndex}`}
                        display="flex"
                        alignItems="center"
                        gap={1}
                      >
                        <MDTypography variant="button">{optionIndex + 1}.</MDTypography>
                        <MDInput
                          select
                          fullWidth
                          value={option}
                          onChange={(event) => {
                            const ordered = [...(answers[question.id] || question.options || [])];
                            const swapIndex = ordered.indexOf(event.target.value);
                            [ordered[optionIndex], ordered[swapIndex]] = [
                              ordered[swapIndex],
                              ordered[optionIndex],
                            ];
                            onAnswerChange(question.id, ordered, "ordering");
                          }}
                          SelectProps={{ native: true }}
                        >
                          {(question.options || []).map((choice) => (
                            <option key={choice} value={choice}>
                              {choice}
                            </option>
                          ))}
                        </MDInput>
                      </MDBox>
                    ))}
                  </MDBox>
                )}
                {!["matching", "ordering"].includes(question.question_type) &&
                  (question.options || []).map((option) => (
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
                {question.question_type === "short_answer" && (
                  <MDInput
                    label="Your answer"
                    fullWidth
                    value={answers[question.id] || ""}
                    onChange={(event) => onAnswerChange(question.id, event.target.value)}
                  />
                )}
              </MDBox>
              {quizResult && learnerContent.questionFeedback[question.id] && (
                <MDBox mt={1} p={1.25} borderRadius="md" sx={{ bgcolor: learnerContent.questionFeedback[question.id].correct ? "#ecfdf5" : "#fff7ed" }}>
                  <MDTypography variant="body2" color="text">
                    {learnerContent.questionFeedback[question.id].correct ? "Correct. " : "Try again. "}
                    {learnerContent.questionFeedback[question.id].explanation}
                    {!learnerContent.questionFeedback[question.id].correct &&
                    learnerContent.questionFeedback[question.id].hint
                      ? ` Hint: ${learnerContent.questionFeedback[question.id].hint}`
                      : ""}
                  </MDTypography>
                </MDBox>
              )}
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
            {discussionThreads.map((reply, index) => (
              <DiscussionReplyCard
                key={reply.id}
                reply={reply}
                index={index}
                depth={0}
                onReply={onSetReplyTarget}
              />
            ))}
          </MDBox>
          <MDBox mt={2}>
            {replyTarget && (
              <Chip
                label={`Replying to ${replyTarget.author_name}`}
                color="info"
                size="small"
                onDelete={() => onSetReplyTarget(null)}
                sx={{ mb: 1 }}
              />
            )}
            <MDInput
              label={replyTarget ? "Reply to post" : "Your post to the prompt"}
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
          {["html_css", "html_css_js"].includes((content.language || "").toLowerCase()) ? (
            <Grid container spacing={1.5} mt={0.25}>
              <Grid item xs={12} md={6}>
                <MDInput label="HTML" multiline rows={12} fullWidth value={htmlDraft} onChange={(event) => onHtmlChange(event.target.value)} sx={{ "& textarea": { fontFamily: "monospace", bgcolor: "#0f172a", color: "#e2e8f0", borderRadius: "8px", p: 1.5 } }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput label="CSS" multiline rows={12} fullWidth value={cssDraft} onChange={(event) => onCssChange(event.target.value)} sx={{ "& textarea": { fontFamily: "monospace", bgcolor: "#172554", color: "#e2e8f0", borderRadius: "8px", p: 1.5 } }} />
              </Grid>
            </Grid>
          ) : (
          <MDInput
            multiline
            rows={10}
            fullWidth
            value={codeDraft}
            onChange={(event) => onCodeChange(event.target.value)}
            sx={{
              mt: 1,
              "& textarea": {
                fontFamily: "monospace",
                bgcolor: "#0f172a",
                color: "#e2e8f0",
                borderRadius: "8px",
                p: 1.5,
              },
            }}
          />
          )}
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
              bgcolor: "#ffffff",
              color: "#111827",
              border: "1px solid #d8dee9",
              minHeight: 90,
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {codeOutput || "Output will appear here."}
          </MDBox>
          {codePreviewHtml && (
            <MDBox
              component="iframe"
              title="Code preview"
              srcDoc={codePreviewHtml}
              mt={1.5}
              width="100%"
              height="320"
              sx={{ bgcolor: "#ffffff", border: "1px solid #d8dee9", borderRadius: "8px" }}
            />
          )}
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
      {content.purpose === "level_up" && learnerContent.levelUp && (
        <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "#faf5ff", border: "1px solid #ddd6fe" }}>
          <MDTypography variant="button" fontWeight="bold">Optional Level Up</MDTypography>
          <MDTypography variant="body2" color="text">{learnerContent.levelUp}</MDTypography>
        </MDBox>
      )}
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage("")} maxWidth="md">
        <DialogContent>
          <MDBox
            component="img"
            src={previewImage}
            alt=""
            sx={{ display: "block", maxWidth: "100%", maxHeight: "75vh", objectFit: "contain" }}
          />
        </DialogContent>
      </Dialog>
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
  htmlDraft: PropTypes.string.isRequired,
  cssDraft: PropTypes.string.isRequired,
  codeOutput: PropTypes.string.isRequired,
  codePreviewHtml: PropTypes.string.isRequired,
  onCodeChange: PropTypes.func.isRequired,
  onHtmlChange: PropTypes.func.isRequired,
  onCssChange: PropTypes.func.isRequired,
  onAnswerChange: PropTypes.func.isRequired,
  onDiscussionReplyChange: PropTypes.func.isRequired,
  onRunCode: PropTypes.func.isRequired,
  onSetReplyTarget: PropTypes.func.isRequired,
  onSubmissionFileChange: PropTypes.func.isRequired,
  onSubmissionTextChange: PropTypes.func.isRequired,
  onSubmitDiscussionReply: PropTypes.func.isRequired,
  onSubmitQuiz: PropTypes.func.isRequired,
  onSubmitWork: PropTypes.func.isRequired,
  quizResult: PropTypes.object,
  replyTarget: PropTypes.object,
  saving: PropTypes.bool.isRequired,
  submissionFile: PropTypes.object,
  submissionText: PropTypes.string.isRequired,
};

ActivityBody.defaultProps = {
  discussion: null,
  quizResult: null,
  replyTarget: null,
  submissionFile: null,
};

function CompletionCelebration({ data, onNext, onClose }) {
  const moduleDone = data?.module?.is_done;
  const courseDone = data?.course_summary?.is_done;
  const badgeName = data?.module?.activities
    ?.map((activity) => activity.content?.module_badge?.name)
    .find(Boolean);

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
        {badgeName && <Chip label={`Badge earned: ${badgeName}`} color="warning" sx={{ mt: 1.5 }} />}
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
      activities: PropTypes.arrayOf(PropTypes.shape({ content: PropTypes.object })),
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
  const [replyTarget, setReplyTarget] = useState(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionFile, setSubmissionFile] = useState(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [htmlDraft, setHtmlDraft] = useState("");
  const [cssDraft, setCssDraft] = useState("");
  const [codeOutput, setCodeOutput] = useState("");
  const [codePreviewHtml, setCodePreviewHtml] = useState("");
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeActivity = useMemo(
    () => data?.module?.activities?.find((activity) => activity.id === activeActivityId) || null,
    [data, activeActivityId]
  );

  const loadModule = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(`/courses/${courseId}/modules/${moduleId}/learn`);
      setData(response);
      setActiveActivityId((current) => current || response.module.activities?.[0]?.id || null);
    } catch (err) {
      setError(err.message || "Failed to load module");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const patchActivityProgress = (activityId, progress = {}) => {
    setData((current) => {
      if (!current?.module?.activities) return current;
      const activities = current.module.activities.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              status: progress.status || activity.status,
              score: progress.score ?? activity.score,
            }
          : activity
      );
      const completedActivities = activities.filter((activity) => done(activity.status)).length;
      const totalActivities = activities.length;
      const moduleWasDone = Boolean(current.module.is_done);
      const moduleIsDone = totalActivities > 0 && completedActivities === totalActivities;
      const courseSummary = { ...(current.course_summary || {}) };
      if (!moduleWasDone && moduleIsDone && "completed_modules" in courseSummary) {
        courseSummary.completed_modules = Number(courseSummary.completed_modules || 0) + 1;
        courseSummary.progress_percent = Math.round(
          (courseSummary.completed_modules /
            Math.max(Number(courseSummary.total_modules || 1), 1)) *
            100
        );
        courseSummary.is_done =
          courseSummary.completed_modules >= Number(courseSummary.total_modules || 1);
      }
      return {
        ...current,
        course_summary: courseSummary,
        module: {
          ...current.module,
          activities,
          completed_activities: completedActivities,
          total_activities: totalActivities,
          progress_percent: totalActivities
            ? Math.round((completedActivities / totalActivities) * 100)
            : 0,
          is_done: moduleIsDone,
        },
      };
    });
  };

  useEffect(() => {
    setActiveActivityId(null);
    loadModule();
  }, [courseId, moduleId]);

  useEffect(() => {
    setAnswers(
      Object.fromEntries(
        (activeActivity?.content?.questions || [])
          .filter((question) => question.question_type === "ordering")
          .map((question) => [question.id, shuffled(question.options)])
      )
    );
    setQuizResult(null);
    setDiscussion(null);
    setDiscussionReply("");
    setReplyTarget(null);
    setSubmissionText("");
    setSubmissionFile(null);
    setCodeDraft(starterCode(activeActivity?.content || {}));
    setHtmlDraft(activeActivity?.content?.starter_html || "");
    setCssDraft(activeActivity?.content?.starter_css || "");
    setCodeOutput("");
    setCodePreviewHtml("");

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

  useEffect(() => {
    if (!activeActivity) return;
    const language = (activeActivity.content?.language || "").toLowerCase();
    if (!["html_css", "html_css_js"].includes(language)) return;
    const preview = `${htmlDraft}${cssDraft ? `<style>${cssDraft}</style>` : ""}`;
    setCodeDraft(preview);
    setCodePreviewHtml(preview);
    setCodeOutput("Live preview updates as you type.");
  }, [activeActivity?.id, htmlDraft, cssDraft]);

  const updateProgress = async (activity, status) => {
    if (!activity) return;
    setSaving(true);
    try {
      patchActivityProgress(activity.id, { status });
      const progress = await apiClient.post(`/courses/activities/${activity.id}/progress`, {
        status,
      });
      patchActivityProgress(activity.id, progress);
    } catch (err) {
      setError(err.message || "Failed to save progress");
      await loadModule(true);
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
      patchActivityProgress(activeActivity.id, { status: "graded", score: response.score });
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
      patchActivityProgress(activeActivity.id, { status: "submitted" });
    } catch (err) {
      setError(err.message || "Failed to submit work");
    } finally {
      setSaving(false);
    }
  };

  const runCode = () => {
    if (!activeActivity) return;
    const language = activeActivity.content?.language || "javascript";
    setCodePreviewHtml("");
    if (["html_css", "html_css_js", "html", "web"].includes(language.toLowerCase())) {
      setCodePreviewHtml(codeDraft);
      setCodeOutput("Rendered browser preview below.");
      return;
    }
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
        parent_reply_id: replyTarget?.id || null,
      });
      setDiscussionReply("");
      setReplyTarget(null);
      const response = await apiClient.get(`/courses/activities/${activeActivity.id}/discussion`);
      setDiscussion(response);
      patchActivityProgress(activeActivity.id, { status: "submitted" });
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
    <MDBox
      minHeight="100vh"
      sx={{
        backgroundColor: "#f7f1e3",
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.08), transparent 28%), radial-gradient(circle at 80% 10%, rgba(22,163,74,0.08), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.55) 25%, transparent 25%)",
        backgroundSize: "auto, auto, 28px 28px",
      }}
    >
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
                      htmlDraft={htmlDraft}
                      cssDraft={cssDraft}
                      codeOutput={codeOutput}
                      codePreviewHtml={codePreviewHtml}
                      replyTarget={replyTarget}
                      onAnswerChange={updateAnswer}
                      onCodeChange={setCodeDraft}
                      onHtmlChange={setHtmlDraft}
                      onCssChange={setCssDraft}
                      onDiscussionReplyChange={setDiscussionReply}
                      onRunCode={runCode}
                      onSetReplyTarget={setReplyTarget}
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
