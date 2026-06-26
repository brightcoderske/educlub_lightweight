import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { apiClient } from "lib/api";
import { useAuth } from "context/AuthContext";
import {
  activityToStructuredForm,
  moveItemById,
  replaceActivityInBuilderData,
  reorderItemsById,
  saveActivityWithFeedback,
  structuredFormContent,
} from "./activityForm";
import DisplayCodeDialog from "./dialogs/DisplayCodeDialog";
import EarlyUnlockDialog from "./dialogs/EarlyUnlockDialog";
import ExecutableCodeDialog from "./dialogs/ExecutableCodeDialog";
import HintDialog from "./dialogs/HintDialog";
import InteractiveBlockDialog from "./dialogs/InteractiveBlockDialog";
import ResourceDialog from "./dialogs/ResourceDialog";
import { cleanImportedHtml, executableSourceFromPayload } from "./dialogs/authoringUtils";

const activityTypes = [
  "lesson",
  "quiz",
  "assignment",
  "discussion",
  "coding",
  "typing",
  "project",
  "reflection",
];

const editorColors = ["#111827", "#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b"];
const editorFonts = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Courier New",
  "Trebuchet MS",
];
const editorBlocks = ["P", "H1", "H2", "H3", "H4", "H5", "H6"];
const orderedListStyles = [
  ["decimal", "1, 2, 3"],
  ["upper-alpha", "A, B, C"],
  ["lower-roman", "i, ii, iii"],
];
const unorderedListStyles = [
  ["disc", "Filled"],
  ["circle", "Circle"],
  ["square", "Square"],
];

function emptyModule(position) {
  return {
    title: "",
    description: "",
    position,
    is_published: true,
    schedule_term_id: "",
    schedule_week_number: "",
  };
}

function emptyActivity(position) {
  return {
    title: "",
    activity_type: "lesson",
    content_text: "",
    points: 0,
    position,
    is_required: true,
    completion_rule: "manual",
    is_published: true,
  };
}

function contentToText(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content.body === "string") return content.body;
  return JSON.stringify(content, null, 2);
}

function moduleToForm(courseModule) {
  return {
    title: courseModule?.title || "",
    description: courseModule?.description || "",
    position: courseModule?.position || 1,
    is_published: courseModule?.is_published !== false,
    learning_outcomes: courseModule?.learning_outcomes || [],
    unlock_at: courseModule?.unlock_at ? String(courseModule.unlock_at).slice(0, 16) : "",
    schedule_term_id: courseModule?.schedule?.term_id || "",
    schedule_week_number: courseModule?.schedule?.week_number || "",
  };
}

function activityToForm(activity) {
  return {
    title: activity?.title || "",
    activity_type: activity?.activity_type || "lesson",
    content_text: contentToText(activity?.content),
    points: activity?.points || 0,
    position: activity?.position || 1,
    is_required: activity?.is_required !== false,
    completion_rule: activity?.completion_rule || "manual",
    pass_score: activity?.pass_score || "",
    is_published: activity?.is_published !== false,
  };
}

function parseActivityPayload(form) {
  let content = {};
  const text = form.content_text || "";

  try {
    content = text.trim().startsWith("{") ? JSON.parse(text) : { body: text };
  } catch (error) {
    content = { body: text };
  }

  return {
    ...form,
    content,
    points: Number(form.points || 0),
    position: Number(form.position || 1),
  };
}

function questionsFromCsv(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const columns = line.split(",").map((value) => value.trim());
      const [prompt, options = "", correctAnswer = "", points = "1"] = columns;
      return {
        id: `q${Date.now()}-${index}`,
        question_type: options.toLowerCase() === "true/false" ? "true_false" : "multiple_choice",
        prompt,
        options: options
          .split("|")
          .map((option) => option.trim())
          .filter(Boolean),
        correct_answer: correctAnswer,
        points: Number(points ?? 1),
        position: index + 1,
      };
    });
}

function normalizeQuestionForm(question = {}, index = 0) {
  return {
    id: question.id || `q${Date.now()}-${index}`,
    question_type: question.question_type || question.type || "multiple_choice",
    prompt: question.prompt || question.question || "",
    options: Array.isArray(question.options) ? question.options : [],
    correct_answer: question.correct_answer || question.answer || "",
    image_url: question.image_url || "",
    points: Number(question.points ?? 1),
    position: Number(question.position || index + 1),
    hint: question.hint || "",
    explanation: question.explanation || "",
  };
}

function asText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

function optionLabel(index) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[index] || `${index + 1}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function activityToManagerForm(activity) {
  const form = activityToStructuredForm(activity || {});
  return {
    ...form,
    questions: form.questions.map((question, index) => normalizeQuestionForm(question, index)),
  };
}

function defaultActivityAiPrompt(form = {}) {
  const activityType = String(form.activity_type || "lesson").replace(/_/g, " ");
  return [
    `Generate rich ${activityType} content for this one activity only.`,
    "Teach an 8-year-old beginner step by step using a warm, practical, project-based, self-paced style.",
    "Follow EduClub's flow: explain, show, practice together, practice independently, create, improve, reflect.",
    "Use rich HTML with small visual blocks, click-to-reveal hints, flashcards, prediction questions, checkboxes, debugging moments, celebration cards, and simple slide-style sections where useful.",
    "Use eduClub-safe interactive blocks only, such as data-interactive-block, data-hint-toggle, data-rich-check, data-rich-quiz, data-rich-reflection, and data-rich-progress.",
    "Do not use script tags, onclick handlers, external JavaScript, external CSS, or heavy libraries inside rich content.",
    "Keep the content focused on this activity title and avoid creating extra modules or unrelated activities.",
  ].join("\n");
}

const aiActivityModes = [
  ["generate_activity", "Generate"],
  ["explain_activity", "Explain"],
  ["improve_activity", "Improve"],
  ["quiz_builder", "Quiz"],
  ["coding_helper", "Code"],
];

function courseStructureForPrompt(modules = []) {
  return modules
    .map((courseModule, moduleIndex) => {
      const activities = (courseModule.activities || [])
        .map(
          (activity, activityIndex) =>
            `${activityIndex + 1}. ${activity.title || "Untitled"} (${activity.activity_type || "lesson"})`
        )
        .join("; ");
      return `Module ${moduleIndex + 1}: ${courseModule.title || "Untitled"}${
        activities ? ` | Activities: ${activities}` : ""
      }`;
    })
    .join("\n");
}

function defaultCourseAiPrompt(course = {}, modules = [], form = {}) {
  return [
    `Build rich eduClub course content for "${course?.name || "this course"}".`,
    `Course description: ${course?.description || form.objective || "Use the saved course description and objective."}`,
    `Target learners: ${course?.target_level || form.learner_age || "8-year-old beginners"}.`,
    `Generation mode: ${form.mode || "full_course"}.`,
    "Create specific measurable course objectives, module objectives, and activity-level objectives.",
    "Every activity should teach one focused skill with learner-friendly steps, visuals, hints, practice, and a check for understanding.",
    "Use eduClub-safe interactive blocks only: data-interactive-block reveal/flash_card/self_check, data-hint-toggle panels, data-rich-check checkboxes, data-rich-quiz buttons, data-rich-reflection textareas, and data-rich-progress indicators.",
    "Do not use script tags, onclick handlers, external JavaScript, external CSS, or heavy libraries inside rich content.",
    "For quizzes use score_at_least as the completion rule; otherwise choose only manual, viewed, scrolled, submitted, graded, or score_at_least.",
    "Respect this existing course structure when adding or extending content:",
    courseStructureForPrompt(modules) || "No modules yet.",
  ].join("\n");
}

function stringifyChecks(checks) {
  if (!checks) return "[]";
  if (typeof checks === "string") return checks;
  try {
    return JSON.stringify(Array.isArray(checks) ? checks : [], null, 2);
  } catch {
    return "[]";
  }
}

function mergeGeneratedActivityForm(current, generated = {}) {
  const content = generated.content || {};
  const questions = Array.isArray(content.questions) ? content.questions : generated.questions;

  return {
    ...current,
    title: generated.title || current.title,
    activity_type: generated.activity_type || current.activity_type,
    points: generated.points === 0 || generated.points ? Number(generated.points) : current.points,
    completion_rule: generated.completion_rule || current.completion_rule,
    pass_score:
      generated.pass_score === 0 || generated.pass_score
        ? generated.pass_score
        : current.pass_score,
    purpose: content.purpose || current.purpose,
    description: content.description || current.description,
    rich_html: content.rich_html || current.rich_html,
    discussion_prompt: content.discussion_prompt || current.discussion_prompt,
    starter_code: content.starter_code || current.starter_code,
    starter_html: content.starter_html || current.starter_html,
    starter_css: content.starter_css || current.starter_css,
    starter_js: content.starter_js || current.starter_js,
    language: content.language || current.language,
    challenge_mode: content.challenge_mode || current.challenge_mode,
    validation_checks_text: stringifyChecks(
      content.validation_checks || current.validation_checks_text
    ),
    submission_instructions: content.submission_instructions || current.submission_instructions,
    reflection_prompt: content.reflection_prompt || current.reflection_prompt,
    project_brief: content.project_brief || current.project_brief,
    friendly_hints_text: Array.isArray(content.friendly_hints)
      ? content.friendly_hints.join("\n")
      : current.friendly_hints_text,
    teacher_notes: content.teacher_notes || current.teacher_notes,
    questions: Array.isArray(questions)
      ? questions.map((question, index) => normalizeQuestionForm(question, index))
      : current.questions,
  };
}

function RichContentEditor({ value, onChange, onImageUpload }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const htmlInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [colorAnchor, setColorAnchor] = useState(null);
  const [orderedAnchor, setOrderedAnchor] = useState(null);
  const [unorderedAnchor, setUnorderedAnchor] = useState(null);
  const [tableAnchor, setTableAnchor] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [editorError, setEditorError] = useState("");
  const [sourceMode, setSourceMode] = useState(false);
  const [resourceDialog, setResourceDialog] = useState({
    open: false,
    type: "link",
    target: null,
    values: null,
  });
  const [executableDialog, setExecutableDialog] = useState({
    open: false,
    target: null,
    values: null,
  });
  const [displayCodeDialog, setDisplayCodeDialog] = useState({
    open: false,
    target: null,
    values: null,
  });
  const [hintDialog, setHintDialog] = useState({
    open: false,
    target: null,
    values: null,
  });
  const [interactiveDialog, setInteractiveDialog] = useState({
    open: false,
    target: null,
    values: null,
  });

  const serializeEditor = () => {
    if (!editorRef.current) return "";
    const clone = editorRef.current.cloneNode(true);
    clone.querySelectorAll("[data-editor-selected='true']").forEach((element) => {
      element.style.outline = "";
      element.style.outlineOffset = "";
      delete element.dataset.editorSelected;
    });
    return clone.innerHTML;
  };

  useEffect(() => {
    if (editorRef.current && serializeEditor() !== (value || "")) {
      editorRef.current.innerHTML = value || "";
      setSelectedObject(null);
    }
  }, [value, sourceMode]);

  const emitChange = () => {
    onChange(serializeEditor());
  };

  const importHtmlFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.html?$/i.test(file.name) && !/text\/html/i.test(file.type || "")) {
      setEditorError("Choose an .html or .htm file.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setEditorError("HTML imports are capped at 1MB.");
      return;
    }
    try {
      const imported = cleanImportedHtml(await file.text());
      if (!imported) {
        setEditorError("That HTML file did not contain importable content.");
        return;
      }
      const hasContent = Boolean((value || "").trim());
      const shouldReplace =
        !hasContent || window.confirm("Replace the current rich content with this HTML file?");
      const nextValue = shouldReplace ? imported : `${value || ""}${imported}`;
      onChange(nextValue);
      if (editorRef.current) editorRef.current.innerHTML = nextValue;
      setSourceMode(false);
      setEditorError("");
    } catch (error) {
      setEditorError(error.message || "Could not import the HTML file.");
    }
  };

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    const container =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
    if (container && editorRef.current.contains(container)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedRangeRef.current) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  };

  const runCommand = (command, commandValue = null) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, commandValue);
    rememberSelection();
    emitChange();
  };

  const insertHtml = (html) => runCommand("insertHTML", html);

  const insertOrReplaceHtml = (html, target = null) => {
    if (target?.isConnected) {
      const container = document.createElement("div");
      container.innerHTML = html;
      const replacement = container.firstElementChild;
      if (!replacement) return;
      target.replaceWith(replacement);
      setSelectedObject(null);
      emitChange();
      return;
    }
    insertHtml(html);
  };

  const insertTable = () => {
    runCommand(
      "insertHTML",
      "<table style='width:100%;border-collapse:collapse'><tr><th style='border:1px solid #d1d5db;padding:6px'>Heading</th><th style='border:1px solid #d1d5db;padding:6px'>Heading</th></tr><tr><td style='border:1px solid #d1d5db;padding:6px'>Text</td><td style='border:1px solid #d1d5db;padding:6px'>Text</td></tr></table>"
    );
  };

  const applyListStyle = (ordered, style) => {
    runCommand(ordered ? "insertOrderedList" : "insertUnorderedList");
    const selection = window.getSelection();
    const node = selection?.anchorNode?.parentElement;
    const list = node?.closest?.("ol,ul");
    if (list) {
      list.style.listStyleType = style;
      list.style.paddingLeft = "2rem";
      list.style.marginLeft = "0.5rem";
    }
    emitChange();
  };

  const selectedCell = () => {
    if (selectedObject?.matches?.("td,th")) return selectedObject;
    if (selectedObject?.matches?.("table")) return selectedObject.querySelector("td,th");
    const selection = window.getSelection();
    const node =
      selection?.anchorNode?.nodeType === 3
        ? selection.anchorNode.parentElement
        : selection?.anchorNode;
    return node?.closest?.("td,th") || null;
  };

  const addTableRow = () => {
    const cell = selectedCell();
    const row = cell?.parentElement;
    if (!row) return;
    const clone = row.cloneNode(true);
    Array.from(clone.children).forEach((child) => {
      child.innerHTML = "Text";
    });
    row.after(clone);
    emitChange();
  };

  const deleteTableRow = () => {
    const row = selectedCell()?.parentElement;
    if (row) {
      row.remove();
      emitChange();
    }
  };

  const addTableColumn = () => {
    const cell = selectedCell();
    const index = cell ? Array.from(cell.parentElement.children).indexOf(cell) : -1;
    const table = cell?.closest("table");
    if (!table || index < 0) return;
    Array.from(table.rows).forEach((row) => {
      const newCell = row.cells[index].cloneNode(true);
      newCell.innerHTML = row.rowIndex === 0 ? "Heading" : "Text";
      row.cells[index].after(newCell);
    });
    emitChange();
  };

  const deleteTableColumn = () => {
    const cell = selectedCell();
    const index = cell ? Array.from(cell.parentElement.children).indexOf(cell) : -1;
    const table = cell?.closest("table");
    if (!table || index < 0) return;
    Array.from(table.rows).forEach((row) => row.cells[index]?.remove());
    emitChange();
  };

  const openResourceDialog = (type, target = null) => {
    rememberSelection();
    const values = target
      ? {
          url: target.getAttribute(type === "image" ? "src" : "href") || "",
          label: target.textContent || "",
          alt: target.getAttribute("alt") || "",
        }
      : null;
    setResourceDialog({ open: true, type, target, values });
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setEditorError("Image uploads are capped at 2MB.");
      return;
    }
    setEditorError("");
    try {
      const url = await onImageUpload(file);
      insertHtml(
        `<img src="${url}" alt="${file.name}" style="max-width:70%;height:auto;cursor:pointer" />`
      );
    } catch (error) {
      setEditorError(error.message || "Could not upload the image.");
    }
  };

  const selectEditorObject = (event) => {
    const object =
      event.target.closest?.("[data-executable-code]") ||
      event.target.closest?.("[data-hint-block]") ||
      event.target.closest?.("[data-interactive-block]") ||
      event.target.closest?.("img,table,td,th,pre,a");
    if (selectedObject && selectedObject !== object) {
      selectedObject.style.outline = "";
      selectedObject.style.outlineOffset = "";
      delete selectedObject.dataset.editorSelected;
    }
    if (object) {
      object.style.outline = "2px solid #2563eb";
      object.style.outlineOffset = "2px";
      object.dataset.editorSelected = "true";
    }
    setSelectedObject(object || null);
  };

  const updateSelectedObject = (action) => {
    if (!selectedObject) return;
    const target = selectedObject.matches("td,th")
      ? selectedObject.closest("table")
      : selectedObject;
    if (action === "delete") {
      target.remove();
      setSelectedObject(null);
    } else if (target.matches("img")) {
      if (action.startsWith("size:")) {
        target.style.maxWidth = action.replace("size:", "");
        target.style.width = "auto";
      } else if (action.startsWith("align:")) {
        const alignment = action.replace("align:", "");
        target.style.display = "block";
        target.style.marginLeft =
          alignment === "right" ? "auto" : alignment === "center" ? "auto" : "0";
        target.style.marginRight =
          alignment === "left" ? "auto" : alignment === "center" ? "auto" : "0";
      } else if (action.startsWith("crop:")) {
        const shape = action.replace("crop:", "");
        const ratios = { square: "1 / 1", landscape: "16 / 9", portrait: "4 / 5" };
        target.style.aspectRatio = ratios[shape] || "";
        target.style.objectFit = shape === "reset" ? "contain" : "cover";
        target.style.width = shape === "reset" ? "auto" : "min(100%, 520px)";
        target.style.height = "auto";
      }
    }
    emitChange();
  };

  const openExecutableDialog = (target = null) => {
    rememberSelection();
    setExecutableDialog({
      open: true,
      target,
      values: target
        ? {
            title: target.dataset.codeTitle || target.querySelector("strong")?.textContent || "",
            source: executableSourceFromPayload(target.dataset.executableCode),
          }
        : null,
    });
  };

  const openDisplayCodeDialog = (target = null) => {
    rememberSelection();
    setDisplayCodeDialog({
      open: true,
      target,
      values: target
        ? {
            title: target.dataset.codeTitle || "",
            language: target.dataset.codeLanguage || "text",
            code: target.querySelector("code")?.textContent || target.textContent || "",
          }
        : null,
    });
  };

  const openHintDialog = (target = null) => {
    rememberSelection();
    setHintDialog({
      open: true,
      target,
      values: target
        ? {
            title: target.dataset.hintTitle || "Need a hint?",
            body: target.dataset.hintBody || "",
          }
        : null,
    });
  };

  const openInteractiveDialog = (target = null) => {
    rememberSelection();
    setInteractiveDialog({
      open: true,
      target,
      values: target
        ? {
            type: target.dataset.interactiveBlock || "flash_card",
            title: target.dataset.blockTitle || "Try this",
            prompt: target.dataset.blockPrompt || "",
            answer: target.dataset.blockAnswer || "",
          }
        : null,
    });
  };

  return (
    <MDBox>
      <MDBox
        display="flex"
        gap={0.5}
        flexWrap="wrap"
        mb={1}
        py={0.5}
        onMouseDown={rememberSelection}
        sx={{ position: "sticky", top: 0, zIndex: 2, bgcolor: "#ffffff" }}
      >
        {[
          ["bold", null, "format_bold"],
          ["italic", null, "format_italic"],
          ["underline", null, "format_underlined"],
        ].map(([command, commandValue, icon]) => (
          <IconButton
            key={`${command}-${commandValue || "default"}`}
            onClick={() => runCommand(command, commandValue)}
          >
            <Icon>{icon}</Icon>
          </IconButton>
        ))}
        <MDInput
          select
          value="font"
          onChange={(event) =>
            event.target.value !== "font" && runCommand("fontName", event.target.value)
          }
          SelectProps={{ native: true }}
          sx={{ width: 130 }}
        >
          <option value="font">Font</option>
          {editorFonts.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </MDInput>
        <MDInput
          select
          value="format"
          onChange={(event) =>
            event.target.value !== "format" && runCommand("formatBlock", event.target.value)
          }
          SelectProps={{ native: true }}
          sx={{ width: 95 }}
        >
          <option value="format">Style</option>
          {editorBlocks.map((block) => (
            <option key={block} value={block}>
              {block === "P" ? "Normal" : block}
            </option>
          ))}
        </MDInput>
        <MDInput
          select
          value="size"
          onChange={(event) =>
            event.target.value !== "size" && runCommand("fontSize", event.target.value)
          }
          SelectProps={{ native: true }}
          sx={{ width: 85 }}
        >
          <option value="size">Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">Huge</option>
        </MDInput>
        <IconButton onClick={(event) => setColorAnchor(event.currentTarget)}>
          <Icon>format_color_text</Icon>
        </IconButton>
        <IconButton onClick={(event) => setUnorderedAnchor(event.currentTarget)}>
          <Icon>format_list_bulleted</Icon>
        </IconButton>
        <IconButton onClick={(event) => setOrderedAnchor(event.currentTarget)}>
          <Icon>format_list_numbered</Icon>
        </IconButton>
        <IconButton onClick={(event) => setTableAnchor(event.currentTarget)}>
          <Icon>table_chart</Icon>
        </IconButton>
        <IconButton title="Insert link" onClick={() => openResourceDialog("link")}>
          <Icon>link</Icon>
        </IconButton>
        <IconButton title="Insert online image" onClick={() => openResourceDialog("image")}>
          <Icon>image</Icon>
        </IconButton>
        <IconButton title="Upload image" onClick={() => imageInputRef.current?.click()}>
          <Icon>upload</Icon>
        </IconButton>
        <IconButton title="Import HTML file" onClick={() => htmlInputRef.current?.click()}>
          <Icon>upload_file</Icon>
        </IconButton>
        <IconButton
          title={sourceMode ? "Use visual editor" : "Edit HTML source"}
          onClick={() => {
            if (!sourceMode) emitChange();
            setSelectedObject(null);
            setSourceMode((current) => !current);
          }}
        >
          <Icon>{sourceMode ? "visibility" : "html"}</Icon>
        </IconButton>
        <IconButton
          onClick={() =>
            insertHtml(
              "<code style='background:#f1f5f9;padding:2px 5px;border-radius:4px'>code</code>"
            )
          }
        >
          <Icon>code</Icon>
        </IconButton>
        <IconButton title="Insert code example" onClick={() => openDisplayCodeDialog()}>
          <Icon>data_object</Icon>
        </IconButton>
        <IconButton
          title="Insert sandboxed interactive HTML/JS"
          onClick={() => openExecutableDialog()}
        >
          <Icon>play_circle</Icon>
        </IconButton>
        <IconButton title="Insert collapsible hint" onClick={() => openHintDialog()}>
          <Icon>lightbulb</Icon>
        </IconButton>
        <IconButton
          title="Insert interactive learning block"
          onClick={() => openInteractiveDialog()}
        >
          <Icon>view_carousel</Icon>
        </IconButton>
        <IconButton
          title="Insert video or external resource"
          onClick={() => openResourceDialog("resource")}
        >
          <Icon>smart_display</Icon>
        </IconButton>
      </MDBox>
      <Menu anchorEl={colorAnchor} open={Boolean(colorAnchor)} onClose={() => setColorAnchor(null)}>
        <MDBox display="flex" gap={1} p={1}>
          {editorColors.map((color) => (
            <IconButton
              key={color}
              onClick={() => {
                runCommand("foreColor", color);
                setColorAnchor(null);
              }}
            >
              <MDBox width={22} height={22} borderRadius="50%" sx={{ bgcolor: color }} />
            </IconButton>
          ))}
        </MDBox>
      </Menu>
      <Menu
        anchorEl={unorderedAnchor}
        open={Boolean(unorderedAnchor)}
        onClose={() => setUnorderedAnchor(null)}
      >
        {unorderedListStyles.map(([style, label]) => (
          <MenuItem
            key={style}
            onClick={() => {
              applyListStyle(false, style);
              setUnorderedAnchor(null);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={orderedAnchor}
        open={Boolean(orderedAnchor)}
        onClose={() => setOrderedAnchor(null)}
      >
        {orderedListStyles.map(([style, label]) => (
          <MenuItem
            key={style}
            onClick={() => {
              applyListStyle(true, style);
              setOrderedAnchor(null);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
      <Menu anchorEl={tableAnchor} open={Boolean(tableAnchor)} onClose={() => setTableAnchor(null)}>
        <MenuItem onClick={insertTable}>Insert 2 x 2 Table</MenuItem>
        <MenuItem onClick={addTableRow}>Add Row</MenuItem>
        <MenuItem onClick={deleteTableRow}>Delete Row</MenuItem>
        <MenuItem onClick={addTableColumn}>Add Column</MenuItem>
        <MenuItem onClick={deleteTableColumn}>Delete Column</MenuItem>
      </Menu>
      {selectedObject && (
        <MDBox
          display="flex"
          alignItems="center"
          gap={0.5}
          mb={1}
          p={0.75}
          border="1px solid #bfdbfe"
          borderRadius="md"
          sx={{ position: "sticky", top: 48, zIndex: 2, bgcolor: "#eff6ff" }}
        >
          <MDTypography variant="caption" fontWeight="bold">
            Selected {selectedObject.tagName.toLowerCase()}
          </MDTypography>
          {selectedObject.matches("img") && (
            <>
              <MDButton size="small" color="info" onClick={() => updateSelectedObject("size:35%")}>
                Small
              </MDButton>
              <MDButton size="small" color="info" onClick={() => updateSelectedObject("size:70%")}>
                Medium
              </MDButton>
              <MDButton size="small" color="info" onClick={() => updateSelectedObject("size:100%")}>
                Full
              </MDButton>
              <IconButton title="Align left" onClick={() => updateSelectedObject("align:left")}>
                <Icon>format_align_left</Icon>
              </IconButton>
              <IconButton title="Align center" onClick={() => updateSelectedObject("align:center")}>
                <Icon>format_align_center</Icon>
              </IconButton>
              <IconButton title="Align right" onClick={() => updateSelectedObject("align:right")}>
                <Icon>format_align_right</Icon>
              </IconButton>
              <MDButton
                size="small"
                color="dark"
                onClick={() => updateSelectedObject("crop:landscape")}
              >
                Landscape
              </MDButton>
              <MDButton
                size="small"
                color="dark"
                onClick={() => updateSelectedObject("crop:square")}
              >
                Square
              </MDButton>
              <MDButton
                size="small"
                color="dark"
                onClick={() => updateSelectedObject("crop:portrait")}
              >
                Portrait
              </MDButton>
              <MDButton
                size="small"
                color="dark"
                onClick={() => updateSelectedObject("crop:reset")}
              >
                Reset Crop
              </MDButton>
            </>
          )}
          {selectedObject.matches("[data-executable-code]") && (
            <MDButton
              size="small"
              color="info"
              onClick={() => openExecutableDialog(selectedObject)}
            >
              Edit Code
            </MDButton>
          )}
          {selectedObject.matches("pre") && !selectedObject.matches("[data-executable-code]") && (
            <MDButton
              size="small"
              color="info"
              onClick={() => openDisplayCodeDialog(selectedObject)}
            >
              Edit Code
            </MDButton>
          )}
          {selectedObject.matches("[data-hint-block]") && (
            <MDButton size="small" color="warning" onClick={() => openHintDialog(selectedObject)}>
              Edit Hint
            </MDButton>
          )}
          {selectedObject.matches("[data-interactive-block]") && (
            <MDButton
              size="small"
              color="info"
              onClick={() => openInteractiveDialog(selectedObject)}
            >
              Edit Interactive Block
            </MDButton>
          )}
          {selectedObject.matches("a") && (
            <MDButton
              size="small"
              color="info"
              onClick={() => openResourceDialog("link", selectedObject)}
            >
              Edit Link
            </MDButton>
          )}
          {selectedObject.matches("img") && (
            <MDButton
              size="small"
              color="info"
              onClick={() => openResourceDialog("image", selectedObject)}
            >
              Edit Image
            </MDButton>
          )}
          <MDButton color="error" size="small" onClick={() => updateSelectedObject("delete")}>
            <Icon>delete</Icon>&nbsp; Delete
          </MDButton>
        </MDBox>
      )}
      {editorError && (
        <MDTypography color="error" variant="caption" display="block" mb={1}>
          {editorError}
        </MDTypography>
      )}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        onChange={uploadImage}
      />
      <input
        ref={htmlInputRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        onChange={importHtmlFile}
      />
      {sourceMode ? (
        <MDInput
          label="HTML source"
          multiline
          rows={14}
          fullWidth
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <MDBox
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onClick={selectEditorObject}
          onKeyDown={(event) => {
            if (selectedObject && ["Delete", "Backspace"].includes(event.key)) {
              event.preventDefault();
              updateSelectedObject("delete");
            }
          }}
          p={2}
          border="1px solid #d1d5db"
          borderRadius="md"
          minHeight={220}
          sx={{
            bgcolor: "#ffffff",
            outline: "none",
            "& img": { maxWidth: "100%", borderRadius: "8px" },
            "& table": { maxWidth: "100%" },
          }}
        />
      )}
      <ResourceDialog
        open={resourceDialog.open}
        initialType={resourceDialog.type}
        initialValues={resourceDialog.values}
        onClose={() => setResourceDialog({ open: false, type: "link", target: null, values: null })}
        onSave={(html) => insertOrReplaceHtml(html, resourceDialog.target)}
      />
      <ExecutableCodeDialog
        open={executableDialog.open}
        initialValues={executableDialog.values}
        onClose={() => setExecutableDialog({ open: false, target: null, values: null })}
        onSave={(html) => insertOrReplaceHtml(html, executableDialog.target)}
      />
      <DisplayCodeDialog
        open={displayCodeDialog.open}
        initialValues={displayCodeDialog.values}
        onClose={() => setDisplayCodeDialog({ open: false, target: null, values: null })}
        onSave={(html) => insertOrReplaceHtml(html, displayCodeDialog.target)}
      />
      <HintDialog
        open={hintDialog.open}
        initialValues={hintDialog.values}
        onClose={() => setHintDialog({ open: false, target: null, values: null })}
        onSave={(html) => insertOrReplaceHtml(html, hintDialog.target)}
      />
      <InteractiveBlockDialog
        open={interactiveDialog.open}
        initialValues={interactiveDialog.values}
        onClose={() => setInteractiveDialog({ open: false, target: null, values: null })}
        onSave={(html) => insertOrReplaceHtml(html, interactiveDialog.target)}
      />
    </MDBox>
  );
}

function ActivityManagerDialog({
  activity,
  courseName,
  moduleDescription,
  modulePosition,
  moduleTitle,
  open,
  saving,
  onClose,
  onImageUpload,
  onSave,
}) {
  const [form, setForm] = useState(activityToManagerForm(activity));
  const [csvText, setCsvText] = useState("");
  const [validationError, setValidationError] = useState("");
  const [aiPrompt, setAiPrompt] = useState(
    defaultActivityAiPrompt(activityToManagerForm(activity))
  );
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMode, setAiMode] = useState("generate_activity");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiLastPrompt, setAiLastPrompt] = useState("");

  useEffect(() => {
    const nextForm = activityToManagerForm(activity);
    setForm(nextForm);
    setAiPrompt(defaultActivityAiPrompt(nextForm));
    setAiPanelOpen(false);
    setAiMode("generate_activity");
    setAiGenerating(false);
    setAiMessage("");
    setAiLastPrompt("");
    setCsvText("");
    setValidationError("");
  }, [activity?.id, open]);

  if (!activity) return null;

  const updateQuestion = (index, patch) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      ),
    }));
  };

  const addQuestion = () => {
    setForm((current) => ({
      ...current,
      questions: [
        ...current.questions,
        normalizeQuestionForm({ position: current.questions.length + 1 }, current.questions.length),
      ],
    }));
  };

  const removeQuestion = (index) => {
    setForm((current) => ({
      ...current,
      questions: current.questions
        .filter((_, questionIndex) => questionIndex !== index)
        .map((question, questionIndex) => ({
          ...question,
          position: questionIndex + 1,
        })),
    }));
  };

  const importCsv = () => {
    const imported = questionsFromCsv(csvText);
    if (!imported.length) return;
    setForm((current) => ({
      ...current,
      questions: [...current.questions, ...imported].map((question, index) => ({
        ...question,
        position: index + 1,
      })),
    }));
    setCsvText("");
  };

  const addOption = (index) => {
    const isMatching = form.questions[index].question_type === "matching";
    updateQuestion(index, {
      options: [
        ...form.questions[index].options,
        isMatching ? { left: "", right: "" } : `Option ${form.questions[index].options.length + 1}`,
      ],
    });
  };

  const uploadQuestionImage = async (index, file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setValidationError("Question images are capped at 2MB.");
      return;
    }
    try {
      const imageUrl = await onImageUpload(file);
      updateQuestion(index, { image_url: imageUrl });
      setValidationError("");
    } catch (error) {
      setValidationError(error.message || "Could not upload question image.");
    }
  };

  const generateActivityDraft = async () => {
    setAiGenerating(true);
    setAiMessage("");
    setValidationError("");
    try {
      const content = structuredFormContent(form, form.questions || []);
      const response = await apiClient.post("/ai/course-builder/activity", {
        course_name: courseName,
        module_description: moduleDescription,
        module_position: modulePosition,
        module_title: moduleTitle,
        activity_position: Number(form.position || activity?.position || 1),
        generation_mode: aiMode,
        learner_age: 8,
        prompt: aiPrompt,
        activity: {
          id: activity?.id,
          title: form.title,
          activity_type: form.activity_type,
          points: Number(form.points || 0),
          completion_rule: form.completion_rule,
          pass_score: form.pass_score || null,
          content,
        },
      });
      setForm((current) => mergeGeneratedActivityForm(current, response.activity || {}));
      setAiLastPrompt(response.prompt || aiPrompt);
      setAiMessage("AI draft inserted into this activity. Review it, adjust anything, then save.");
    } catch (error) {
      setValidationError(error.message || "AI could not generate this activity right now.");
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleCorrectOption = (index, option) => {
    const question = form.questions[index];
    if (question.question_type === "multi_select") {
      const current = Array.isArray(question.correct_answer) ? question.correct_answer : [];
      updateQuestion(index, {
        correct_answer: current.includes(option)
          ? current.filter((item) => item !== option)
          : [...current, option],
      });
      return;
    }
    updateQuestion(index, { correct_answer: option });
  };

  const save = async () => {
    const allocatedMarks = form.questions.reduce(
      (sum, question) => sum + Number(question.points ?? 0),
      0
    );
    const quizMarks = Number(form.points ?? 0);
    if (form.activity_type === "quiz" && allocatedMarks > quizMarks) {
      setValidationError(
        `Question marks total ${allocatedMarks}, which exceeds the quiz total of ${quizMarks}.`
      );
      return;
    }
    if (form.activity_type === "coding") {
      try {
        const checks = JSON.parse(form.validation_checks_text || "[]");
        const checkMarks = (Array.isArray(checks) ? checks : []).reduce(
          (sum, check) => sum + Number(check.points || 0),
          0
        );
        if (checkMarks > Number(form.points || 0)) {
          setValidationError("Automatic check marks cannot exceed the activity total.");
          return;
        }
      } catch {
        setValidationError("Automatic checks must be valid JSON.");
        return;
      }
    }
    const normalizedQuestions = form.questions.map((question, index) => ({
      ...question,
      options: Array.isArray(question.options)
        ? question.options
        : String(question.options || "")
            .split("|")
            .map((option) => option.trim())
            .filter(Boolean),
      points: Number(question.points ?? 1),
      position: index + 1,
    }));
    const content = structuredFormContent(form, normalizedQuestions);

    setValidationError("");
    const result = await saveActivityWithFeedback(onSave, {
      title: form.title,
      activity_type: form.activity_type,
      content,
      points: Number(form.points || 0),
      position: Number(form.position || 1),
      is_required: form.is_required,
      availability_mode: form.availability_mode || "required",
      completion_rule: form.completion_rule,
      pass_score: form.pass_score || null,
      is_published: form.is_published,
    });

    if (!result.saved) {
      setValidationError(result.error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (!saving) onClose(event, reason);
      }}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle>Manage Activity</DialogTitle>
      <DialogContent dividers>
        {validationError && (
          <MDBox mb={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#fef2f2" }}>
            <MDTypography variant="body2" color="error">
              {validationError}
            </MDTypography>
          </MDBox>
        )}
        <MDBox
          mb={2}
          p={2}
          borderRadius="md"
          sx={{
            bgcolor: "#fffbeb",
            border: "1px solid #fde68a",
          }}
        >
          <MDBox
            display="flex"
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
            gap={1.5}
            flexDirection={{ xs: "column", md: "row" }}
          >
            <MDBox>
              <MDTypography variant="h6" fontWeight="bold">
                AI Activity Helper
              </MDTypography>
              <MDTypography variant="caption" color="text">
                Uses {moduleTitle || "this module"} context, module {modulePosition || 1}, activity{" "}
                {form.position || 1}, and this {form.activity_type} title/description. It will not
                save until you review and click Save Activity.
              </MDTypography>
            </MDBox>
            <MDBox display="flex" gap={1} flexWrap="wrap">
              {aiActivityModes.map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  color={aiMode === value ? "warning" : "default"}
                  onClick={() => setAiMode(value)}
                  size="small"
                />
              ))}
              <MDButton
                variant="outlined"
                color="warning"
                size="small"
                onClick={() => setAiPanelOpen((current) => !current)}
              >
                <Icon>{aiPanelOpen ? "expand_less" : "auto_awesome"}</Icon>&nbsp;
                {aiPanelOpen ? "Hide Prompt" : "Generate Content"}
              </MDButton>
            </MDBox>
          </MDBox>
          <Collapse in={aiPanelOpen}>
            <MDBox mt={2}>
              <MDInput
                label="Editable AI prompt"
                multiline
                rows={5}
                fullWidth
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
              />
              <MDBox
                mt={1.5}
                display="flex"
                alignItems={{ xs: "stretch", md: "center" }}
                justifyContent="space-between"
                gap={1}
                flexDirection={{ xs: "column", md: "row" }}
              >
                <MDTypography variant="caption" color="text">
                  Mode: {aiActivityModes.find(([value]) => value === aiMode)?.[1] || "Generate"}.
                  Output is rich HTML plus activity-specific fields such as quiz questions, coding
                  starter files, prompts, hints, and teacher notes.
                </MDTypography>
                <MDButton
                  variant="gradient"
                  color="warning"
                  disabled={aiGenerating || !form.title}
                  onClick={generateActivityDraft}
                >
                  <Icon>auto_awesome</Icon>&nbsp;
                  {aiGenerating ? "Generating..." : "Insert AI Draft"}
                </MDButton>
              </MDBox>
              {aiMessage && (
                <MDTypography variant="caption" color="success" display="block" mt={1}>
                  {aiMessage}
                </MDTypography>
              )}
              {aiLastPrompt && (
                <MDBox
                  component="pre"
                  mt={1.5}
                  p={1.5}
                  borderRadius="md"
                  sx={{
                    bgcolor: "#0f172a",
                    color: "#e2e8f0",
                    maxHeight: 180,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.75rem",
                  }}
                >
                  {aiLastPrompt}
                </MDBox>
              )}
            </MDBox>
          </Collapse>
        </MDBox>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Activity title"
              fullWidth
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <MDInput
              select
              label="Type"
              fullWidth
              value={form.activity_type}
              onChange={(event) => setForm({ ...form, activity_type: event.target.value })}
              SelectProps={{ native: true }}
            >
              {activityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </MDInput>
          </Grid>
          <Grid item xs={12} md={3}>
            <MDInput
              label="Marks"
              type="number"
              fullWidth
              value={form.points}
              onChange={(event) => setForm({ ...form, points: event.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              label="Short description"
              multiline
              rows={2}
              fullWidth
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MDInput
              select
              label="Completion"
              fullWidth
              value={form.completion_rule}
              onChange={(event) => setForm({ ...form, completion_rule: event.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="manual">Manual</option>
              <option value="viewed">Viewed</option>
              <option value="submitted">Submitted</option>
              <option value="graded">Graded</option>
              <option value="score_at_least">Score at least</option>
            </MDInput>
          </Grid>
          <Grid item xs={12} md={4}>
            <MDInput
              select
              label="Learning path"
              fullWidth
              value={form.availability_mode || "required"}
              onChange={(event) => setForm({ ...form, availability_mode: event.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="required">Required progressive activity</option>
              <option value="try_more">Try More optional practice</option>
            </MDInput>
          </Grid>
          <Grid item xs={12} md={4}>
            <MDInput
              label="Activity purpose"
              fullWidth
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <MDInput
              label="Teacher notes (hidden from learners)"
              multiline
              rows={3}
              fullWidth
              value={form.teacher_notes}
              onChange={(event) => setForm({ ...form, teacher_notes: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MDInput
              label="Pass score"
              type="number"
              fullWidth
              value={form.pass_score}
              onChange={(event) => setForm({ ...form, pass_score: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MDInput
              select
              label="Published"
              fullWidth
              value={form.is_published ? "yes" : "no"}
              onChange={(event) => setForm({ ...form, is_published: event.target.value === "yes" })}
              SelectProps={{ native: true }}
            >
              <option value="yes">Published</option>
              <option value="no">Unpublished</option>
            </MDInput>
          </Grid>

          <Grid item xs={12}>
            <MDTypography variant="h6" fontWeight="bold" mb={1}>
              Rich Content
            </MDTypography>
            <RichContentEditor
              value={form.rich_html}
              onImageUpload={onImageUpload}
              onChange={(richHtml) => setForm({ ...form, rich_html: richHtml })}
            />
          </Grid>

          {form.activity_type === "quiz" && (
            <Grid item xs={12}>
              <MDTypography variant="h6" fontWeight="bold" mb={1}>
                Quiz Questions
              </MDTypography>
              <MDTypography variant="caption" color="text">
                Allocated marks:{" "}
                {form.questions.reduce((sum, question) => sum + Number(question.points ?? 0), 0)} /{" "}
                {Number(form.points || 0)}
              </MDTypography>
              <MDBox display="flex" flexDirection="column" gap={1.5}>
                {form.questions.map((question, index) => (
                  <MDBox key={question.id} p={2} border="1px solid #e5e7eb" borderRadius="md">
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={5}>
                        <MDInput
                          label={`Question ${index + 1}`}
                          fullWidth
                          value={question.prompt}
                          onChange={(event) =>
                            updateQuestion(index, { prompt: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <MDInput
                          select
                          label="Answer mode"
                          fullWidth
                          value={question.question_type}
                          onChange={(event) => {
                            const questionType = event.target.value;
                            updateQuestion(index, {
                              question_type: questionType,
                              options:
                                questionType === "true_false"
                                  ? ["True", "False"]
                                  : questionType === "matching"
                                    ? [{ left: "", right: "" }]
                                    : question.options.some((option) => typeof option === "object")
                                      ? ["Option 1", "Option 2"]
                                      : question.options,
                              correct_answer:
                                questionType === "true_false"
                                  ? "True"
                                  : questionType === "multi_select"
                                    ? []
                                    : questionType === "ordering"
                                      ? question.options
                                      : "",
                            });
                          }}
                          SelectProps={{ native: true }}
                        >
                          <option value="multiple_choice">Choose one</option>
                          <option value="multi_select">Choose many</option>
                          <option value="true_false">True or false</option>
                          <option value="short_answer">Short answer</option>
                          <option value="matching">Matching pairs</option>
                          <option value="ordering">Arrange in order</option>
                        </MDInput>
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <MDInput
                          label="Marks"
                          type="number"
                          fullWidth
                          value={question.points}
                          onChange={(event) =>
                            updateQuestion(index, { points: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={6} md={2}>
                        <MDInput
                          label="Position"
                          type="number"
                          fullWidth
                          value={question.position}
                          onChange={(event) =>
                            updateQuestion(index, { position: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={2} display="flex" alignItems="center">
                        <MDButton
                          variant="text"
                          color="error"
                          size="small"
                          onClick={() => removeQuestion(index)}
                        >
                          <Icon>delete</Icon>&nbsp; Remove Question
                        </MDButton>
                      </Grid>
                      <Grid item xs={12}>
                        <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <MDButton component="label" variant="outlined" color="info" size="small">
                            {question.image_url ? "Replace Image" : "Add Image"}
                            <input
                              hidden
                              type="file"
                              accept="image/png,image/jpeg,image/gif,image/webp"
                              onChange={(event) =>
                                uploadQuestionImage(index, event.target.files?.[0])
                              }
                            />
                          </MDButton>
                          {question.image_url && (
                            <>
                              <MDBox
                                component="img"
                                src={question.image_url}
                                alt=""
                                sx={{
                                  width: 120,
                                  maxHeight: 90,
                                  objectFit: "contain",
                                  borderRadius: "6px",
                                }}
                              />
                              <MDButton
                                variant="text"
                                color="error"
                                size="small"
                                onClick={() => updateQuestion(index, { image_url: "" })}
                              >
                                Remove
                              </MDButton>
                            </>
                          )}
                        </MDBox>
                      </Grid>
                      {question.question_type === "short_answer" ? (
                        <Grid item xs={12}>
                          <MDInput
                            label="Correct answer"
                            fullWidth
                            value={question.correct_answer}
                            onChange={(event) =>
                              updateQuestion(index, { correct_answer: event.target.value })
                            }
                          />
                        </Grid>
                      ) : question.question_type === "matching" ? (
                        <Grid item xs={12}>
                          <MDBox display="flex" flexDirection="column" gap={1}>
                            {question.options.map((pair, optionIndex) => (
                              <Grid container spacing={1} key={`${question.id}-${optionIndex}`}>
                                <Grid item xs={5}>
                                  <MDInput
                                    label="Item"
                                    fullWidth
                                    value={pair.left || ""}
                                    onChange={(event) => {
                                      const options = [...question.options];
                                      options[optionIndex] = {
                                        ...pair,
                                        left: event.target.value,
                                      };
                                      updateQuestion(index, {
                                        options,
                                        correct_answer: Object.fromEntries(
                                          options
                                            .filter((item) => item.left)
                                            .map((item) => [item.left, item.right])
                                        ),
                                      });
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={2}>
                                  <MDTypography textAlign="center">matches</MDTypography>
                                </Grid>
                                <Grid item xs={5}>
                                  <MDInput
                                    label="Match"
                                    fullWidth
                                    value={pair.right || ""}
                                    onChange={(event) => {
                                      const options = [...question.options];
                                      options[optionIndex] = {
                                        ...pair,
                                        right: event.target.value,
                                      };
                                      updateQuestion(index, {
                                        options,
                                        correct_answer: Object.fromEntries(
                                          options
                                            .filter((item) => item.left)
                                            .map((item) => [item.left, item.right])
                                        ),
                                      });
                                    }}
                                  />
                                </Grid>
                              </Grid>
                            ))}
                            <MDButton
                              variant="outlined"
                              color="info"
                              size="small"
                              onClick={() => addOption(index)}
                            >
                              Add Pair
                            </MDButton>
                          </MDBox>
                        </Grid>
                      ) : (
                        <Grid item xs={12}>
                          <MDBox display="flex" flexDirection="column" gap={1}>
                            {question.options.map((option, optionIndex) => {
                              const checked =
                                question.question_type === "multi_select"
                                  ? (question.correct_answer || []).includes(option)
                                  : question.correct_answer === option;
                              return (
                                <MDBox
                                  key={`${question.id}-${optionIndex}`}
                                  display="flex"
                                  alignItems="center"
                                  gap={1}
                                  p={1}
                                  border="1px solid #e5e7eb"
                                  borderRadius="md"
                                >
                                  <MDTypography variant="button" fontWeight="bold">
                                    {optionLabel(optionIndex)}
                                  </MDTypography>
                                  {question.question_type === "multi_select" ? (
                                    <Checkbox
                                      checked={checked}
                                      onChange={() => toggleCorrectOption(index, option)}
                                    />
                                  ) : (
                                    <Radio
                                      checked={checked}
                                      onChange={() => toggleCorrectOption(index, option)}
                                    />
                                  )}
                                  <MDInput
                                    label={`Option ${optionLabel(optionIndex)}`}
                                    fullWidth
                                    value={option}
                                    onChange={(event) => {
                                      const nextOptions = [...question.options];
                                      const oldOption = nextOptions[optionIndex];
                                      nextOptions[optionIndex] = event.target.value;
                                      const nextPatch = { options: nextOptions };
                                      if (question.question_type === "ordering") {
                                        nextPatch.correct_answer = nextOptions;
                                      }
                                      if (question.correct_answer === oldOption) {
                                        nextPatch.correct_answer = event.target.value;
                                      }
                                      updateQuestion(index, nextPatch);
                                    }}
                                  />
                                </MDBox>
                              );
                            })}
                            <MDButton
                              variant="outlined"
                              color="info"
                              size="small"
                              onClick={() => addOption(index)}
                            >
                              Add Option
                            </MDButton>
                          </MDBox>
                        </Grid>
                      )}
                      <Grid item xs={12}>
                        <MDInput
                          label="Correct option summary"
                          fullWidth
                          value={asText(question.correct_answer)}
                          disabled
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <MDInput
                          label="Friendly hint"
                          fullWidth
                          value={question.hint}
                          onChange={(event) => updateQuestion(index, { hint: event.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <MDInput
                          label="Answer explanation"
                          fullWidth
                          value={question.explanation}
                          onChange={(event) =>
                            updateQuestion(index, { explanation: event.target.value })
                          }
                        />
                      </Grid>
                    </Grid>
                  </MDBox>
                ))}
              </MDBox>
              <MDBox mt={1.5} display="flex" gap={1} flexWrap="wrap">
                <MDButton variant="outlined" color="info" onClick={addQuestion}>
                  Add Question
                </MDButton>
              </MDBox>
              <MDBox mt={2}>
                <MDInput
                  label="Bulk CSV: prompt, optionA|optionB|optionC, correct answer, marks"
                  multiline
                  rows={3}
                  fullWidth
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                />
                <MDButton
                  variant="outlined"
                  color="dark"
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={importCsv}
                >
                  Import CSV
                </MDButton>
              </MDBox>
            </Grid>
          )}

          {form.activity_type === "discussion" && (
            <Grid item xs={12}>
              <MDInput
                label="Discussion prompt"
                multiline
                rows={3}
                fullWidth
                value={form.discussion_prompt}
                onChange={(event) => setForm({ ...form, discussion_prompt: event.target.value })}
              />
            </Grid>
          )}

          {["assignment", "project", "reflection"].includes(form.activity_type) && (
            <Grid item xs={12}>
              <MDInput
                label={
                  form.activity_type === "reflection"
                    ? "Reflection prompt"
                    : form.activity_type === "project"
                      ? "Project brief"
                      : "Submission instructions"
                }
                multiline
                rows={4}
                fullWidth
                value={
                  form.activity_type === "reflection"
                    ? form.reflection_prompt
                    : form.activity_type === "project"
                      ? form.project_brief
                      : form.submission_instructions
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    [form.activity_type === "reflection"
                      ? "reflection_prompt"
                      : form.activity_type === "project"
                        ? "project_brief"
                        : "submission_instructions"]: event.target.value,
                  })
                }
              />
            </Grid>
          )}

          {form.activity_type === "coding" && (
            <>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Challenge mode"
                  fullWidth
                  value={form.challenge_mode}
                  onChange={(event) => setForm({ ...form, challenge_mode: event.target.value })}
                  SelectProps={{ native: true }}
                >
                  <option value="build">Build a solution</option>
                  <option value="complete">Complete the code</option>
                  <option value="debug">Find and fix the bug</option>
                </MDInput>
              </Grid>
              <Grid item xs={12} md={3}>
                <MDInput
                  select
                  label="Code type"
                  fullWidth
                  value={form.language}
                  onChange={(event) => setForm({ ...form, language: event.target.value })}
                  SelectProps={{ native: true }}
                >
                  <option value="html_css">HTML/CSS</option>
                  <option value="html_css_js">HTML/CSS/JavaScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="sql">SQL</option>
                  <option value="text">Pseudo code</option>
                </MDInput>
              </Grid>
              <Grid item xs={12} md={9}>
                <MDInput
                  label="Starter code"
                  multiline
                  rows={7}
                  fullWidth
                  value={form.starter_code}
                  onChange={(event) => setForm({ ...form, starter_code: event.target.value })}
                  sx={{ "& textarea": { fontFamily: "monospace" } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  label="Starter HTML"
                  multiline
                  rows={7}
                  fullWidth
                  value={form.starter_html}
                  onChange={(event) => setForm({ ...form, starter_html: event.target.value })}
                  sx={{ "& textarea": { fontFamily: "monospace" } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <MDInput
                  label="Starter CSS"
                  multiline
                  rows={7}
                  fullWidth
                  value={form.starter_css}
                  onChange={(event) => setForm({ ...form, starter_css: event.target.value })}
                  sx={{ "& textarea": { fontFamily: "monospace" } }}
                />
              </Grid>
              <Grid item xs={12}>
                <MDInput
                  label="Starter JavaScript"
                  multiline
                  rows={7}
                  fullWidth
                  value={form.starter_js}
                  onChange={(event) => setForm({ ...form, starter_js: event.target.value })}
                  sx={{ "& textarea": { fontFamily: "monospace" } }}
                />
              </Grid>
              <Grid item xs={12}>
                <MDInput
                  label='Automatic checks JSON, for example [{"type":"html_contains","value":"<main","points":2}]'
                  multiline
                  rows={5}
                  fullWidth
                  value={form.validation_checks_text}
                  onChange={(event) =>
                    setForm({ ...form, validation_checks_text: event.target.value })
                  }
                  sx={{ "& textarea": { fontFamily: "monospace" } }}
                />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="dark" disabled={saving} onClick={onClose}>
          Close
        </MDButton>
        <MDButton variant="gradient" color="info" disabled={saving || !form.title} onClick={save}>
          {saving ? "Saving..." : "Save Activity"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

RichContentEditor.propTypes = {
  onImageUpload: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
};

RichContentEditor.defaultProps = {
  value: "",
};

ActivityManagerDialog.propTypes = {
  activity: PropTypes.shape({
    activity_type: PropTypes.string,
    content: PropTypes.object,
    completion_rule: PropTypes.string,
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    is_published: PropTypes.bool,
    is_required: PropTypes.bool,
    pass_score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    points: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    position: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
  }),
  courseName: PropTypes.string,
  moduleDescription: PropTypes.string,
  modulePosition: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  moduleTitle: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onImageUpload: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  saving: PropTypes.bool.isRequired,
};

ActivityManagerDialog.defaultProps = {
  activity: null,
  courseName: "",
  moduleDescription: "",
  modulePosition: 1,
  moduleTitle: "",
};

function getAnswerValue(answers, question) {
  if (!answers || !question) return "";
  return (
    answers[question.id] ?? answers[question.position] ?? answers[String(question.position)] ?? ""
  );
}

function questionKey(question) {
  return String(question?.id ?? question?.position ?? "");
}

function quizFeedbackForQuestion(feedback, question) {
  if (!feedback || !question) return {};
  return (
    feedback[question.id] ??
    feedback[question.position] ??
    feedback[String(question.position)] ??
    {}
  );
}

function earnedPointsFromFeedback(feedback) {
  if (!feedback || typeof feedback !== "object") return "";
  const values = Object.values(feedback);
  if (!values.length) return "";
  return values.reduce((sum, item) => sum + Number(item?.points || 0), 0);
}

function questionMarksFromFeedback(feedback, questions = []) {
  return Object.fromEntries(
    questions.map((question) => {
      const feedbackItem = quizFeedbackForQuestion(feedback, question);
      return [questionKey(question), Number(feedbackItem?.points || 0)];
    })
  );
}

function sumQuestionMarks(questionMarks = {}) {
  return Object.values(questionMarks).reduce((sum, value) => sum + Number(value || 0), 0);
}

function renderSubmissionContent(row) {
  const content = row.submission_content || {};
  if (!row.submission_id && !content.text && !content.file) {
    return (
      <MDTypography variant="caption" color="text">
        No submission yet.
      </MDTypography>
    );
  }

  return (
    <MDBox display="flex" flexDirection="column" gap={1}>
      {content.text && (
        <MDBox p={1.25} borderRadius="md" sx={{ bgcolor: "#f8fafc", whiteSpace: "pre-wrap" }}>
          <MDTypography variant="caption" color="dark">
            {content.text}
          </MDTypography>
        </MDBox>
      )}
      {content.output && (
        <MDBox p={1.25} borderRadius="md" sx={{ bgcolor: "#111827", whiteSpace: "pre-wrap" }}>
          <MDTypography variant="caption" sx={{ color: "#e5e7eb" }}>
            {content.output}
          </MDTypography>
        </MDBox>
      )}
      {(content.html || content.css || content.javascript || content.js) && (
        <MDBox p={1.25} borderRadius="md" sx={{ bgcolor: "#111827", whiteSpace: "pre-wrap" }}>
          <MDTypography variant="caption" sx={{ color: "#e5e7eb" }}>
            {[content.html, content.css, content.javascript || content.js]
              .filter(Boolean)
              .join("\n\n")}
          </MDTypography>
        </MDBox>
      )}
      {content.file?.url && (
        <MDButton
          component="a"
          href={content.file.url}
          target="_blank"
          rel="noreferrer"
          variant="outlined"
          color="info"
          size="small"
          startIcon={<Icon>attach_file</Icon>}
        >
          Open {content.file.name || "submission"}
        </MDButton>
      )}
    </MDBox>
  );
}

function ActivityReviewDialog({
  gradeForms,
  loading,
  onChangeGrade,
  onClose,
  onSaveGrade,
  open,
  review,
  saving,
}) {
  const activity = review?.activity;
  const learners = review?.learners || [];
  const questions = Array.isArray(activity?.content?.questions) ? activity.content.questions : [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <MDBox>
          <MDTypography variant="h5" fontWeight="bold">
            Review Activity
          </MDTypography>
          <MDTypography variant="body2" color="text">
            {activity?.course_name || "Course"} | {activity?.module_title || "Module"} |{" "}
            {activity?.title || "Activity"}
          </MDTypography>
        </MDBox>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: "#f8fafc" }}>
        {loading ? (
          <MDTypography variant="body2" color="text">
            Loading learner work...
          </MDTypography>
        ) : learners.length === 0 ? (
          <MDTypography variant="body2" color="text">
            No learners are allocated to this course yet.
          </MDTypography>
        ) : (
          <MDBox display="flex" flexDirection="column" gap={1.5}>
            {learners.map((row) => {
              const form = gradeForms[row.learner_id] || {};
              return (
                <Card key={row.learner_id}>
                  <MDBox p={2}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={3}>
                        <MDTypography variant="button" fontWeight="bold">
                          {row.full_name}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          {row.grade || "Grade not set"} {row.stream ? `| ${row.stream}` : ""}
                        </MDTypography>
                        <Chip
                          size="small"
                          sx={{ mt: 1 }}
                          label={row.progress_status || "not_started"}
                          color={row.progress_status === "graded" ? "success" : "default"}
                        />
                      </Grid>
                      <Grid item xs={12} md={5}>
                        {activity?.activity_type === "quiz" ? (
                          <MDBox display="flex" flexDirection="column" gap={1}>
                            <MDTypography variant="caption" color="text" fontWeight="bold">
                              Latest quiz attempt:{" "}
                              {row.latest_attempt_id ? `${row.quiz_score || 0}%` : "No attempt yet"}
                            </MDTypography>
                            {questions.map((question, index) => {
                              const key = questionKey(question);
                              const feedback = quizFeedbackForQuestion(row.quiz_feedback, question);
                              const maxPoints = Number(question.points || feedback.max_points || 0);
                              const currentMarks =
                                form.question_marks?.[key] ?? Number(feedback.points || 0);
                              return (
                                <MDBox
                                  key={question.id || index}
                                  p={1.25}
                                  borderRadius="md"
                                  sx={{ bgcolor: "#eef6ff", border: "1px solid #bfdbfe" }}
                                >
                                  <Grid container spacing={1} alignItems="center">
                                    <Grid item xs={12} md={8}>
                                      <MDTypography variant="caption" fontWeight="bold">
                                        {index + 1}. {question.prompt}
                                      </MDTypography>
                                      <MDTypography variant="caption" display="block" color="text">
                                        Learner:{" "}
                                        {asText(getAnswerValue(row.answers, question)) || "-"}
                                      </MDTypography>
                                      <MDTypography
                                        variant="caption"
                                        display="block"
                                        color="success"
                                      >
                                        Correct: {asText(question.correct_answer) || "-"}
                                      </MDTypography>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                      <MDInput
                                        label={`Question marks / ${maxPoints || 0}`}
                                        type="number"
                                        fullWidth
                                        value={currentMarks}
                                        inputProps={{
                                          min: 0,
                                          max: maxPoints || undefined,
                                          step: "any",
                                        }}
                                        onChange={(event) => {
                                          const rawValue = event.target.value;
                                          const numericValue =
                                            rawValue === "" ? "" : Number(rawValue);
                                          const safeValue =
                                            numericValue === ""
                                              ? ""
                                              : Math.max(
                                                  0,
                                                  maxPoints
                                                    ? Math.min(maxPoints, numericValue)
                                                    : numericValue
                                                );
                                          const questionMarks = {
                                            ...(form.question_marks || {}),
                                            [key]: safeValue,
                                          };
                                          onChangeGrade(
                                            row.learner_id,
                                            "question_marks",
                                            questionMarks
                                          );
                                        }}
                                      />
                                    </Grid>
                                  </Grid>
                                </MDBox>
                              );
                            })}
                          </MDBox>
                        ) : (
                          renderSubmissionContent(row)
                        )}
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <MDInput
                              label={`Grade${activity?.points ? ` / ${activity.points}` : ""}`}
                              type="number"
                              fullWidth
                              value={form.score ?? ""}
                              inputProps={{
                                min: 0,
                                max: Number(activity?.points || 0) || undefined,
                                step: "any",
                              }}
                              onChange={(event) =>
                                onChangeGrade(row.learner_id, "score", event.target.value)
                              }
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <MDInput
                              select
                              label="Level"
                              fullWidth
                              value={form.performance_level || ""}
                              onChange={(event) =>
                                onChangeGrade(
                                  row.learner_id,
                                  "performance_level",
                                  event.target.value
                                )
                              }
                              SelectProps={{ native: true }}
                            >
                              <option value="">Select</option>
                              <option value="Excellent">Excellent</option>
                              <option value="Good">Good</option>
                              <option value="Developing">Developing</option>
                              <option value="Needs support">Needs support</option>
                            </MDInput>
                          </Grid>
                          <Grid item xs={12}>
                            <MDInput
                              label="Teacher remarks"
                              multiline
                              rows={2}
                              fullWidth
                              value={form.teacher_remarks || ""}
                              onChange={(event) =>
                                onChangeGrade(row.learner_id, "teacher_remarks", event.target.value)
                              }
                            />
                          </Grid>
                        </Grid>
                        <MDBox mt={1.5} display="flex" justifyContent="flex-end">
                          <MDButton
                            variant="gradient"
                            color="info"
                            size="small"
                            disabled={saving || form.score === ""}
                            onClick={() => onSaveGrade(row)}
                          >
                            Save Grade
                          </MDButton>
                        </MDBox>
                      </Grid>
                    </Grid>
                  </MDBox>
                </Card>
              );
            })}
          </MDBox>
        )}
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="dark" onClick={onClose}>
          Close
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

ActivityReviewDialog.propTypes = {
  gradeForms: PropTypes.objectOf(
    PropTypes.shape({
      performance_level: PropTypes.string,
      question_marks: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
      score: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      teacher_remarks: PropTypes.string,
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired,
  onChangeGrade: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaveGrade: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  review: PropTypes.shape({
    activity: PropTypes.shape({
      activity_type: PropTypes.string,
      content: PropTypes.shape({
        questions: PropTypes.arrayOf(PropTypes.shape({})),
      }),
      course_name: PropTypes.string,
      module_title: PropTypes.string,
      points: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      title: PropTypes.string,
    }),
    learners: PropTypes.arrayOf(PropTypes.shape({})),
  }),
  saving: PropTypes.bool.isRequired,
};

ActivityReviewDialog.defaultProps = {
  review: null,
};

function AiCourseBuilderDialog({
  draft,
  form,
  generating,
  inserting,
  lastPrompt,
  open,
  onApply,
  onChange,
  onClose,
  onGenerate,
  onRegeneratePrompt,
}) {
  const moduleCount = draft?.modules?.length || 0;
  const activityCount =
    draft?.modules?.reduce(
      (total, courseModule) => total + (courseModule.activities?.length || 0),
      0
    ) || 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>AI Course Builder</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <MDInput
              select
              label="Generate"
              fullWidth
              value={form.mode}
              onChange={(event) => onChange({ mode: event.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="full_course">Full course draft</option>
              <option value="outline">Course outline</option>
              <option value="modules">Modules</option>
              <option value="activities">Activities</option>
              <option value="quiz_bank">Quiz bank</option>
              <option value="teacher_notes">Teacher notes</option>
              <option value="try_more">Try-more activities</option>
            </MDInput>
          </Grid>
          <Grid item xs={12} md={4}>
            <MDInput
              label="Learner age"
              fullWidth
              value={form.learner_age}
              onChange={(event) => onChange({ learner_age: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MDInput
              select
              label="Interactivity"
              fullWidth
              value={form.interactivity_level}
              onChange={(event) => onChange({ interactivity_level: event.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="high">High: clickable and playful</option>
              <option value="medium">Medium: balanced</option>
              <option value="simple">Simple: mostly guided text</option>
            </MDInput>
          </Grid>
          <Grid item xs={6} md={2}>
            <MDInput
              label="Modules"
              type="number"
              fullWidth
              value={form.module_count}
              onChange={(event) => onChange({ module_count: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <MDInput
              label="Activities/module"
              type="number"
              fullWidth
              value={form.activities_per_module}
              onChange={(event) => onChange({ activities_per_module: event.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              label="Course objective"
              multiline
              rows={3}
              fullWidth
              value={form.objective}
              onChange={(event) => onChange({ objective: event.target.value })}
              placeholder="Example: Help Grade 4 learners understand safe internet use through practical activities."
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              label="Editable AI prompt sent to the provider"
              multiline
              rows={8}
              fullWidth
              value={form.prompt}
              onChange={(event) => onChange({ prompt: event.target.value })}
              placeholder="Fine tune the exact course builder prompt before generating."
            />
            <MDBox mt={1} display="flex" justifyContent="space-between" gap={1} flexWrap="wrap">
              <MDTypography variant="caption" color="text">
                This prompt includes the course description, current structure, objective quality
                rules, safe interactive blocks, and completion-rule guidance.
              </MDTypography>
              <MDButton variant="text" color="info" size="small" onClick={onRegeneratePrompt}>
                <Icon>refresh</Icon>&nbsp;Regenerate Prompt From Course
              </MDButton>
            </MDBox>
          </Grid>
          <Grid item xs={12}>
            <MDBox display="flex" gap={1.5} flexWrap="wrap">
              {[
                ["include_quizzes", "Quizzes"],
                ["include_discussions", "Discussions"],
                ["include_try_more", "Try more"],
                ["include_teacher_notes", "Teacher notes"],
                ["include_coding", "Coding challenges"],
              ].map(([field, label]) => (
                <MDBox key={field} display="flex" alignItems="center" gap={0.5}>
                  <Checkbox
                    checked={Boolean(form[field])}
                    onChange={(event) => onChange({ [field]: event.target.checked })}
                  />
                  <MDTypography variant="caption" color="text">
                    {label}
                  </MDTypography>
                </MDBox>
              ))}
            </MDBox>
          </Grid>
        </Grid>

        <MDBox mt={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#eef6ff" }}>
          <MDTypography variant="caption" color="text">
            AI generates a draft only. Review it here first, then insert it into this template when
            you are satisfied.
          </MDTypography>
        </MDBox>

        {lastPrompt && (
          <MDBox mt={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#f8fafc" }}>
            <MDTypography variant="caption" color="text" fontWeight="medium">
              Last prompt sent
            </MDTypography>
            <MDBox
              component="pre"
              mt={1}
              p={1.5}
              borderRadius="md"
              sx={{
                bgcolor: "#0f172a",
                color: "#e2e8f0",
                maxHeight: 220,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                fontSize: "0.75rem",
              }}
            >
              {lastPrompt}
            </MDBox>
          </MDBox>
        )}

        {draft && (
          <MDBox mt={3}>
            <MDBox display="flex" gap={1} alignItems="center" flexWrap="wrap" mb={2}>
              <Chip label={`${moduleCount} modules`} color="info" size="small" />
              <Chip label={`${activityCount} activities`} color="success" size="small" />
              <Chip label="Preview only" color="warning" size="small" />
            </MDBox>
            <MDTypography variant="h5">{draft.title}</MDTypography>
            <MDTypography variant="body2" color="text" mb={2}>
              {draft.description || "No description generated."}
            </MDTypography>
            <MDBox display="flex" flexDirection="column" gap={1.5}>
              {(draft.modules || []).map((courseModule, moduleIndex) => (
                <MDBox
                  key={`${courseModule.title}-${moduleIndex}`}
                  p={1.5}
                  borderRadius="md"
                  border="1px solid #e5e7eb"
                >
                  <MDTypography variant="h6">
                    Module {moduleIndex + 1}: {courseModule.title}
                  </MDTypography>
                  <MDTypography variant="caption" color="text" display="block" mb={1}>
                    {courseModule.description}
                  </MDTypography>
                  {(courseModule.activities || []).map((activity, activityIndex) => (
                    <MDBox
                      key={`${activity.title}-${activityIndex}`}
                      display="flex"
                      justifyContent="space-between"
                      gap={1}
                      py={0.5}
                      borderTop={activityIndex === 0 ? "0" : "1px solid #f1f5f9"}
                    >
                      <MDTypography variant="button">
                        {activityIndex + 1}. {activity.title}
                      </MDTypography>
                      <Chip label={activity.activity_type} size="small" />
                    </MDBox>
                  ))}
                </MDBox>
              ))}
            </MDBox>
          </MDBox>
        )}
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="dark" onClick={onClose}>
          Close
        </MDButton>
        <MDButton color="info" onClick={onGenerate} disabled={generating || !form.objective}>
          {generating ? "Generating..." : "Generate Draft"}
        </MDButton>
        <MDButton
          variant="gradient"
          color="success"
          onClick={onApply}
          disabled={inserting || !draft?.modules?.length}
        >
          {inserting ? "Inserting..." : "Insert Draft"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

AiCourseBuilderDialog.propTypes = {
  draft: PropTypes.shape({
    title: PropTypes.string,
    description: PropTypes.string,
    modules: PropTypes.arrayOf(PropTypes.shape({})),
  }),
  form: PropTypes.shape({
    activities_per_module: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    learner_age: PropTypes.string.isRequired,
    include_coding: PropTypes.bool.isRequired,
    include_discussions: PropTypes.bool.isRequired,
    include_quizzes: PropTypes.bool.isRequired,
    include_teacher_notes: PropTypes.bool.isRequired,
    include_try_more: PropTypes.bool.isRequired,
    interactivity_level: PropTypes.string.isRequired,
    mode: PropTypes.string.isRequired,
    module_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    objective: PropTypes.string.isRequired,
    prompt: PropTypes.string.isRequired,
  }).isRequired,
  generating: PropTypes.bool.isRequired,
  inserting: PropTypes.bool.isRequired,
  lastPrompt: PropTypes.string,
  open: PropTypes.bool.isRequired,
  onApply: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  onRegeneratePrompt: PropTypes.func.isRequired,
};

AiCourseBuilderDialog.defaultProps = {
  draft: null,
  lastPrompt: "",
};

function CourseBuilder() {
  const { user } = useAuth();
  const { templateId, courseId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isTemplate = pathname.startsWith("/system-admin");
  const reviewMode = !isTemplate && searchParams.get("review") === "1";
  const entityId = isTemplate ? templateId : courseId;
  const [data, setData] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const [editorMode, setEditorMode] = useState("add-module");
  const [moduleActionAnchor, setModuleActionAnchor] = useState(null);
  const [activityActionAnchor, setActivityActionAnchor] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [activityManagerOpen, setActivityManagerOpen] = useState(false);
  const [activityReviewOpen, setActivityReviewOpen] = useState(false);
  const [earlyUnlockTarget, setEarlyUnlockTarget] = useState(null);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [draggingOrderItem, setDraggingOrderItem] = useState(null);
  const [activityReview, setActivityReview] = useState(null);
  const [activityReviewLoading, setActivityReviewLoading] = useState(false);
  const [activityReviewSaving, setActivityReviewSaving] = useState(false);
  const [gradeForms, setGradeForms] = useState({});
  const [courseForm, setCourseForm] = useState({});
  const [moduleEditForm, setModuleEditForm] = useState(emptyModule(1));
  const [activityEditForm, setActivityEditForm] = useState(emptyActivity(1));
  const [moduleForm, setModuleForm] = useState(emptyModule(1));
  const [activityForm, setActivityForm] = useState(emptyActivity(1));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentTerm, setCurrentTerm] = useState(null);
  const [termWeeks, setTermWeeks] = useState([]);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [aiLastPrompt, setAiLastPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiInserting, setAiInserting] = useState(false);
  const [aiForm, setAiForm] = useState({
    mode: "full_course",
    learner_age: "8 years old beginner",
    module_count: 4,
    activities_per_module: 6,
    interactivity_level: "high",
    include_quizzes: true,
    include_discussions: true,
    include_try_more: true,
    include_teacher_notes: true,
    include_coding: false,
    objective: "",
    prompt: "",
  });

  const modules = data?.modules || [];
  const selectedModule = useMemo(
    () => modules.find((module) => Number(module.id) === Number(selectedModuleId)) || modules[0],
    [modules, selectedModuleId]
  );
  const selectedActivity = useMemo(
    () =>
      selectedModule?.activities?.find(
        (activity) => Number(activity.id) === Number(selectedActivityId)
      ) || selectedModule?.activities?.[0],
    [selectedModule, selectedActivityId]
  );
  const course = data?.course || data?.template;
  const buildCurrentCourseAiPrompt = (form = aiForm) =>
    defaultCourseAiPrompt(course, modules, form);
  const versionLabel = isTemplate
    ? `Template v${course?.version || 1}`
    : `School v${course?.school_version || 1}${
        course?.template_version ? ` | Synced template v${course.template_version}` : ""
      }${course?.current_template_version ? ` of ${course.current_template_version}` : ""}`;

  const loadBuilder = async () => {
    setLoading(true);
    setError("");
    try {
      const response = isTemplate
        ? await apiClient.get(`/course-templates/${entityId}/builder`)
        : await apiClient.get(`/courses/${entityId}/learning-overview`);
      setData(response);
      setSelectedModuleId((current) =>
        response.modules?.some((module) => Number(module.id) === Number(current)) ? current : null
      );
      setSelectedActivityId((current) =>
        response.modules?.some((module) =>
          module.activities?.some((activity) => Number(activity.id) === Number(current))
        )
          ? current
          : null
      );
      setCourseForm({
        name: (response.course || response.template)?.name || "",
        code: (response.course || response.template)?.code || "",
        target_level: (response.course || response.template)?.target_level || "",
        estimated_weeks: (response.course || response.template)?.estimated_weeks || "",
        description: (response.course || response.template)?.description || "",
        course_category: (response.course || response.template)?.course_category || "general",
        is_active: (response.course || response.template)?.is_active !== false,
      });
      const responseCourse = response.course || response.template || {};
      setAiForm((current) => {
        const nextForm = {
          ...current,
          learner_age: current.learner_age || responseCourse.target_level || "",
          objective: current.objective || responseCourse.description || "",
        };
        return {
          ...nextForm,
          prompt:
            current.prompt ||
            defaultCourseAiPrompt(responseCourse, response.modules || [], nextForm),
        };
      });
      setModuleForm(emptyModule((response.modules?.length || 0) + 1));
      setActivityForm(emptyActivity((response.modules?.[0]?.activities?.length || 0) + 1));
    } catch (err) {
      setError(err.message || "Failed to load builder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedModuleId(null);
    setSelectedActivityId(null);
    setEditorMode("add-module");
    setExpandedModules({});
    loadBuilder();
  }, [entityId, isTemplate]);

  useEffect(() => {
    if (isTemplate) return;
    async function loadScheduleOptions() {
      try {
        const term = await apiClient.get("/academic/terms/current");
        setCurrentTerm(term);
        const weeks = term?.id ? await apiClient.get(`/academic/terms/${term.id}/weeks`) : [];
        setTermWeeks(weeks || []);
      } catch {
        setCurrentTerm(null);
        setTermWeeks([]);
      }
    }
    loadScheduleOptions();
  }, [isTemplate]);

  useEffect(() => {
    if (!reviewMode || modules.length === 0) return;
    setExpandedModules(
      modules.reduce(
        (expanded, courseModule) => ({
          ...expanded,
          [courseModule.id]: true,
        }),
        {}
      )
    );
  }, [reviewMode, modules.length]);

  useEffect(() => {
    if (selectedModule) {
      setModuleEditForm(moduleToForm(selectedModule));
      setActivityForm(emptyActivity((selectedModule.activities?.length || 0) + 1));
      setAddActivityOpen(false);
      if (
        editorMode === "edit-activity" &&
        !selectedModule.activities?.some(
          (activity) => Number(activity.id) === Number(selectedActivityId)
        )
      ) {
        setSelectedActivityId(selectedModule.activities?.[0]?.id || null);
      }
    }
  }, [selectedModule?.id]);

  useEffect(() => {
    if (selectedActivity) {
      setActivityEditForm(activityToForm(selectedActivity));
    }
  }, [selectedActivity?.id]);

  const updateCourseDetails = async () => {
    if (!isTemplate) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.put(`/course-templates/${entityId}`, {
        ...courseForm,
        estimated_weeks: courseForm.estimated_weeks ? Number(courseForm.estimated_weeks) : null,
      });
      setMessage("Template details saved.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const generateAiDraft = async () => {
    if (!isTemplate) return;
    setAiGenerating(true);
    setError("");
    setMessage("");
    try {
      const response = await apiClient.post("/ai/course-builder/generate", {
        ...aiForm,
        template_id: Number(entityId),
        course_description: course?.description || "",
        course_structure: modules.map((courseModule) => ({
          title: courseModule.title,
          description: courseModule.description,
          activities: (courseModule.activities || []).map((activity) => ({
            title: activity.title,
            activity_type: activity.activity_type,
          })),
        })),
        module_count: Number(aiForm.module_count || 1),
        activities_per_module: Number(aiForm.activities_per_module || 1),
      });
      setAiDraft(response.draft);
      setAiLastPrompt(response.prompt || aiForm.prompt || "");
      setMessage("AI draft generated. Review it before inserting.");
    } catch (err) {
      setError(err.message || "AI draft could not be generated.");
    } finally {
      setAiGenerating(false);
    }
  };

  const regenerateAiPrompt = () => {
    setAiForm((current) => ({
      ...current,
      prompt: buildCurrentCourseAiPrompt(current),
    }));
  };

  const applyAiDraft = async () => {
    if (!isTemplate || !aiDraft) return;
    setAiInserting(true);
    setError("");
    setMessage("");
    try {
      await apiClient.post("/ai/course-builder/apply", {
        template_id: Number(entityId),
        draft: aiDraft,
      });
      setMessage("AI draft inserted into the template.");
      setAiDraft(null);
      setAiDialogOpen(false);
      await loadBuilder();
    } catch (err) {
      setError(err.message || "AI draft could not be inserted.");
    } finally {
      setAiInserting(false);
    }
  };

  const createModule = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/${entityId}/modules`
        : `/courses/${entityId}/modules`;
      await apiClient.post(endpoint, moduleForm);
      setMessage("Module added.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const closeMenus = () => {
    setModuleActionAnchor(null);
    setActivityActionAnchor(null);
    setActionTarget(null);
  };

  const selectModuleForEdit = (courseModule) => {
    setSelectedModuleId(courseModule.id);
    setSelectedActivityId(null);
    setModuleEditForm(moduleToForm(courseModule));
    setEditorMode("edit-module");
    closeMenus();
  };

  const selectActivityForEdit = (courseModule, activity) => {
    setSelectedModuleId(courseModule.id);
    setSelectedActivityId(activity.id);
    setActivityEditForm(activityToForm(activity));
    setEditorMode("edit-activity");
    closeMenus();
  };

  const openActivityManager = (courseModule, activity) => {
    setSelectedModuleId(courseModule.id);
    setSelectedActivityId(activity.id);
    setActivityEditForm(activityToForm(activity));
    setActivityManagerOpen(true);
    closeMenus();
  };

  const openActivityReview = async (courseModule, activity) => {
    if (!activity) return;
    setSelectedModuleId(courseModule.id);
    setSelectedActivityId(activity.id);
    setActivityReviewOpen(true);
    setActivityReviewLoading(true);
    setActivityReview(null);
    setError("");
    closeMenus();
    try {
      const response = await apiClient.get(`/courses/activities/${activity.id}/review`);
      setActivityReview(response);
      const forms = {};
      const questions = response.activity?.content?.questions || [];
      (response.learners || []).forEach((learner) => {
        const earnedPoints = earnedPointsFromFeedback(learner.quiz_feedback);
        const questionMarks =
          learner.question_marks && Object.keys(learner.question_marks).length
            ? learner.question_marks
            : questionMarksFromFeedback(learner.quiz_feedback, questions);
        forms[learner.learner_id] = {
          score:
            learner.grade_score !== null && learner.grade_score !== undefined
              ? learner.grade_score
              : earnedPoints,
          question_marks: questionMarks,
          performance_level: learner.performance_level || "",
          teacher_remarks: learner.teacher_remarks || "",
        };
      });
      setGradeForms(forms);
    } catch (err) {
      setError(err.message || "Failed to load review.");
    } finally {
      setActivityReviewLoading(false);
    }
  };

  const updateGradeForm = (learnerId, field, value) => {
    setGradeForms((current) => ({
      ...current,
      [learnerId]: {
        ...(current[learnerId] || {}),
        [field]: value,
        ...(field === "question_marks" ? { score: sumQuestionMarks(value) } : {}),
      },
    }));
  };

  const saveLearnerGrade = async (row) => {
    const activityId = activityReview?.activity?.id;
    if (!activityId) return;
    const form = gradeForms[row.learner_id] || {};
    setActivityReviewSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.put(`/courses/activities/${activityId}/learners/${row.learner_id}/grade`, {
        score: form.score,
        question_marks: form.question_marks || {},
        performance_level: form.performance_level,
        teacher_remarks: form.teacher_remarks,
      });
      const refreshed = await apiClient.get(`/courses/activities/${activityId}/review`);
      setActivityReview(refreshed);
      setMessage("Learner grade saved.");
    } catch (err) {
      setError(err.message || "Failed to save grade.");
    } finally {
      setActivityReviewSaving(false);
    }
  };

  const createEarlyUnlock = ({ module, activity = null }) => {
    if (isTemplate) return;
    setEarlyUnlockTarget({ module, activity });
    closeMenus();
  };

  const viewModuleFeedback = () => {
    if (isTemplate) return;
    closeMenus();
    navigate(`/school-admin/courses/${entityId}/reviews`);
  };

  const updateModulePublished = async (courseModule, isPublished) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${courseModule.id}`
        : `/courses/modules/${courseModule.id}`;
      await apiClient.put(endpoint, {
        ...courseModule,
        unlock_at: isTemplate ? null : courseModule.unlock_at || null,
        is_published: isPublished,
      });
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateModule = async () => {
    if (!selectedModule) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${selectedModule.id}`
        : `/courses/modules/${selectedModule.id}`;
      await apiClient.put(endpoint, {
        ...moduleEditForm,
        unlock_at: isTemplate ? null : moduleEditForm.unlock_at || null,
      });
      setMessage("Module saved.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const applyModuleOrder = async (orderedModules) => {
    const changedModules = orderedModules.filter((courseModule) => {
      const original = modules.find((item) => Number(item.id) === Number(courseModule.id));
      return Number(original?.position) !== Number(courseModule.position);
    });
    if (!changedModules.length) return;

    setData((current) => (current ? { ...current, modules: orderedModules } : current));
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await Promise.all(
        changedModules.map((courseModule) => {
          const endpoint = isTemplate
            ? `/course-templates/modules/${courseModule.id}`
            : `/courses/modules/${courseModule.id}`;
          return apiClient.put(endpoint, {
            ...moduleToForm(courseModule),
            position: Number(courseModule.position),
            unlock_at: isTemplate ? null : courseModule.unlock_at || null,
          });
        })
      );
      setMessage("Module order saved.");
    } catch (err) {
      setError(err.message || "Could not save module order.");
      await loadBuilder();
    } finally {
      setSaving(false);
    }
  };

  const reorderModules = (movedId, targetId) => {
    applyModuleOrder(reorderItemsById(modules, movedId, targetId));
  };

  const moveModuleOrder = (movedId, direction) => {
    applyModuleOrder(moveItemById(modules, movedId, direction));
  };

  const deleteModule = async (courseModule) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${courseModule.id}`
        : `/courses/modules/${courseModule.id}`;
      await apiClient.delete(endpoint);
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createActivity = async () => {
    if (!selectedModule) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${selectedModule.id}/activities`
        : `/courses/modules/${selectedModule.id}/activities`;
      await apiClient.post(endpoint, parseActivityPayload(activityForm));
      setMessage("Activity added.");
      setAddActivityOpen(false);
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateActivityPublished = async (activity, isPublished) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/activities/${activity.id}`
        : `/courses/activities/${activity.id}`;
      await apiClient.put(endpoint, { ...activity, is_published: isPublished });
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateActivity = async () => {
    if (!selectedActivity) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/activities/${selectedActivity.id}`
        : `/courses/activities/${selectedActivity.id}`;
      await apiClient.put(endpoint, parseActivityPayload(activityEditForm));
      setMessage("Activity saved.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveManagedActivity = async (payload) => {
    if (!selectedActivity) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/activities/${selectedActivity.id}`
        : `/courses/activities/${selectedActivity.id}`;
      const updatedActivity = await apiClient.put(endpoint, payload);
      setData((current) => replaceActivityInBuilderData(current, updatedActivity));
      setMessage("Activity saved.");
      setActivityManagerOpen(false);
      return updatedActivity;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const uploadActivityImage = async (file) => {
    const dataUrl = await readFileAsDataUrl(file);
    const response = await apiClient.post("/courses/activity-images", {
      fileName: file.name,
      dataUrl,
    });
    return response.url;
  };

  const deleteActivity = async (activity) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/activities/${activity.id}`
        : `/courses/activities/${activity.id}`;
      await apiClient.delete(endpoint);
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const applyActivityOrder = async (courseModule, orderedActivities) => {
    const originalActivities = courseModule.activities || [];
    const changedActivities = orderedActivities.filter((activity) => {
      const original = originalActivities.find((item) => Number(item.id) === Number(activity.id));
      return Number(original?.position) !== Number(activity.position);
    });
    if (!changedActivities.length) return;

    setData((current) =>
      current
        ? {
            ...current,
            modules: (current.modules || []).map((moduleItem) =>
              Number(moduleItem.id) === Number(courseModule.id)
                ? { ...moduleItem, activities: orderedActivities }
                : moduleItem
            ),
          }
        : current
    );
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${courseModule.id}/activities/order`
        : `/courses/modules/${courseModule.id}/activities/order`;
      const savedActivities = await apiClient.put(endpoint, {
        activity_ids: orderedActivities.map((activity) => activity.id),
      });
      setData((current) =>
        current
          ? {
              ...current,
              modules: (current.modules || []).map((moduleItem) =>
                Number(moduleItem.id) === Number(courseModule.id)
                  ? { ...moduleItem, activities: savedActivities }
                  : moduleItem
              ),
            }
          : current
      );
      setMessage("Activity order saved.");
    } catch (err) {
      setError(err.message || "Could not save activity order.");
      setData((current) =>
        current
          ? {
              ...current,
              modules: (current.modules || []).map((moduleItem) =>
                Number(moduleItem.id) === Number(courseModule.id)
                  ? { ...moduleItem, activities: originalActivities }
                  : moduleItem
              ),
            }
          : current
      );
    } finally {
      setSaving(false);
    }
  };

  const reorderActivities = (courseModule, movedId, targetId) => {
    applyActivityOrder(
      courseModule,
      reorderItemsById(courseModule.activities || [], movedId, targetId)
    );
  };

  const moveActivityOrder = (courseModule, movedId, direction) => {
    applyActivityOrder(
      courseModule,
      moveItemById(courseModule.activities || [], movedId, direction)
    );
  };

  const syncCourse = async (action) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.post(`/courses/${entityId}/${action}-template`, {});
      setMessage(action === "sync" ? "Template updates synced." : "Template content restored.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const requestTemplateUpdate = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.post(`/teacher-assignments/courses/${entityId}/update-requests`, {});
      setMessage("The school admin has been notified to review this update.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3} display="flex" justifyContent="space-between" alignItems="center" gap={2}>
          <MDBox minWidth={0}>
            <MDTypography variant="h3">
              {isTemplate ? "Template Builder" : "School Course Builder"}
            </MDTypography>
            <MDTypography variant="body2" color="text">
              {course?.name || "Course"} | {versionLabel}
            </MDTypography>
            {!isTemplate && course?.update_available && (
              <Chip label="Template update available" color="warning" size="small" sx={{ mt: 1 }} />
            )}
          </MDBox>
          <MDBox display="flex" gap={1} flexWrap="wrap">
            {isTemplate && (
              <>
                <MDButton
                  variant="gradient"
                  color="warning"
                  startIcon={<Icon>auto_awesome</Icon>}
                  onClick={() => setAiDialogOpen(true)}
                >
                  AI Builder
                </MDButton>
                <MDButton
                  variant="outlined"
                  color="info"
                  startIcon={<Icon>visibility</Icon>}
                  onClick={() => navigate(`/system-admin/courses/${entityId}/preview`)}
                >
                  View as Learner
                </MDButton>
              </>
            )}
            {!isTemplate && (
              <>
                <MDButton
                  variant="outlined"
                  color="info"
                  startIcon={<Icon>visibility</Icon>}
                  onClick={() => navigate(`/school-admin/courses/${entityId}/preview`)}
                >
                  Preview as Learner
                </MDButton>
                <MDButton
                  variant={reviewMode ? "gradient" : "outlined"}
                  color="success"
                  onClick={() =>
                    setSearchParams((current) => {
                      const next = new URLSearchParams(current);
                      if (reviewMode) {
                        next.delete("review");
                      } else {
                        next.set("review", "1");
                      }
                      return next;
                    })
                  }
                >
                  {reviewMode ? "Exit Review" : "Review Learner Work"}
                </MDButton>
                {user?.role === "school_admin" ? (
                  <>
                    <MDButton
                      variant="outlined"
                      color="info"
                      disabled={saving}
                      onClick={() => syncCourse("sync")}
                    >
                      Sync Template
                    </MDButton>
                    <MDButton
                      variant="outlined"
                      color="warning"
                      disabled={saving}
                      onClick={() => syncCourse("rollback")}
                    >
                      Roll Back
                    </MDButton>
                  </>
                ) : (
                  course?.update_available && (
                    <MDButton
                      variant="outlined"
                      color="warning"
                      disabled={saving}
                      onClick={requestTemplateUpdate}
                    >
                      Ask Admin to Update
                    </MDButton>
                  )
                )}
              </>
            )}
            <MDButton
              variant="outlined"
              color="dark"
              onClick={() =>
                navigate(isTemplate ? "/system-admin/courses" : "/school-admin/courses")
              }
            >
              Close
            </MDButton>
          </MDBox>
        </MDBox>

        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={2}>
            {error}
          </MDTypography>
        )}
        {message && (
          <MDTypography variant="caption" color="success" display="block" mb={2}>
            {message}
          </MDTypography>
        )}
        {isTemplate &&
          !activityManagerOpen &&
          !activityReviewOpen &&
          !earlyUnlockTarget &&
          !aiDialogOpen && (
            <MDButton
              variant="gradient"
              color="warning"
              onClick={() => setAiDialogOpen(true)}
              sx={{
                position: "fixed",
                right: { xs: 18, md: 28 },
                bottom: { xs: 88, md: 30 },
                zIndex: 1200,
                borderRadius: "999px",
                boxShadow: "0 14px 28px rgba(245, 158, 11, 0.28)",
                px: { xs: 2, md: 2.5 },
                minWidth: { xs: 52, md: "auto" },
              }}
            >
              <Icon>auto_awesome</Icon>
              <MDBox component="span" ml={{ xs: 0, md: 1 }} display={{ xs: "none", md: "inline" }}>
                AI Builder
              </MDBox>
            </MDButton>
          )}
        {reviewMode && (
          <MDBox mb={2} p={1.5} borderRadius="md" sx={{ bgcolor: "#dcfce7" }}>
            <MDTypography variant="body2" color="success" fontWeight="medium">
              Review mode is active. Select the grading icon beside an activity to inspect learner
              submissions, quiz answers, code, files, comments, and grades.
            </MDTypography>
          </MDBox>
        )}

        {loading ? (
          <Card>
            <MDBox p={3}>
              <MDTypography variant="body2" color="text">
                Loading builder...
              </MDTypography>
            </MDBox>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {isTemplate && (
              <Grid item xs={12}>
                <Card>
                  <MDBox p={2.5}>
                    <MDTypography variant="h6" fontWeight="bold" mb={2}>
                      Template Details
                    </MDTypography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={4}>
                        <MDInput
                          label="Template name"
                          fullWidth
                          value={courseForm.name}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, name: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <MDInput
                          label="Code"
                          fullWidth
                          value={courseForm.code}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, code: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <MDInput
                          label="Level"
                          fullWidth
                          value={courseForm.target_level}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, target_level: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <MDInput
                          label="Weeks"
                          type="number"
                          fullWidth
                          value={courseForm.estimated_weeks}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, estimated_weeks: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <MDInput
                          label="Description"
                          multiline
                          rows={2}
                          fullWidth
                          value={courseForm.description}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, description: event.target.value })
                          }
                        />
                      </Grid>
                    </Grid>
                    <MDBox mt={2}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        disabled={saving || !courseForm.name}
                        onClick={updateCourseDetails}
                      >
                        Save Template
                      </MDButton>
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
            )}
            <Grid item xs={12} lg={4}>
              <Card>
                <MDBox p={2.5}>
                  <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <MDTypography variant="h6" fontWeight="bold">
                      Modules
                    </MDTypography>
                    <MDButton
                      variant="outlined"
                      color="info"
                      size="small"
                      onClick={() => setEditorMode("add-module")}
                    >
                      Add
                    </MDButton>
                  </MDBox>
                  <MDBox display="flex" flexDirection="column" gap={1}>
                    {modules.map((courseModule, moduleIndex) => {
                      const expanded = Boolean(expandedModules[courseModule.id]);
                      return (
                        <MDBox
                          key={courseModule.id}
                          draggable={!saving}
                          onDragStart={() =>
                            setDraggingOrderItem({ type: "module", id: courseModule.id })
                          }
                          onDragEnd={() => setDraggingOrderItem(null)}
                          onDragOver={(event) => {
                            if (draggingOrderItem?.type === "module") event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (draggingOrderItem?.type === "module") {
                              reorderModules(draggingOrderItem.id, courseModule.id);
                            }
                            setDraggingOrderItem(null);
                          }}
                          border="1px solid #e5e7eb"
                          borderRadius="md"
                          overflow="hidden"
                          sx={{
                            bgcolor:
                              draggingOrderItem?.type === "module" &&
                              Number(draggingOrderItem.id) === Number(courseModule.id)
                                ? "#f8fafc"
                                : "#ffffff",
                          }}
                        >
                          <MDBox
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            px={1.5}
                            py={1}
                          >
                            <MDBox display="flex" alignItems="center" gap={0.75} minWidth={0}>
                              <Icon color="disabled" sx={{ cursor: "grab" }}>
                                drag_indicator
                              </Icon>
                              <MDBox minWidth={0}>
                                <MDTypography variant="button" fontWeight="medium">
                                  {courseModule.title}
                                </MDTypography>
                                <MDTypography variant="caption" color="text" display="block">
                                  {courseModule.activities.length} activities
                                </MDTypography>
                              </MDBox>
                            </MDBox>
                            <MDBox display="flex" alignItems="center" gap={0.5}>
                              <MDBox display={{ xs: "flex", md: "none" }} alignItems="center">
                                <IconButton
                                  size="small"
                                  aria-label={`Move ${courseModule.title} up`}
                                  disabled={saving || moduleIndex === 0}
                                  onClick={() => moveModuleOrder(courseModule.id, -1)}
                                >
                                  <Icon>keyboard_arrow_up</Icon>
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label={`Move ${courseModule.title} down`}
                                  disabled={saving || moduleIndex === modules.length - 1}
                                  onClick={() => moveModuleOrder(courseModule.id, 1)}
                                >
                                  <Icon>keyboard_arrow_down</Icon>
                                </IconButton>
                              </MDBox>
                              <Chip
                                size="small"
                                label={courseModule.is_published ? "Published" : "Hidden"}
                                color={courseModule.is_published ? "success" : "default"}
                              />
                              <IconButton
                                size="small"
                                aria-label="Toggle activities"
                                onClick={() =>
                                  setExpandedModules((current) => ({
                                    ...current,
                                    [courseModule.id]: !current[courseModule.id],
                                  }))
                                }
                              >
                                <Icon>{expanded ? "expand_less" : "expand_more"}</Icon>
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="Module actions"
                                onClick={(event) => {
                                  setActionTarget(courseModule);
                                  setModuleActionAnchor(event.currentTarget);
                                }}
                              >
                                <Icon>more_vert</Icon>
                              </IconButton>
                            </MDBox>
                          </MDBox>
                          <Collapse in={expanded}>
                            <MDBox px={1.5} pb={1.5}>
                              {courseModule.activities.length === 0 ? (
                                <MDTypography variant="caption" color="text">
                                  No activities yet.
                                </MDTypography>
                              ) : (
                                courseModule.activities.map((activity, activityIndex) => (
                                  <MDBox
                                    key={activity.id}
                                    draggable={!saving}
                                    onDragStart={(event) => {
                                      event.stopPropagation();
                                      const dragPayload = {
                                        type: "activity",
                                        moduleId: courseModule.id,
                                        id: activity.id,
                                      };
                                      event.dataTransfer.effectAllowed = "move";
                                      event.dataTransfer.setData(
                                        "application/educlub-activity",
                                        JSON.stringify(dragPayload)
                                      );
                                      event.dataTransfer.setData(
                                        "text/plain",
                                        activity.title || ""
                                      );
                                      setDraggingOrderItem(dragPayload);
                                    }}
                                    onDragEnd={(event) => {
                                      event.stopPropagation();
                                      setDraggingOrderItem(null);
                                    }}
                                    onDragOver={(event) => {
                                      if (
                                        event.dataTransfer.types.includes(
                                          "application/educlub-activity"
                                        ) ||
                                        (draggingOrderItem?.type === "activity" &&
                                          Number(draggingOrderItem.moduleId) ===
                                            Number(courseModule.id))
                                      ) {
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect = "move";
                                      }
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const transferred = event.dataTransfer.getData(
                                        "application/educlub-activity"
                                      );
                                      const droppedActivity = transferred
                                        ? JSON.parse(transferred)
                                        : draggingOrderItem;
                                      if (
                                        droppedActivity?.type === "activity" &&
                                        Number(droppedActivity.moduleId) === Number(courseModule.id)
                                      ) {
                                        reorderActivities(
                                          courseModule,
                                          droppedActivity.id,
                                          activity.id
                                        );
                                      }
                                      setDraggingOrderItem(null);
                                    }}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    py={0.75}
                                    borderTop="1px solid #eef0f2"
                                    sx={{
                                      bgcolor:
                                        draggingOrderItem?.type === "activity" &&
                                        Number(draggingOrderItem.id) === Number(activity.id)
                                          ? "#f8fafc"
                                          : "transparent",
                                    }}
                                  >
                                    <MDBox
                                      display="flex"
                                      alignItems="center"
                                      gap={0.75}
                                      minWidth={0}
                                    >
                                      <Icon color="disabled" sx={{ cursor: "grab", fontSize: 18 }}>
                                        drag_indicator
                                      </Icon>
                                      <MDBox minWidth={0}>
                                        <MDTypography variant="caption" fontWeight="medium">
                                          {activity.title}
                                        </MDTypography>
                                        <MDTypography
                                          variant="caption"
                                          color="text"
                                          display="block"
                                        >
                                          {activity.activity_type} | {activity.points || 0} marks
                                        </MDTypography>
                                      </MDBox>
                                    </MDBox>
                                    <MDBox display="flex" alignItems="center" gap={0.25}>
                                      <MDBox display={{ xs: "flex", md: "none" }}>
                                        <IconButton
                                          size="small"
                                          aria-label={`Move ${activity.title} up`}
                                          disabled={saving || activityIndex === 0}
                                          onClick={() =>
                                            moveActivityOrder(courseModule, activity.id, -1)
                                          }
                                        >
                                          <Icon>keyboard_arrow_up</Icon>
                                        </IconButton>
                                        <IconButton
                                          size="small"
                                          aria-label={`Move ${activity.title} down`}
                                          disabled={
                                            saving ||
                                            activityIndex === courseModule.activities.length - 1
                                          }
                                          onClick={() =>
                                            moveActivityOrder(courseModule, activity.id, 1)
                                          }
                                        >
                                          <Icon>keyboard_arrow_down</Icon>
                                        </IconButton>
                                      </MDBox>
                                      {!isTemplate && (
                                        <IconButton
                                          size="small"
                                          color={reviewMode ? "success" : "default"}
                                          aria-label={`Review ${activity.title}`}
                                          title="Review learner submissions and grades"
                                          onClick={() => openActivityReview(courseModule, activity)}
                                        >
                                          <Icon>grading</Icon>
                                        </IconButton>
                                      )}
                                      <IconButton
                                        size="small"
                                        aria-label="Activity actions"
                                        onClick={(event) => {
                                          setActionTarget({ module: courseModule, activity });
                                          setActivityActionAnchor(event.currentTarget);
                                        }}
                                      >
                                        <Icon>more_vert</Icon>
                                      </IconButton>
                                    </MDBox>
                                  </MDBox>
                                ))
                              )}
                            </MDBox>
                          </Collapse>
                        </MDBox>
                      );
                    })}
                  </MDBox>

                  <MDBox mt={3} display={editorMode === "add-module" ? "block" : "none"}>
                    <MDTypography variant="button" fontWeight="bold">
                      Add Module
                    </MDTypography>
                    <MDBox mt={1} display="flex" flexDirection="column" gap={1.25}>
                      <MDInput
                        label="Module title"
                        value={moduleForm.title}
                        onChange={(event) =>
                          setModuleForm({ ...moduleForm, title: event.target.value })
                        }
                      />
                      <MDInput
                        label="Description"
                        multiline
                        rows={2}
                        value={moduleForm.description}
                        onChange={(event) =>
                          setModuleForm({ ...moduleForm, description: event.target.value })
                        }
                      />
                      {!isTemplate && currentTerm && (
                        <MDInput
                          select
                          label={`Opening week in ${currentTerm.name}`}
                          value={moduleForm.schedule_week_number}
                          onChange={(event) =>
                            setModuleForm({
                              ...moduleForm,
                              schedule_term_id: currentTerm.id,
                              schedule_week_number: event.target.value,
                            })
                          }
                          SelectProps={{ native: true }}
                        >
                          <option value="">Available immediately</option>
                          {termWeeks.map((week) => (
                            <option key={week.id} value={week.week_number}>
                              Week {week.week_number} | {String(week.start_date).slice(0, 10)}
                            </option>
                          ))}
                        </MDInput>
                      )}
                      <MDButton
                        variant="gradient"
                        color="success"
                        disabled={saving || !moduleForm.title}
                        onClick={createModule}
                      >
                        Add Module
                      </MDButton>
                    </MDBox>
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>

            <Grid item xs={12} lg={8}>
              <Card>
                <MDBox p={2.5}>
                  {editorMode === "edit-module" && selectedModule ? (
                    <>
                      <MDBox
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        gap={1}
                      >
                        <MDBox>
                          <MDTypography variant="h5" fontWeight="bold">
                            {selectedModule.title}
                          </MDTypography>
                          <MDTypography variant="body2" color="text">
                            {selectedModule.description || "No description yet."}
                          </MDTypography>
                        </MDBox>
                        <MDBox display="flex" alignItems="center" gap={1}>
                          <Chip
                            size="small"
                            label={selectedModule.is_published ? "Published" : "Unpublished"}
                            color={selectedModule.is_published ? "success" : "default"}
                          />
                        </MDBox>
                      </MDBox>

                      <MDBox mt={2} p={2} border="1px solid #e5e7eb" borderRadius="md">
                        <MDTypography variant="button" fontWeight="bold">
                          Edit Module
                        </MDTypography>
                        <Grid container spacing={1.5} mt={0.5}>
                          <Grid item xs={12} md={7}>
                            <MDInput
                              label="Module title"
                              fullWidth
                              value={moduleEditForm.title}
                              onChange={(event) =>
                                setModuleEditForm({
                                  ...moduleEditForm,
                                  title: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={5}>
                            <MDInput
                              select
                              label="Published"
                              fullWidth
                              value={moduleEditForm.is_published ? "yes" : "no"}
                              onChange={(event) =>
                                setModuleEditForm({
                                  ...moduleEditForm,
                                  is_published: event.target.value === "yes",
                                })
                              }
                              SelectProps={{ native: true }}
                            >
                              <option value="yes">Published</option>
                              <option value="no">Unpublished</option>
                            </MDInput>
                          </Grid>
                          <Grid item xs={12}>
                            <MDInput
                              label="Module description"
                              multiline
                              rows={2}
                              fullWidth
                              value={moduleEditForm.description}
                              onChange={(event) =>
                                setModuleEditForm({
                                  ...moduleEditForm,
                                  description: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          {!isTemplate && currentTerm && (
                            <Grid item xs={12} md={5}>
                              <MDInput
                                select
                                label={`Opening week in ${currentTerm.name}`}
                                fullWidth
                                value={moduleEditForm.schedule_week_number}
                                onChange={(event) =>
                                  setModuleEditForm({
                                    ...moduleEditForm,
                                    schedule_term_id: currentTerm.id,
                                    schedule_week_number: event.target.value,
                                  })
                                }
                                SelectProps={{ native: true }}
                              >
                                <option value="">Available immediately</option>
                                {termWeeks.map((week) => (
                                  <option key={week.id} value={week.week_number}>
                                    Week {week.week_number} | {String(week.start_date).slice(0, 10)}
                                  </option>
                                ))}
                              </MDInput>
                            </Grid>
                          )}
                        </Grid>
                        <MDBox mt={2}>
                          <MDButton
                            variant="gradient"
                            color="info"
                            disabled={saving || !moduleEditForm.title}
                            onClick={updateModule}
                          >
                            Save Module
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    </>
                  ) : editorMode === "edit-activity" && selectedActivity ? (
                    <MDBox>
                      <MDTypography variant="h5" fontWeight="bold">
                        {selectedActivity.title}
                      </MDTypography>
                      <MDTypography variant="body2" color="text">
                        Editing activity in {selectedModule?.title}
                      </MDTypography>
                      <MDBox mt={3} pt={2} borderTop="1px solid #e5e7eb">
                        <MDTypography variant="button" fontWeight="bold">
                          Edit Activity
                        </MDTypography>
                        <Grid container spacing={1.5} mt={0.5}>
                          <Grid item xs={12} md={7}>
                            <MDInput
                              label="Activity title"
                              fullWidth
                              value={activityEditForm.title}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  title: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <MDInput
                              select
                              label="Type"
                              fullWidth
                              value={activityEditForm.activity_type}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  activity_type: event.target.value,
                                })
                              }
                              SelectProps={{ native: true }}
                            >
                              {activityTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </MDInput>
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <MDInput
                              label="Marks"
                              type="number"
                              fullWidth
                              value={activityEditForm.points}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  points: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <MDInput
                              select
                              label="Completion"
                              fullWidth
                              value={activityEditForm.completion_rule}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  completion_rule: event.target.value,
                                })
                              }
                              SelectProps={{ native: true }}
                            >
                              <option value="manual">Manual</option>
                              <option value="viewed">Viewed</option>
                              <option value="submitted">Submitted</option>
                              <option value="graded">Graded</option>
                              <option value="score_at_least">Score at least</option>
                            </MDInput>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <MDInput
                              select
                              label="Published"
                              fullWidth
                              value={activityEditForm.is_published ? "yes" : "no"}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  is_published: event.target.value === "yes",
                                })
                              }
                              SelectProps={{ native: true }}
                            >
                              <option value="yes">Published</option>
                              <option value="no">Unpublished</option>
                            </MDInput>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <MDInput
                              label="Pass score"
                              type="number"
                              fullWidth
                              value={activityEditForm.pass_score}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  pass_score: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <MDInput
                              label="Content or JSON"
                              multiline
                              rows={5}
                              fullWidth
                              value={activityEditForm.content_text}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  content_text: event.target.value,
                                })
                              }
                            />
                          </Grid>
                        </Grid>
                        <MDBox mt={2}>
                          <MDButton
                            variant="gradient"
                            color="info"
                            disabled={saving || !activityEditForm.title}
                            onClick={updateActivity}
                          >
                            Save Activity
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    </MDBox>
                  ) : selectedModule ? (
                    <MDBox>
                      <MDTypography variant="h5" fontWeight="bold">
                        {selectedModule.title}
                      </MDTypography>
                      <MDTypography variant="body2" color="text">
                        Choose an action from the module list, or add a quick activity when needed.
                      </MDTypography>

                      <MDBox
                        mt={2.5}
                        p={1.5}
                        border="1px solid #e5e7eb"
                        borderRadius="md"
                        sx={{ bgcolor: addActivityOpen ? "#ffffff" : "#f8fafc" }}
                      >
                        <MDBox
                          display="flex"
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                          gap={1}
                          flexDirection={{ xs: "column", md: "row" }}
                        >
                          <MDBox>
                            <MDTypography variant="button" fontWeight="bold">
                              Quick Add Activity
                            </MDTypography>
                            <MDTypography variant="caption" color="text" display="block">
                              Keep this compact; use Manage Activity for rich content and quizzes.
                            </MDTypography>
                          </MDBox>
                          <MDButton
                            variant={addActivityOpen ? "outlined" : "gradient"}
                            color={addActivityOpen ? "dark" : "success"}
                            size="small"
                            onClick={() => setAddActivityOpen((current) => !current)}
                          >
                            <Icon>{addActivityOpen ? "expand_less" : "add"}</Icon>&nbsp;
                            {addActivityOpen ? "Hide" : "Add Activity"}
                          </MDButton>
                        </MDBox>

                        <Collapse in={addActivityOpen}>
                          <MDBox mt={1.5}>
                            <Grid container spacing={1.25}>
                              <Grid item xs={12} md={6}>
                                <MDInput
                                  label="Activity title"
                                  fullWidth
                                  value={activityForm.title}
                                  onChange={(event) =>
                                    setActivityForm({ ...activityForm, title: event.target.value })
                                  }
                                />
                              </Grid>
                              <Grid item xs={7} md={3}>
                                <MDInput
                                  select
                                  label="Type"
                                  fullWidth
                                  value={activityForm.activity_type}
                                  onChange={(event) =>
                                    setActivityForm({
                                      ...activityForm,
                                      activity_type: event.target.value,
                                    })
                                  }
                                  SelectProps={{ native: true }}
                                >
                                  {activityTypes.map((type) => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ))}
                                </MDInput>
                              </Grid>
                              <Grid item xs={5} md={3}>
                                <MDInput
                                  label="Marks"
                                  type="number"
                                  fullWidth
                                  value={activityForm.points}
                                  onChange={(event) =>
                                    setActivityForm({ ...activityForm, points: event.target.value })
                                  }
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <MDInput
                                  label="Optional short content or JSON"
                                  multiline
                                  rows={2}
                                  fullWidth
                                  value={activityForm.content_text}
                                  onChange={(event) =>
                                    setActivityForm({
                                      ...activityForm,
                                      content_text: event.target.value,
                                    })
                                  }
                                />
                              </Grid>
                            </Grid>
                            <MDBox mt={1.5} display="flex" justifyContent="flex-end">
                              <MDButton
                                variant="gradient"
                                color="success"
                                size="small"
                                disabled={saving || !activityForm.title}
                                onClick={createActivity}
                              >
                                Add Activity
                              </MDButton>
                            </MDBox>
                          </MDBox>
                        </Collapse>
                      </MDBox>
                    </MDBox>
                  ) : (
                    <MDTypography variant="body2" color="text">
                      Add a module to begin building this course.
                    </MDTypography>
                  )}
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        )}
        <Menu anchorEl={moduleActionAnchor} open={Boolean(moduleActionAnchor)} onClose={closeMenus}>
          <MenuItem onClick={() => selectModuleForEdit(actionTarget)}>Edit</MenuItem>
          {!isTemplate && (
            <MenuItem onClick={() => createEarlyUnlock({ module: actionTarget })}>
              Unlock Early
            </MenuItem>
          )}
          {!isTemplate && (
            <MenuItem onClick={() => viewModuleFeedback(actionTarget)}>View Feedback</MenuItem>
          )}
          <MenuItem
            onClick={() => {
              updateModulePublished(actionTarget, !actionTarget?.is_published);
              closeMenus();
            }}
          >
            {actionTarget?.is_published ? "Unpublish" : "Publish"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (actionTarget) deleteModule(actionTarget);
              closeMenus();
            }}
          >
            Delete
          </MenuItem>
        </Menu>
        <Menu
          anchorEl={activityActionAnchor}
          open={Boolean(activityActionAnchor)}
          onClose={closeMenus}
        >
          <MenuItem
            onClick={() => openActivityManager(actionTarget?.module, actionTarget?.activity)}
          >
            Manage
          </MenuItem>
          {!isTemplate && (
            <MenuItem
              onClick={() => openActivityReview(actionTarget?.module, actionTarget?.activity)}
            >
              Review Learners
            </MenuItem>
          )}
          {!isTemplate && (
            <MenuItem
              onClick={() =>
                createEarlyUnlock({
                  module: actionTarget?.module,
                  activity: actionTarget?.activity,
                })
              }
            >
              Unlock Early
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              updateActivityPublished(
                actionTarget?.activity,
                !actionTarget?.activity?.is_published
              );
              closeMenus();
            }}
          >
            {actionTarget?.activity?.is_published ? "Unpublish" : "Publish"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (actionTarget?.activity) deleteActivity(actionTarget.activity);
              closeMenus();
            }}
          >
            Delete
          </MenuItem>
        </Menu>
        <AiCourseBuilderDialog
          draft={aiDraft}
          form={aiForm}
          generating={aiGenerating}
          inserting={aiInserting}
          lastPrompt={aiLastPrompt}
          open={aiDialogOpen}
          onApply={applyAiDraft}
          onChange={(changes) => setAiForm((current) => ({ ...current, ...changes }))}
          onClose={() => setAiDialogOpen(false)}
          onGenerate={generateAiDraft}
          onRegeneratePrompt={regenerateAiPrompt}
        />
        <ActivityManagerDialog
          activity={selectedActivity}
          courseName={course?.name || ""}
          moduleDescription={selectedModule?.description || ""}
          modulePosition={selectedModule?.position || 1}
          moduleTitle={selectedModule?.title || ""}
          open={activityManagerOpen}
          saving={saving}
          onClose={() => setActivityManagerOpen(false)}
          onImageUpload={uploadActivityImage}
          onSave={saveManagedActivity}
        />
        <EarlyUnlockDialog
          open={Boolean(earlyUnlockTarget)}
          courseId={entityId}
          courseModule={earlyUnlockTarget?.module}
          activity={earlyUnlockTarget?.activity}
          onClose={() => setEarlyUnlockTarget(null)}
          onSaved={() => setMessage("Early unlock saved.")}
        />
        <ActivityReviewDialog
          gradeForms={gradeForms}
          loading={activityReviewLoading}
          open={activityReviewOpen}
          review={activityReview}
          saving={activityReviewSaving}
          onChangeGrade={updateGradeForm}
          onClose={() => setActivityReviewOpen(false)}
          onSaveGrade={saveLearnerGrade}
        />
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default CourseBuilder;
