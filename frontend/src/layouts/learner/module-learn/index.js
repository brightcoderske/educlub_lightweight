import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { LearningArt } from "components/DashboardIdentity";
import { apiClient } from "lib/api";
import { selectActivityContent, starterCode, starterParts, webPreview } from "./activityContent";
import { findActivityNavigation, resolveInitialActivity } from "../learningNavigation";
import { courseOverviewPath, moduleLearningPath } from "../previewNavigation";

function done(status) {
  return ["completed", "graded"].includes(status);
}

function learningStage(type) {
  if (type === "quiz") return "Quiz";
  if (["project", "assignment"].includes(type)) return "Project";
  if (["coding", "typing"].includes(type)) return "Practice";
  return "Learn";
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
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  const unchanged = next.length > 1 && next.every((item, index) => item === items[index]);
  return unchanged ? [...next.slice(1), next[0]] : next;
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

// Recalculates every progress bar inside a rendered lesson. Checkboxes, mini
// quizzes, sorters and reflections all count towards it.
function refreshRichProgress(root) {
  if (!root) return;
  root.querySelectorAll("[data-rich-progress]").forEach((progress) => {
    const container = progress.closest("[data-rich-root]") || root;
    const checks = Array.from(container.querySelectorAll("[data-rich-check]"));
    const reflections = Array.from(container.querySelectorAll("[data-rich-reflection]"));
    const quizzes = container.querySelectorAll("[data-rich-quiz]");
    const sorters = container.querySelectorAll("[data-sorter]");

    const total = checks.length + quizzes.length + sorters.length + reflections.length;
    const doneCount =
      checks.filter((item) => item.checked).length +
      container.querySelectorAll("[data-rich-quiz].answered").length +
      container.querySelectorAll("[data-sorter].answered").length +
      reflections.filter((item) => item.value.trim()).length;

    const percent = total ? Math.round((doneCount / total) * 100) : 0;
    const fill = progress.querySelector("[data-rich-progress-fill]");
    const text = progress.querySelector("[data-rich-progress-text]");
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `${percent}% complete`;
  });
}

function ExecutableRichContent({ html, storageScope }) {
  const contentRef = useRef(null);
  const [previewImage, setPreviewImage] = useState("");

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return undefined;
    const cleanups = [];
    // Scoped to the learner. Schools share devices, so an unscoped key meant the
    // next child to sign in on the same computer inherited the previous one's
    // ticked boxes and written reflections.
    const storageKey = (key) => `educlub-rich:${storageScope || "guest"}:${key}`;
    root.querySelectorAll("[data-executable-code]").forEach((block) => {
      if (block.querySelector("[data-run-executable]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.runExecutable = "true";
      button.textContent = "Run";
      button.style.cssText =
        "margin-top:10px;padding:8px 14px;border:0;border-radius:6px;background:#2563eb;color:white;cursor:pointer";
      const frame = document.createElement("iframe");
      frame.title = "Executable lesson output";
      frame.sandbox = "allow-scripts";
      frame.style.cssText =
        "display:none;width:100%;height:260px;margin-top:10px;border:1px solid #d1d5db;border-radius:6px;background:white";
      const run = () => {
        try {
          const source = JSON.parse(decodeURIComponent(block.dataset.executableCode || ""));
          frame.srcdoc = webPreview(source.html, source.css, source.js, true);
          frame.style.display = "block";
        } catch {
          frame.srcdoc = "<p>This code block could not be opened.</p>";
          frame.style.display = "block";
        }
      };
      button.addEventListener("click", run);
      block.append(button, frame);
      cleanups.push(() => button.removeEventListener("click", run));
    });

    const updateProgress = () => refreshRichProgress(root);

    root.querySelectorAll("[data-rich-check]").forEach((checkbox) => {
      const key = checkbox.dataset.richKey;
      if (key) checkbox.checked = localStorage.getItem(storageKey(key)) === "true";
      const save = () => {
        if (key) localStorage.setItem(storageKey(key), checkbox.checked ? "true" : "false");
        updateProgress();
      };
      checkbox.addEventListener("change", save);
      cleanups.push(() => checkbox.removeEventListener("change", save));
    });

    root.querySelectorAll("[data-rich-reflection]").forEach((textarea) => {
      const key = textarea.dataset.richKey;
      if (key) textarea.value = localStorage.getItem(storageKey(key)) || "";
      const save = () => {
        if (key) localStorage.setItem(storageKey(key), textarea.value);
        updateProgress();
      };
      textarea.addEventListener("input", save);
      cleanups.push(() => textarea.removeEventListener("input", save));
    });

    root.querySelectorAll("[data-sorter]").forEach((sorter) => {
      const list = sorter.querySelector(".sc-sorter-list");
      const status = sorter.querySelector("[data-sort-status]");
      const checkButton = sorter.querySelector("[data-sort-check]");
      const resetButton = sorter.querySelector("[data-sort-reset]");
      if (!list) return;

      const original = Array.from(list.children);
      let dragged = null;

      const itemOrder = () =>
        Array.from(list.querySelectorAll("[data-sort-index]")).map((item) =>
          Number(item.dataset.sortIndex)
        );
      const setStatus = (message) => {
        if (status) status.textContent = message;
      };
      const isOrdered = () => itemOrder().every((value, index) => value === index + 1);
      const markOrdered = () => {
        sorter.classList.toggle("answered", isOrdered());
        updateProgress();
      };
      const moveItem = (item, offset) => {
        const items = Array.from(list.children);
        const index = items.indexOf(item);
        const nextIndex = index + offset;
        if (nextIndex < 0 || nextIndex >= items.length) return;
        if (offset < 0) {
          list.insertBefore(item, items[nextIndex]);
        } else {
          list.insertBefore(items[nextIndex], item);
        }
        item.focus();
        markOrdered();
      };

      const dragStart = (event) => {
        dragged = event.currentTarget;
        dragged.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
      };
      const dragOver = (event) => {
        event.preventDefault();
        const item = event.target.closest("[data-sort-index]");
        if (!item || item === dragged) return;
        const box = item.getBoundingClientRect();
        const before = event.clientY < box.top + box.height / 2;
        list.insertBefore(dragged, before ? item : item.nextSibling);
      };
      const dragEnd = () => {
        dragged?.classList.remove("dragging");
        dragged = null;
        markOrdered();
      };
      const keyDown = (event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveItem(event.currentTarget, -1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveItem(event.currentTarget, 1);
        }
      };
      const check = () => {
        const ordered = isOrdered();
        sorter.classList.toggle("answered", ordered);
        setStatus(
          ordered
            ? "Correct order. Now build it in Scratch."
            : "Almost. Read the steps like a story from start to finish."
        );
        updateProgress();
      };
      const reset = () => {
        original.forEach((item) => list.appendChild(item));
        sorter.classList.remove("answered");
        setStatus("");
        updateProgress();
      };

      Array.from(list.querySelectorAll("[data-sort-index]")).forEach((item) => {
        item.addEventListener("dragstart", dragStart);
        item.addEventListener("dragover", dragOver);
        item.addEventListener("dragend", dragEnd);
        item.addEventListener("keydown", keyDown);
        cleanups.push(() => {
          item.removeEventListener("dragstart", dragStart);
          item.removeEventListener("dragover", dragOver);
          item.removeEventListener("dragend", dragEnd);
          item.removeEventListener("keydown", keyDown);
        });
      });
      checkButton?.addEventListener("click", check);
      resetButton?.addEventListener("click", reset);
      cleanups.push(() => {
        checkButton?.removeEventListener("click", check);
        resetButton?.removeEventListener("click", reset);
      });
    });

    updateProgress();
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [html, storageScope]);

  return (
    <>
      <MDBox
        ref={contentRef}
        mt={1}
        onClick={(event) => {
          const target = event.target;
          if (target.tagName === "IMG") {
            setPreviewImage(target.getAttribute("src") || "");
            return;
          }
          const flashcard = target.closest?.("[data-flashcard]");
          if (flashcard) {
            flashcard.classList.toggle("is-flipped");
            return;
          }
          const hintToggle = target.closest?.("[data-hint-toggle]");
          if (hintToggle) {
            const panel = contentRef.current?.querySelector(
              `[data-hint-panel="${hintToggle.dataset.hintToggle}"]`
            );
            const open = !panel?.classList.contains("show");
            panel?.classList.toggle("show", open);
            hintToggle.setAttribute("aria-expanded", open ? "true" : "false");
            hintToggle.textContent = open ? "Hide hint" : "Show hint";
            return;
          }
          const quizOption = target.closest?.("[data-quiz-option]");
          if (quizOption) {
            const quiz = quizOption.closest("[data-rich-quiz]");
            const correct = quizOption.dataset.correct === "true";
            quiz?.querySelectorAll("[data-quiz-option]").forEach((option) => {
              option.classList.remove("correct", "wrong");
            });
            quizOption.classList.add(correct ? "correct" : "wrong");
            const feedback = quiz?.querySelector("[data-quiz-feedback]");
            if (feedback) {
              feedback.textContent = correct
                ? "Correct. Nice thinking."
                : "Not yet. Try again, then read the hint or flashcard.";
            }
            quiz?.classList.toggle("answered", correct);
            refreshRichProgress(contentRef.current);
            return;
          }
          const celebrate = target.closest?.("[data-celebrate]");
          if (celebrate) {
            const burst = document.createElement("div");
            burst.className = "sc-confetti";
            for (let index = 0; index < 36; index += 1) {
              const star = document.createElement("span");
              star.className = "sc-star";
              star.textContent = "*";
              star.style.left = `${Math.random() * 100}%`;
              star.style.animationDelay = `${Math.random() * 0.45}s`;
              burst.appendChild(star);
            }
            document.body.appendChild(burst);
            window.setTimeout(() => burst.remove(), 1900);
            return;
          }
          const toggle = target.closest?.("[data-interactive-toggle]");
          if (!toggle) return;
          const block = toggle.closest("[data-interactive-block]");
          const answer = block?.querySelector("[data-interactive-answer]");
          if (!answer) return;
          answer.hidden = !answer.hidden;
          toggle.textContent = answer.hidden
            ? block.dataset.interactiveBlock === "self_check"
              ? "Check answer"
              : "Show answer"
            : "Hide answer";
        }}
        sx={{
          color: "#344767",
          "& img": { maxWidth: "100%", borderRadius: "8px", cursor: "zoom-in" },
          "& iframe": { maxWidth: "100%" },
          "& table": { width: "100%", borderCollapse: "collapse" },
          "& td, & th": { border: "1px solid #d1d5db", padding: "6px" },
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage("")} maxWidth="lg">
        <DialogContent>
          <MDBox
            component="img"
            src={previewImage}
            alt="Expanded lesson visual"
            sx={{ display: "block", maxWidth: "100%", maxHeight: "85vh", objectFit: "contain" }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

ExecutableRichContent.propTypes = {
  html: PropTypes.string.isRequired,
  storageScope: PropTypes.string,
};

ExecutableRichContent.defaultProps = { storageScope: "" };

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
  storageScope,
  matchingChoices,
  discussion,
  discussionReply,
  submissionText,
  submissionFile,
  codeDraft,
  htmlDraft,
  cssDraft,
  jsDraft,
  codeOutput,
  codePreviewHtml,
  quizResult,
  replyTarget,
  saving,
  onAnswerChange,
  onCodeChange,
  onHtmlChange,
  onCssChange,
  onJsChange,
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
  const [questionIndex, setQuestionIndex] = useState(0);
  useEffect(() => setQuestionIndex(0), [activity.id]);
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
  const showLearningContent = activity.activity_type !== "discussion" || Boolean(richHtml);

  return (
    <MDBox>
      <MDBox display="flex" alignItems="center" justifyContent="space-between" gap={2}>
        <MDBox minWidth={0}>
          <MDTypography
            variant="h4"
            fontWeight="bold"
            sx={{ letterSpacing: "-.025em", color: "#211a42" }}
          >
            {activity.title}
          </MDTypography>
          <MDTypography variant="caption" color="text" textTransform="uppercase">
            {activity.activity_type} | {activity.points || 0} marks
          </MDTypography>
          {learnerContent.badgeName && (
            <Chip label={learnerContent.badgeName} color="info" size="small" sx={{ ml: 1 }} />
          )}
        </MDBox>
        {["project", "assignment", "quiz"].includes(activity.activity_type) && (
          <MDBox
            sx={{
              flexShrink: 0,
              width: { xs: 65, sm: 95 },
              "& svg": { width: "100%", height: "auto" },
            }}
          >
            <LearningArt kind={activity.activity_type === "quiz" ? "trophy" : "game"} />
          </MDBox>
        )}
      </MDBox>

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
            <ExecutableRichContent html={richHtml} storageScope={storageScope} />
          ) : body ? (
            <MDTypography variant="body2" color="text" mt={1} sx={{ whiteSpace: "pre-wrap" }}>
              {asText(body)}
            </MDTypography>
          ) : !description && !prompt && activity.activity_type !== "quiz" ? (
            <MDTypography variant="body2" color="text">
              Your teacher is getting this activity ready. Choose another step to keep exploring.
            </MDTypography>
          ) : null}
        </MDBox>
      )}

      {(learnerContent.media.image_url ||
        learnerContent.media.video_url ||
        learnerContent.media.transcript) && (
        <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "#f8fafc" }}>
          {learnerContent.media.image_url && (
            <MDBox
              component="img"
              src={learnerContent.media.image_url}
              alt={learnerContent.media.image_alt || ""}
              sx={{
                display: "block",
                maxWidth: "100%",
                maxHeight: 320,
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
          )}
          {learnerContent.media.video_url && (
            <MDButton
              component="a"
              href={learnerContent.media.video_url}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              color="info"
              sx={{ mt: 1 }}
            >
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
        <MDBox
          mt={2}
          p={2}
          borderRadius="md"
          sx={{ bgcolor: "#fff7ed", border: "1px solid #fed7aa" }}
        >
          <MDTypography variant="button" fontWeight="bold">
            Need a hint?
          </MDTypography>
          {learnerContent.hints.map((hint) => (
            <MDTypography key={hint} variant="body2" color="text">
              • {hint}
            </MDTypography>
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
          {!quizResult && (
            <MDBox p={2} sx={{ bgcolor: "#f5f1ff", borderRadius: "14px" }}>
              <MDBox display="flex" justifyContent="space-between" mb={1}>
                <MDTypography variant="button" fontWeight="bold" role="status" aria-live="polite">
                  Question {questionIndex + 1} of {questions.length}
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  Take your time. You’ve got this!
                </MDTypography>
              </MDBox>
              <MDProgress color="info" value={((questionIndex + 1) / questions.length) * 100} />
              <MDBox display="flex" flexWrap="wrap" gap={0.75} mt={1.5}>
                {questions.map((question, index) => (
                  <MDButton
                    key={question.id || index}
                    size="small"
                    color="info"
                    variant={index === questionIndex ? "contained" : "outlined"}
                    aria-label={`Go to question ${index + 1}`}
                    aria-pressed={index === questionIndex}
                    onClick={() => setQuestionIndex(index)}
                    sx={{ minWidth: 36, px: 1 }}
                  >
                    {index + 1}
                  </MDButton>
                ))}
              </MDBox>
            </MDBox>
          )}
          {questions.map((question, index) => (
            <MDBox
              key={`${question.id || index}`}
              p={2}
              mt={1.5}
              borderRadius="md"
              sx={{
                display: quizResult || questionIndex === index ? "block" : "none",
                bgcolor: "#ffffff",
                border: "1px solid #e5dff4",
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
                          {(matchingChoices[question.id] || []).map((choice) => (
                            <option key={choice} value={choice}>
                              {choice}
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
                      component="label"
                      display="flex"
                      alignItems="center"
                      gap={1}
                      p={1}
                      border="1px solid #d8dee9"
                      borderRadius="md"
                      sx={{
                        cursor: "pointer",
                        minHeight: 56,
                        borderRadius: "12px",
                        borderColor: (
                          question.question_type === "multi_select"
                            ? (answers[question.id] || []).includes(option)
                            : answers[question.id] === option
                        )
                          ? "#8b60e4"
                          : "#e4e0ed",
                        bgcolor: (
                          question.question_type === "multi_select"
                            ? (answers[question.id] || []).includes(option)
                            : answers[question.id] === option
                        )
                          ? "#f3eeff"
                          : "#fff",
                        "&:hover": { bgcolor: "#f8f5ff" },
                      }}
                    >
                      {question.question_type === "multi_select" ? (
                        <Checkbox
                          checked={(answers[question.id] || []).includes(option)}
                          inputProps={{ "aria-label": String(option) }}
                          onChange={() =>
                            onAnswerChange(question.id, option, question.question_type)
                          }
                        />
                      ) : (
                        <Radio
                          name={`question-${question.id}`}
                          checked={answers[question.id] === option}
                          inputProps={{ "aria-label": String(option) }}
                          onChange={() =>
                            onAnswerChange(question.id, option, question.question_type)
                          }
                        />
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
              {quizResult &&
                typeof learnerContent.questionFeedback[question.id]?.correct === "boolean" && (
                  <MDBox
                    mt={1}
                    p={1.25}
                    borderRadius="md"
                    sx={{
                      bgcolor: learnerContent.questionFeedback[question.id].correct
                        ? "#ecfdf5"
                        : "#fff7ed",
                    }}
                  >
                    <MDTypography variant="body2" color="text">
                      {learnerContent.questionFeedback[question.id].correct
                        ? "Correct. "
                        : "Try again. "}
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
          <MDBox mt={2} display="flex" justifyContent="space-between" gap={1}>
            {!quizResult && (
              <MDButton
                variant="outlined"
                color="dark"
                disabled={questionIndex === 0}
                onClick={() => setQuestionIndex((index) => index - 1)}
              >
                Previous Question
              </MDButton>
            )}
            {!quizResult && questionIndex < questions.length - 1 ? (
              <MDButton
                variant="contained"
                color="info"
                onClick={() => setQuestionIndex((index) => index + 1)}
              >
                Next Question <Icon>arrow_forward</Icon>
              </MDButton>
            ) : (
              <MDButton variant="gradient" color="success" disabled={saving} onClick={onSubmitQuiz}>
                {saving ? "Checking…" : quizResult ? "Check Answers Again" : "Submit Quiz"}
              </MDButton>
            )}
          </MDBox>
          {quizResult && (
            <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "#ecfdf5" }}>
              <MDBox display="flex" alignItems="center" gap={2}>
                <LearningArt kind={Number(quizResult.score) >= 80 ? "trophy" : "robot"} size={85} />
                <MDTypography variant="h6">
                  {Number(quizResult.score) >= 80 ? "Amazing work!" : "Every try helps you learn."}
                </MDTypography>
              </MDBox>
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
                accept={learnerContent.submission.accept}
                onChange={(event) => onSubmissionFileChange(event.target.files?.[0] || null)}
              />
            </MDButton>
            <MDTypography variant="caption" color="text">
              {submissionFile?.name || "No file selected"}
            </MDTypography>
          </MDBox>
          {learnerContent.submission.help && (
            <MDTypography variant="caption" color="text" display="block" mt={1}>
              {learnerContent.submission.help}
            </MDTypography>
          )}
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
                <MDInput
                  label="HTML"
                  multiline
                  rows={12}
                  fullWidth
                  value={htmlDraft}
                  onChange={(event) => onHtmlChange(event.target.value)}
                  sx={{
                    "& textarea": {
                      fontFamily: "monospace",
                      bgcolor: "#0f172a",
                      color: "#e2e8f0",
                      borderRadius: "8px",
                      p: 1.5,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  label="CSS"
                  multiline
                  rows={12}
                  fullWidth
                  value={cssDraft}
                  onChange={(event) => onCssChange(event.target.value)}
                  sx={{
                    "& textarea": {
                      fontFamily: "monospace",
                      bgcolor: "#172554",
                      color: "#e2e8f0",
                      borderRadius: "8px",
                      p: 1.5,
                    },
                  }}
                />
              </Grid>
              {(content.language || "").toLowerCase() === "html_css_js" && (
                <Grid item xs={12}>
                  <MDInput
                    label="JavaScript"
                    multiline
                    rows={10}
                    fullWidth
                    value={jsDraft}
                    onChange={(event) => onJsChange(event.target.value)}
                    sx={{
                      "& textarea": {
                        fontFamily: "monospace",
                        bgcolor: "#111827",
                        color: "#fde68a",
                        borderRadius: "8px",
                        p: 1.5,
                      },
                    }}
                  />
                </Grid>
              )}
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
            {codeOutput || "Select Run Code to reveal the output."}
          </MDBox>
          {codePreviewHtml && (
            <MDBox
              component="iframe"
              title="Code preview"
              srcDoc={codePreviewHtml}
              sandbox={
                (content.language || "").toLowerCase() === "html_css_js" ? "allow-scripts" : ""
              }
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
        <MDBox
          mt={2}
          p={2}
          borderRadius="md"
          sx={{ bgcolor: "#faf5ff", border: "1px solid #ddd6fe" }}
        >
          <MDTypography variant="button" fontWeight="bold">
            Optional Level Up
          </MDTypography>
          <MDTypography variant="body2" color="text">
            {learnerContent.levelUp}
          </MDTypography>
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
  storageScope: PropTypes.string,
  matchingChoices: PropTypes.object.isRequired,
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
  jsDraft: PropTypes.string.isRequired,
  codeOutput: PropTypes.string.isRequired,
  codePreviewHtml: PropTypes.string.isRequired,
  onCodeChange: PropTypes.func.isRequired,
  onHtmlChange: PropTypes.func.isRequired,
  onCssChange: PropTypes.func.isRequired,
  onJsChange: PropTypes.func.isRequired,
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
  storageScope: "",
  discussion: null,
  quizResult: null,
  replyTarget: null,
  submissionFile: null,
};

function CompletionCelebration({
  data,
  feedbackComment,
  feedbackRating,
  feedbackSaving,
  onNext,
  onClose,
  onFeedbackCommentChange,
  onFeedbackRatingChange,
  onSubmitFeedback,
}) {
  const moduleDone = data?.module?.is_done;
  const courseDone = data?.course_summary?.is_done;
  const badgeName =
    data?.badge?.badge_name ||
    data?.module?.activities?.map((activity) => activity.content?.module_badge?.name).find(Boolean);
  const badgeTier = data?.badge?.tier || "completion";
  const badgeColors = {
    completion: "#111827",
    bronze: "#b87333",
    silver: "#a7adb7",
    gold: "#d4af37",
  };

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
        <Chip
          label={`${badgeName || data.module.title} | ${
            badgeTier.charAt(0).toUpperCase() + badgeTier.slice(1)
          } badge`}
          sx={{
            mt: 1.5,
            bgcolor: badgeColors[badgeTier],
            color: "#ffffff",
            fontWeight: 700,
          }}
        />
        <MDBox mt={2} p={2} borderRadius="md" sx={{ bgcolor: "rgba(255,255,255,0.94)" }}>
          <MDTypography variant="button" fontWeight="bold">
            Rate this module
          </MDTypography>
          <MDBox display="flex" gap={0.25} my={0.75}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <IconButton
                key={rating}
                aria-label={`Rate ${rating} stars`}
                onClick={() => onFeedbackRatingChange(rating)}
                size="small"
              >
                <Icon sx={{ color: rating <= feedbackRating ? "#f59e0b" : "#cbd5e1" }}>star</Icon>
              </IconButton>
            ))}
          </MDBox>
          <MDInput
            label="Optional comment"
            multiline
            rows={2}
            fullWidth
            value={feedbackComment}
            onChange={(event) => onFeedbackCommentChange(event.target.value)}
          />
          <MDButton
            variant="gradient"
            color="info"
            size="small"
            sx={{ mt: 1 }}
            disabled={!feedbackRating || feedbackSaving}
            onClick={onSubmitFeedback}
          >
            Save Feedback
          </MDButton>
        </MDBox>
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
  feedbackComment: PropTypes.string.isRequired,
  feedbackRating: PropTypes.number.isRequired,
  feedbackSaving: PropTypes.bool.isRequired,
  onFeedbackCommentChange: PropTypes.func.isRequired,
  onFeedbackRatingChange: PropTypes.func.isRequired,
  onSubmitFeedback: PropTypes.func.isRequired,
};

function learnerAiOptions(activity = {}) {
  const type = activity.activity_type || "lesson";
  const title = activity.title || "this activity";
  const common = [
    {
      key: "explain_simple",
      label: "Explain this simply",
    },
    {
      key: "next_step",
      label: "What should I do next?",
    },
  ];
  const byType = {
    coding: [
      {
        key: "code_idea",
        label: "Explain the code idea",
      },
      {
        key: "debug_hint",
        label: "Help me find mistakes",
      },
      {
        key: "small_hint",
        label: "Give me a small hint",
      },
    ],
    discussion: [
      {
        key: "discussion_prompt",
        label: "Explain the discussion prompt",
      },
      {
        key: "plan_reply",
        label: "Help me plan my reply",
      },
      {
        key: "sentence_starters",
        label: "Give me sentence starters",
      },
    ],
    assignment: [
      {
        key: "break_down",
        label: "Break down the task",
      },
      {
        key: "expected_work",
        label: "Check what is expected",
      },
      {
        key: "small_hint",
        label: "Give me a hint",
      },
    ],
    project: [
      {
        key: "project_plan",
        label: "Plan my project",
      },
      {
        key: "improve_idea",
        label: "Improve my idea",
      },
      {
        key: "checklist",
        label: "Give me a checklist",
      },
    ],
    reflection: [
      {
        key: "reflection_help",
        label: "Help me reflect",
      },
      {
        key: "learned_recap",
        label: "What did I learn?",
      },
      {
        key: "sentence_starters",
        label: "Give sentence starters",
      },
    ],
    typing: [
      {
        key: "typing_tips",
        label: "Typing tips",
      },
      {
        key: "improve_typing",
        label: "How do I improve?",
      },
      {
        key: "practice_plan",
        label: "Practice plan",
      },
    ],
  };
  const specific = byType[type] || [
    {
      key: "example_idea",
      label: "Show me an example idea",
    },
    {
      key: "small_hint",
      label: "Give me a hint",
    },
    {
      key: "quick_recap",
      label: "Quick recap",
    },
  ];
  return [...common, ...specific]
    .slice(0, 5)
    .map((option) => ({ ...option, prompt: `${option.key}:${title}` }));
}

function LearnerAiPanel({
  activity,
  answerHtml,
  error,
  loading,
  nextStep,
  open,
  question,
  onAsk,
  onClose,
  onOpen,
}) {
  const dragState = useRef(null);
  const dragCleanupRef = useRef(null);
  const [topOffset, setTopOffset] = useState(null);
  const [large, setLarge] = useState(false);
  useEffect(
    () => () => {
      dragCleanupRef.current?.();
    },
    []
  );
  if (!activity || activity.activity_type === "quiz") return null;
  const options = learnerAiOptions(activity).slice(0, 5);

  const startDrag = (event) => {
    dragCleanupRef.current?.();
    const pointer = event.touches?.[0] || event;
    dragState.current = {
      startY: pointer.clientY,
      startTop: topOffset,
    };

    const move = (moveEvent) => {
      if (!dragState.current) return;
      const movePointer = moveEvent.touches?.[0] || moveEvent;
      const height = large ? 520 : 390;
      const baseTop =
        dragState.current.startTop ??
        Math.max(16, window.innerHeight - height - (window.innerWidth < 600 ? 82 : 28));
      const nextTop = Math.min(
        Math.max(12, baseTop + movePointer.clientY - dragState.current.startY),
        Math.max(12, window.innerHeight - 96)
      );
      setTopOffset(nextTop);
    };

    const stop = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
      dragCleanupRef.current = null;
    };
    dragCleanupRef.current = stop;

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", stop);
  };

  return (
    <MDBox
      sx={{
        position: "fixed",
        right: { xs: 14, md: 28 },
        ...(topOffset === null ? { bottom: { xs: 82, md: 28 } } : { top: `${topOffset}px` }),
        zIndex: 1250,
        width: open ? { xs: "calc(100vw - 28px)", sm: large ? 520 : 390 } : "auto",
        maxWidth: "calc(100vw - 28px)",
      }}
    >
      {!open ? (
        <MDButton
          variant="gradient"
          color="info"
          startIcon={<Icon>auto_awesome</Icon>}
          onClick={onOpen}
          sx={{
            borderRadius: "999px",
            boxShadow: "0 14px 28px rgba(37, 99, 235, 0.28)",
          }}
        >
          eduClub AI
        </MDButton>
      ) : (
        <Card sx={{ boxShadow: "0 18px 42px rgba(15, 23, 42, 0.22)" }}>
          <MDBox p={2}>
            <MDBox
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gap={1}
              onMouseDown={startDrag}
              onTouchStart={startDrag}
              sx={{ cursor: "ns-resize", userSelect: "none" }}
            >
              <MDBox minWidth={0}>
                <MDTypography variant="button" fontWeight="bold">
                  eduClub AI
                </MDTypography>
                <MDTypography variant="caption" color="text" display="block">
                  Help for: {activity.title}
                </MDTypography>
              </MDBox>
              <MDBox display="flex" alignItems="center" gap={0.5}>
                <IconButton
                  aria-label={large ? "Shrink eduClub AI" : "Expand eduClub AI"}
                  size="small"
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={() => setLarge((current) => !current)}
                >
                  <Icon>{large ? "close_fullscreen" : "open_in_full"}</Icon>
                </IconButton>
                <IconButton
                  aria-label="Close eduClub AI"
                  size="small"
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={onClose}
                >
                  <Icon>close</Icon>
                </IconButton>
              </MDBox>
            </MDBox>

            <MDBox mt={1.5} display="flex" flexDirection="column" gap={1}>
              {options.map((option) => (
                <MDButton
                  key={option.label}
                  variant={question === option.prompt ? "gradient" : "outlined"}
                  color={question === option.prompt ? "info" : "dark"}
                  size="small"
                  disabled={loading}
                  onClick={() => onAsk(option.prompt)}
                  sx={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    whiteSpace: "normal",
                    lineHeight: 1.3,
                    minHeight: 38,
                  }}
                >
                  {option.label}
                </MDButton>
              ))}
            </MDBox>

            {error && (
              <MDBox mt={1.5} p={1.25} borderRadius="md" sx={{ bgcolor: "#fee2e2" }}>
                <MDTypography variant="caption" color="error">
                  {error}
                </MDTypography>
              </MDBox>
            )}

            {answerHtml && (
              <MDBox
                mt={1.5}
                p={1.5}
                borderRadius="md"
                sx={{
                  bgcolor: "#f8fafc",
                  border: "1px solid #dbeafe",
                  maxHeight: large ? { xs: 340, sm: 430 } : { xs: 220, sm: 280 },
                  overflow: "auto",
                  "& p": { fontSize: 14, lineHeight: 1.65, marginTop: 0 },
                  "& li": { fontSize: 14, lineHeight: 1.6 },
                  "& code": {
                    bgcolor: "#e0f2fe",
                    px: 0.5,
                    borderRadius: "4px",
                  },
                  "& pre": {
                    bgcolor: "#0f172a",
                    color: "#e2e8f0",
                    p: 1,
                    borderRadius: "6px",
                    overflow: "auto",
                  },
                }}
                dangerouslySetInnerHTML={{ __html: answerHtml }}
              />
            )}

            {nextStep && (
              <MDBox mt={1.25} p={1.25} borderRadius="md" sx={{ bgcolor: "#ecfdf5" }}>
                <MDTypography variant="caption" color="success" fontWeight="bold">
                  Try now: {nextStep}
                </MDTypography>
              </MDBox>
            )}
          </MDBox>
        </Card>
      )}
    </MDBox>
  );
}

LearnerAiPanel.propTypes = {
  activity: PropTypes.shape({
    activity_type: PropTypes.string,
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
  }),
  answerHtml: PropTypes.string.isRequired,
  error: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  nextStep: PropTypes.string.isRequired,
  onAsk: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onOpen: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  question: PropTypes.string.isRequired,
};

LearnerAiPanel.defaultProps = {
  activity: null,
};

function ModuleLearn() {
  const { courseId, templateId, moduleId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const previewMode = pathname.includes("/preview");
  const templatePreviewMode = previewMode && pathname.startsWith("/system-admin");
  const entityId = templatePreviewMode ? templateId : courseId;
  const contentTopRef = useRef(null);
  const completionRef = useRef(null);
  const [data, setData] = useState(null);
  const [activeActivityId, setActiveActivityId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [matchingChoices, setMatchingChoices] = useState({});
  const [discussion, setDiscussion] = useState(null);
  const [discussionReply, setDiscussionReply] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionFile, setSubmissionFile] = useState(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [htmlDraft, setHtmlDraft] = useState("");
  const [cssDraft, setCssDraft] = useState("");
  const [jsDraft, setJsDraft] = useState("");
  const [codeOutput, setCodeOutput] = useState("");
  const [codePreviewHtml, setCodePreviewHtml] = useState("");
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [paywall, setPaywall] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [learnerAiOpen, setLearnerAiOpen] = useState(false);
  const [learnerAiQuestion, setLearnerAiQuestion] = useState("");
  const [learnerAiAnswer, setLearnerAiAnswer] = useState("");
  const [learnerAiNextStep, setLearnerAiNextStep] = useState("");
  const [learnerAiError, setLearnerAiError] = useState("");
  const [learnerAiLoading, setLearnerAiLoading] = useState(false);

  const activeActivity = useMemo(
    () => data?.module?.activities?.find((activity) => activity.id === activeActivityId) || null,
    [data, activeActivityId]
  );

  const loadModule = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(
        templatePreviewMode
          ? `/course-templates/${entityId}/modules/${moduleId}/learn`
          : `/courses/${entityId}/modules/${moduleId}/learn`
      );
      setPaywall(null);
      setData(response);
      setFeedbackRating(Number(response.feedback?.rating || 0));
      setFeedbackComment(response.feedback?.comment || "");
      setActiveActivityId(
        (current) =>
          current ||
          resolveInitialActivity(response.module.activities || [], searchParams.get("activity"))
      );
    } catch (err) {
      if (err.status === 402 && err.payload?.payment_required) {
        setPaywall(err.payload);
        setData(null);
        setError("");
      } else {
        setError(err.message || "Failed to load module");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const patchActivityProgress = (activityId, progress = {}) => {
    setData((current) => {
      if (!current?.module?.activities) return current;
      let activities = current.module.activities.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              status: progress.status || activity.status,
              score: progress.score ?? activity.score,
            }
          : activity
      );
      if (done(progress.status)) {
        let previousRequiredComplete = true;
        activities = activities.map((activity) => {
          if (activity.availability_mode === "try_more") return activity;
          const unlocked = previousRequiredComplete;
          previousRequiredComplete = done(activity.status);
          return {
            ...activity,
            is_unlocked: unlocked,
            lock_reason: unlocked ? null : activity.lock_reason,
          };
        });
      }
      const requiredActivities = activities.filter(
        (activity) => activity.availability_mode !== "try_more"
      );
      const completedActivities = requiredActivities.filter((activity) =>
        done(activity.status)
      ).length;
      const totalActivities = requiredActivities.length;
      const moduleWasDone = Boolean(current.module.is_done);
      const moduleIsDone = totalActivities > 0 && completedActivities === totalActivities;
      let courseSummary = { ...(current.course_summary || {}) };
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

      // A completing save carries the server's recalculated gate. It is the only
      // thing that knows the module score and whether the next module opened, so
      // it wins over the optimistic figures worked out above.
      const state = progress.module_state || null;
      if (state?.course_summary) courseSummary = state.course_summary;

      return {
        ...current,
        badge: progress.badge || current.badge,
        course_summary: courseSummary,
        next_module: state ? state.next_module : current.next_module,
        module: {
          ...current.module,
          activities,
          completed_activities: state?.module?.completed_activities ?? completedActivities,
          total_activities: state?.module?.total_activities ?? totalActivities,
          progress_percent:
            state?.module?.progress_percent ??
            (totalActivities ? Math.round((completedActivities / totalActivities) * 100) : 0),
          score_percent: state?.module?.score_percent ?? current.module.score_percent,
          is_done: state?.module?.is_done ?? moduleIsDone,
        },
      };
    });
  };

  const activitiesAfterProgress = (activityId, status) => {
    let previousRequiredComplete = true;
    return (data?.module?.activities || [])
      .map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              status: status || activity.status,
            }
          : activity
      )
      .map((activity) => {
        if (activity.availability_mode === "try_more") return activity;
        const unlocked = previousRequiredComplete;
        previousRequiredComplete = done(activity.status);
        return {
          ...activity,
          is_unlocked: unlocked,
          lock_reason: unlocked ? null : activity.lock_reason,
        };
      });
  };

  useEffect(() => {
    setActiveActivityId(null);
    loadModule();
  }, [entityId, moduleId, templatePreviewMode]);

  useEffect(() => {
    setAnswers(
      Object.fromEntries(
        (activeActivity?.content?.questions || [])
          .filter((question) => question.question_type === "ordering")
          .map((question) => [question.id, shuffled(question.options)])
      )
    );
    setMatchingChoices(
      Object.fromEntries(
        (activeActivity?.content?.questions || [])
          .filter((question) => question.question_type === "matching")
          .map((question) => [
            question.id,
            shuffled((question.options || []).map((pair) => pair.right).filter(Boolean)),
          ])
      )
    );
    setQuizResult(null);
    setDiscussion(null);
    setDiscussionReply("");
    setReplyTarget(null);
    setSubmissionText("");
    setSubmissionFile(null);
    setCodeDraft(starterCode(activeActivity?.content || {}));
    const parts = starterParts(activeActivity?.content || {});
    setHtmlDraft(parts.html);
    setCssDraft(parts.css);
    setJsDraft(parts.js || "");
    setCodeOutput("");
    setCodePreviewHtml("");
    setLearnerAiOpen(false);
    setLearnerAiQuestion("");
    setLearnerAiAnswer("");
    setLearnerAiNextStep("");
    setLearnerAiError("");
    setLearnerAiLoading(false);

    async function loadDiscussion() {
      if (previewMode || activeActivity?.activity_type !== "discussion") return;
      try {
        const response = await apiClient.get(`/courses/activities/${activeActivity.id}/discussion`);
        setDiscussion(response);
      } catch (err) {
        setError(err.message || "Failed to load discussion");
      }
    }

    loadDiscussion();
    const interval =
      activeActivity?.activity_type === "discussion" ? setInterval(loadDiscussion, 20000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeActivity?.id]);

  useEffect(() => {
    if (!activeActivityId) return;
    contentTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeActivityId]);

  // `blocking` drives the busy state. Marking work complete has to block, because
  // the learner is waiting on the result. Recording that an activity was merely
  // opened does not: it happens on every click through the module and locking the
  // page for a network round trip is what made moving between activities feel slow.
  const updateProgress = async (activity, status, { blocking = true } = {}) => {
    if (!activity) return;
    if (previewMode) {
      patchActivityProgress(activity.id, { status });
      return { status };
    }
    if (blocking) setSaving(true);
    try {
      const progress = await apiClient.post(`/courses/activities/${activity.id}/progress`, {
        status,
      });
      patchActivityProgress(activity.id, progress);
      return progress;
    } catch (err) {
      if (blocking) {
        setError(err.message || "Failed to save progress");
        await loadModule(true);
      }
      return null;
    } finally {
      if (blocking) setSaving(false);
    }
  };

  const startCoursePayment = async () => {
    if (previewMode || !entityId) return;
    setPaying(true);
    setError("");
    try {
      const result = await apiClient.post(`/courses/${entityId}/payments/start`, {});
      if (result.status === "already_unlocked") {
        await loadModule();
        return;
      }
      window.location.href = result.paymentLink;
    } catch (err) {
      setError(err.message || "Could not start course payment.");
    } finally {
      setPaying(false);
    }
  };

  const selectActivity = (activity) => {
    if (!activity?.is_unlocked) {
      setError(activity?.lock_reason || "Complete the previous required activity first.");
      return;
    }
    setActiveActivityId(activity.id);
    setSearchParams({ activity: String(activity.id) }, { replace: true });
    setError("");
    if (activity.status === "not_started") {
      // Show the activity now and let the "opened" record catch up. It carries no
      // marks, so a failure here costs nothing the learner needs to act on.
      updateProgress(activity, "in_progress", { blocking: false });
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
    if (previewMode) {
      setError("Preview mode does not submit quiz attempts.");
      return;
    }
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
      patchActivityProgress(activeActivity.id, {
        status: response.passed ? "graded" : "in_progress",
        score: response.score,
      });
    } catch (err) {
      setError(err.message || "Failed to submit quiz");
    } finally {
      setSaving(false);
    }
  };

  const submitWork = async () => {
    if (!activeActivity) return;
    if (previewMode) {
      setError("Preview mode does not submit learner work.");
      return;
    }
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
      const submission = await apiClient.post(
        `/courses/activities/${activeActivity.id}/submissions`,
        {
          submission_type:
            activeActivity.activity_type === "coding" ? "code" : fileContent ? "file" : "text",
          content: {
            text: activeActivity.activity_type === "coding" ? codeDraft : submissionText,
            html: activeActivity.activity_type === "coding" ? htmlDraft : null,
            css: activeActivity.activity_type === "coding" ? cssDraft : null,
            js: activeActivity.activity_type === "coding" ? jsDraft : null,
            file: fileContent,
            output: activeActivity.activity_type === "coding" ? codeOutput : null,
          },
        }
      );
      patchActivityProgress(activeActivity.id, {
        status: submission.automatic_result ? "graded" : "submitted",
      });
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
      const preview = webPreview(
        htmlDraft || codeDraft,
        cssDraft,
        jsDraft,
        language.toLowerCase() === "html_css_js"
      );
      // Only the preview frame gets the generated document. Writing it back into
      // codeDraft overwrote the learner's own source in the single-editor
      // languages, so running twice buried their work under the wrapper markup.
      setCodePreviewHtml(preview);
      setCodeOutput("Rendered browser preview below.");
      return;
    }
    setCodeOutput(`${language} remains teacher-reviewed in this release.`);
  };

  const submitDiscussionReply = async () => {
    if (!activeActivity || !discussionReply.trim()) return;
    if (previewMode) {
      setError("Preview mode does not post discussion replies.");
      return;
    }
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

  const askLearnerAi = async (prompt) => {
    if (!activeActivity || previewMode || activeActivity.activity_type === "quiz") return;
    const selectedPrompt = prompt || "";
    const selectedAction = selectedPrompt.split(":")[0] || "explain_simple";
    setLearnerAiLoading(true);
    setLearnerAiError("");
    setLearnerAiQuestion(selectedPrompt);
    try {
      const response = await apiClient.post(`/ai/learner/activities/${activeActivity.id}/explain`, {
        action: selectedAction,
      });
      setLearnerAiAnswer(response.answer_html || "");
      setLearnerAiNextStep(response.next_step || "");
    } catch (err) {
      setLearnerAiError(err.message || "eduClub AI is not available for this activity.");
    } finally {
      setLearnerAiLoading(false);
    }
  };

  const goNextActivity = () => {
    const activities = data?.module?.activities || [];
    const { next } = findActivityNavigation(activities, activeActivityId);
    if (next) {
      selectActivity(next);
    }
  };

  const goPreviousActivity = () => {
    const activities = data?.module?.activities || [];
    const { previous } = findActivityNavigation(activities, activeActivityId);
    if (previous) {
      selectActivity(previous);
    }
  };

  const completeAndContinue = async () => {
    if (!activeActivity) return;
    const progress = await updateProgress(activeActivity, "completed");
    if (!progress) return;
    const activities = activitiesAfterProgress(activeActivity.id, progress.status || "completed");
    const { next } = findActivityNavigation(activities, activeActivity.id);
    if (next) {
      selectActivity(next);
      return;
    }
    completionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activityNavigation = findActivityNavigation(
    data?.module?.activities || [],
    activeActivityId
  );

  const submitFeedback = async () => {
    if (previewMode) return;
    setFeedbackSaving(true);
    try {
      const feedback = await apiClient.post(`/courses/modules/${moduleId}/feedback`, {
        rating: feedbackRating,
        comment: feedbackComment,
      });
      setData((current) => ({ ...current, feedback }));
    } catch (err) {
      setError(err.message || "Failed to save feedback");
    } finally {
      setFeedbackSaving(false);
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

  if (paywall) {
    const amount = Number(paywall.course?.independent_price_amount || 0);
    const currency = paywall.course?.independent_currency || "KES";
    return (
      <MDBox
        minHeight="100vh"
        px={2}
        display="flex"
        alignItems="center"
        justifyContent="center"
        sx={{ bgcolor: "#f7f1e3" }}
      >
        <Card sx={{ maxWidth: 560, width: "100%" }}>
          <MDBox p={{ xs: 3, md: 4 }} textAlign="center">
            <Icon color="warning" sx={{ fontSize: 48, mb: 1 }}>
              lock
            </Icon>
            <MDTypography variant="h4" fontWeight="bold">
              Preview ended
            </MDTypography>
            <MDTypography variant="body2" color="text" mt={1.5}>
              To access this course, pay for an access key and continue with support and guided
              lessons from eduClub tutors.
            </MDTypography>
            {amount > 0 && (
              <MDTypography variant="h5" color="warning" fontWeight="bold" mt={2}>
                {currency} {amount.toLocaleString()}
              </MDTypography>
            )}
            {error && (
              <MDBox mt={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#fee2e2" }}>
                <MDTypography variant="body2" color="error">
                  {error}
                </MDTypography>
              </MDBox>
            )}
            <MDBox mt={3} display="flex" justifyContent="center" gap={1.5} flexWrap="wrap">
              <MDButton
                variant="gradient"
                color="warning"
                disabled={paying}
                startIcon={<Icon fontSize="small">payments</Icon>}
                onClick={startCoursePayment}
              >
                {paying ? "Opening..." : "Pay Now"}
              </MDButton>
              <MDButton
                variant="outlined"
                color="dark"
                startIcon={<Icon fontSize="small">arrow_back</Icon>}
                onClick={() => navigate("/learner")}
              >
                Back
              </MDButton>
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
    );
  }

  return (
    <MDBox
      component="main"
      minHeight="100vh"
      sx={{
        backgroundColor: "#f7f8fd",
        "& .MuiCard-root": {
          borderRadius: "18px",
          border: "1px solid #e8e3f3",
          boxShadow: "0 5px 22px #23134505",
        },
        "& .MuiButton-root": { borderRadius: "10px", textTransform: "none", minHeight: 42 },
        '& .MuiButton-contained[data-color="info"]:not(.Mui-disabled)': {
          background: "linear-gradient(110deg,#7750f8,#5730df)",
          color: "white",
        },
        "& .MuiLinearProgress-root": { height: 7, borderRadius: "10px" },
        "& button:focus-visible, & input:focus-visible": {
          outline: "3px solid #af8aff",
          outlineOffset: 2,
        },
        "@media (prefers-reduced-motion: reduce)": {
          "& *": { animation: "none !important", transition: "none !important" },
        },
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
          onClick={() => navigate(courseOverviewPath(entityId, previewMode, templatePreviewMode))}
        >
          <Icon>close</Icon>
        </IconButton>
      </MDBox>

      <MDBox px={{ xs: 2, md: 4, lg: 8 }} py={3} maxWidth="1480px" mx="auto">
        {previewMode && (
          <MDBox mb={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#fff7ed" }}>
            <MDTypography variant="body2" color="warning" fontWeight="medium">
              Learner preview is read-only. Use Preview Complete to test progressive unlocking.
            </MDTypography>
          </MDBox>
        )}
        {error && (
          <MDBox mb={2} p={2} borderRadius="md" sx={{ bgcolor: "#fee2e2" }}>
            <MDTypography variant="body2" color="error" fontWeight="medium">
              {error}
            </MDTypography>
          </MDBox>
        )}

        <MDBox
          mb={2}
          display={{ xs: "flex", md: "none" }}
          gap={1}
          overflow="auto"
          pb={0.5}
          sx={{ scrollbarWidth: "thin" }}
        >
          {(data?.module?.activities || []).map((activity, index) => (
            <MDButton
              key={`top-${activity.id}`}
              variant={activity.id === activeActivityId ? "gradient" : "outlined"}
              color={
                done(activity.status)
                  ? "success"
                  : activity.availability_mode === "try_more"
                  ? "warning"
                  : "info"
              }
              size="small"
              disabled={!activity.is_unlocked}
              title={activity.lock_reason || activity.title}
              onClick={() => selectActivity(activity)}
              sx={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              {index + 1}. {activity.title}
            </MDButton>
          ))}
        </MDBox>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={3} sx={{ display: { xs: "none", md: "block" } }}>
            <Card
              sx={{
                bgcolor: "#11162f",
                position: "sticky",
                top: 16,
                "& .MuiButton-root": {
                  color: "#dedbf1",
                  borderColor: "#383655",
                  textAlign: "left",
                },
                "& .MuiButton-root.Mui-disabled": { color: "#85859f" },
              }}
            >
              <MDBox p={2}>
                <MDTypography variant="button" color="white" fontWeight="bold">
                  Your learning path
                </MDTypography>
                <MDBox mt={1} display="flex" flexDirection="column" gap={1}>
                  {(data?.module?.activities || []).map((activity) => (
                    <MDButton
                      key={activity.id}
                      variant={activity.id === activeActivityId ? "gradient" : "outlined"}
                      color={
                        done(activity.status)
                          ? "success"
                          : activity.availability_mode === "try_more"
                          ? "warning"
                          : activity.id === activeActivityId
                          ? "info"
                          : "dark"
                      }
                      size="small"
                      fullWidth
                      startIcon={
                        <Icon fontSize="small">{activityIcon(activity.activity_type)}</Icon>
                      }
                      disabled={!activity.is_unlocked}
                      title={activity.lock_reason || ""}
                      onClick={() => selectActivity(activity)}
                      aria-current={activity.id === activeActivityId ? "step" : undefined}
                      sx={{ justifyContent: "flex-start", minHeight: 46 }}
                    >
                      {activity.title}
                      {activity.availability_mode === "try_more" ? " | Try More" : ""}
                    </MDButton>
                  ))}
                </MDBox>
                <MDBox
                  mt={2.5}
                  p={1.5}
                  textAlign="center"
                  sx={{ bgcolor: "#262046", borderRadius: "14px" }}
                >
                  <LearningArt kind="robot" size={96} />
                  <MDTypography variant="caption" color="white" display="block">
                    Big ideas start with small steps.
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} md={9}>
            <Card ref={contentTopRef}>
              <MDBox p={{ xs: 2.5, md: 4 }}>
                {activeActivity ? (
                  <>
                    <MDBox
                      display="flex"
                      gap={1}
                      mb={3}
                      sx={{ overflowX: "auto", pb: 1 }}
                      aria-label="Learning stages"
                    >
                      {["Learn", "Practice", "Quiz", "Project"].map((stage) => {
                        const activities = (data.module.activities || []).filter(
                          (activity) => learningStage(activity.activity_type) === stage
                        );
                        if (!activities.length) return null;
                        const available =
                          activities.find(
                            (activity) => activity.is_unlocked && !done(activity.status)
                          ) || activities.find((activity) => activity.is_unlocked);
                        return (
                          <MDButton
                            key={stage}
                            color="info"
                            variant={
                              learningStage(activeActivity.activity_type) === stage
                                ? "contained"
                                : "text"
                            }
                            aria-pressed={learningStage(activeActivity.activity_type) === stage}
                            disabled={!available}
                            onClick={() => selectActivity(available)}
                          >
                            {stage}
                          </MDButton>
                        );
                      })}
                    </MDBox>
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
                      storageScope={data?.learner?.id ? String(data.learner.id) : ""}
                      matchingChoices={matchingChoices}
                      discussion={discussion}
                      discussionReply={discussionReply}
                      quizResult={quizResult}
                      saving={saving}
                      submissionText={submissionText}
                      submissionFile={submissionFile}
                      codeDraft={codeDraft}
                      htmlDraft={htmlDraft}
                      cssDraft={cssDraft}
                      jsDraft={jsDraft}
                      codeOutput={codeOutput}
                      codePreviewHtml={codePreviewHtml}
                      replyTarget={replyTarget}
                      onAnswerChange={updateAnswer}
                      onCodeChange={setCodeDraft}
                      onHtmlChange={setHtmlDraft}
                      onCssChange={setCssDraft}
                      onJsChange={setJsDraft}
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
                      <MDBox display="flex" gap={1} flexWrap="wrap">
                        <MDButton
                          variant="outlined"
                          color="dark"
                          disabled={!activityNavigation.previous}
                          onClick={goPreviousActivity}
                        >
                          Previous Activity
                        </MDButton>
                        <MDButton
                          variant="outlined"
                          color="info"
                          disabled={!activityNavigation.next}
                          onClick={goNextActivity}
                        >
                          Next Activity
                        </MDButton>
                      </MDBox>
                      <MDButton
                        variant="gradient"
                        color="success"
                        disabled={
                          saving ||
                          done(activeActivity.status) ||
                          (!previewMode && activeActivity.activity_type === "quiz")
                        }
                        onClick={completeAndContinue}
                      >
                        {previewMode
                          ? done(activeActivity.status)
                            ? "Preview Completed"
                            : "Preview Complete"
                          : activeActivity.activity_type === "quiz"
                          ? "Pass Quiz to Complete"
                          : done(activeActivity.status)
                          ? "Completed"
                          : "Mark Complete"}
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

            {!previewMode && (
              <MDBox ref={completionRef} sx={{ scrollMarginTop: "24px" }}>
                <CompletionCelebration
                  data={data}
                  feedbackComment={feedbackComment}
                  feedbackRating={feedbackRating}
                  feedbackSaving={feedbackSaving}
                  onFeedbackCommentChange={setFeedbackComment}
                  onFeedbackRatingChange={setFeedbackRating}
                  onSubmitFeedback={submitFeedback}
                  onNext={() =>
                    navigate(moduleLearningPath(courseId, data.next_module.id, null, false))
                  }
                  onClose={() => navigate(courseOverviewPath(courseId, false))}
                />
              </MDBox>
            )}
          </Grid>
        </Grid>
      </MDBox>
      {!previewMode && activeActivity?.activity_type !== "quiz" && (
        <LearnerAiPanel
          activity={activeActivity}
          answerHtml={learnerAiAnswer}
          error={learnerAiError}
          loading={learnerAiLoading}
          nextStep={learnerAiNextStep}
          open={learnerAiOpen}
          question={learnerAiQuestion}
          onAsk={askLearnerAi}
          onClose={() => setLearnerAiOpen(false)}
          onOpen={() => setLearnerAiOpen(true)}
        />
      )}
    </MDBox>
  );
}

export default ModuleLearn;
