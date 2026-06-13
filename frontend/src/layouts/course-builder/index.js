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
  replaceActivityInBuilderData,
  saveActivityWithFeedback,
  structuredFormContent,
} from "./activityForm";
import DisplayCodeDialog from "./dialogs/DisplayCodeDialog";
import EarlyUnlockDialog from "./dialogs/EarlyUnlockDialog";
import ExecutableCodeDialog from "./dialogs/ExecutableCodeDialog";
import ResourceDialog from "./dialogs/ResourceDialog";
import { executableSourceFromPayload } from "./dialogs/authoringUtils";

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

function RichContentEditor({ value, onChange, onImageUpload }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [colorAnchor, setColorAnchor] = useState(null);
  const [orderedAnchor, setOrderedAnchor] = useState(null);
  const [unorderedAnchor, setUnorderedAnchor] = useState(null);
  const [tableAnchor, setTableAnchor] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [editorError, setEditorError] = useState("");
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
  }, [value]);

  const emitChange = () => {
    onChange(serializeEditor());
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
        <IconButton title="Insert executable code" onClick={() => openExecutableDialog()}>
          <Icon>play_circle</Icon>
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
    </MDBox>
  );
}

function ActivityManagerDialog({ activity, open, saving, onClose, onImageUpload, onSave }) {
  const [form, setForm] = useState(activityToManagerForm(activity));
  const [csvText, setCsvText] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setForm(activityToManagerForm(activity));
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
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
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
          <Grid item xs={6} md={2}>
            <MDInput
              label="Marks"
              type="number"
              fullWidth
              value={form.points}
              onChange={(event) => setForm({ ...form, points: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <MDInput
              label="Position"
              type="number"
              fullWidth
              value={form.position}
              onChange={(event) => setForm({ ...form, position: event.target.value })}
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
          <Grid item xs={12} md={4}>
            <MDInput
              label="Badge name"
              fullWidth
              value={form.badge_name}
              onChange={(event) => setForm({ ...form, badge_name: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MDInput
              label="Milestone key"
              fullWidth
              value={form.milestone_key}
              onChange={(event) => setForm({ ...form, milestone_key: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Image URL"
              fullWidth
              value={form.image_url}
              onChange={(event) => setForm({ ...form, image_url: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Image alternative text"
              fullWidth
              value={form.image_alt}
              onChange={(event) => setForm({ ...form, image_alt: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Teacher-approved external video URL"
              fullWidth
              value={form.video_url}
              onChange={(event) => setForm({ ...form, video_url: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Video title"
              fullWidth
              value={form.video_title}
              onChange={(event) => setForm({ ...form, video_title: event.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              label="Video transcript or text alternative"
              multiline
              rows={3}
              fullWidth
              value={form.transcript}
              onChange={(event) => setForm({ ...form, transcript: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Friendly hints (one per line)"
              multiline
              rows={3}
              fullWidth
              value={form.friendly_hints_text}
              onChange={(event) => setForm({ ...form, friendly_hints_text: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Teacher notes (hidden from learners)"
              multiline
              rows={3}
              fullWidth
              value={form.teacher_notes}
              onChange={(event) => setForm({ ...form, teacher_notes: event.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              label="Optional Level Up challenge"
              multiline
              rows={3}
              fullWidth
              value={form.level_up}
              onChange={(event) => setForm({ ...form, level_up: event.target.value })}
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

          {form.activity_type === "quiz" ? (
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
          ) : (
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
  onClose: PropTypes.func.isRequired,
  onImageUpload: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  saving: PropTypes.bool.isRequired,
};

ActivityManagerDialog.defaultProps = {
  activity: null,
};

function getAnswerValue(answers, question) {
  if (!answers || !question) return "";
  return (
    answers[question.id] ?? answers[question.position] ?? answers[String(question.position)] ?? ""
  );
}

function earnedPointsFromFeedback(feedback) {
  if (!feedback || typeof feedback !== "object") return "";
  const values = Object.values(feedback);
  if (!values.length) return "";
  return values.reduce((sum, item) => sum + Number(item?.points || 0), 0);
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
                            {questions.map((question, index) => (
                              <MDBox
                                key={question.id || index}
                                p={1.25}
                                borderRadius="md"
                                sx={{ bgcolor: "#eef6ff", border: "1px solid #bfdbfe" }}
                              >
                                <MDTypography variant="caption" fontWeight="bold">
                                  {index + 1}. {question.prompt}
                                </MDTypography>
                                <MDTypography variant="caption" display="block" color="text">
                                  Learner: {asText(getAnswerValue(row.answers, question)) || "-"}
                                </MDTypography>
                                <MDTypography variant="caption" display="block" color="success">
                                  Correct: {asText(question.correct_answer) || "-"}
                                </MDTypography>
                              </MDBox>
                            ))}
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
      (response.learners || []).forEach((learner) => {
        const earnedPoints = earnedPointsFromFeedback(learner.quiz_feedback);
        forms[learner.learner_id] = {
          score:
            learner.grade_score !== null && learner.grade_score !== undefined
              ? learner.grade_score
              : earnedPoints,
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
            {!isTemplate && (
              <>
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
                    {modules.map((courseModule) => {
                      const expanded = Boolean(expandedModules[courseModule.id]);
                      return (
                        <MDBox
                          key={courseModule.id}
                          border="1px solid #e5e7eb"
                          borderRadius="md"
                          overflow="hidden"
                        >
                          <MDBox
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            px={1.5}
                            py={1}
                          >
                            <MDBox minWidth={0}>
                              <MDTypography variant="button" fontWeight="medium">
                                {courseModule.title}
                              </MDTypography>
                              <MDTypography variant="caption" color="text" display="block">
                                {courseModule.activities.length} activities
                              </MDTypography>
                            </MDBox>
                            <MDBox display="flex" alignItems="center" gap={0.5}>
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
                                courseModule.activities.map((activity) => (
                                  <MDBox
                                    key={activity.id}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    py={0.75}
                                    borderTop="1px solid #eef0f2"
                                  >
                                    <MDBox minWidth={0}>
                                      <MDTypography variant="caption" fontWeight="medium">
                                        {activity.title}
                                      </MDTypography>
                                      <MDTypography variant="caption" color="text" display="block">
                                        {activity.activity_type} | {activity.points || 0} marks
                                      </MDTypography>
                                    </MDBox>
                                    <MDBox display="flex" alignItems="center" gap={0.25}>
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
                          <Grid item xs={12} md={5}>
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
                          <Grid item xs={12} md={2}>
                            <MDInput
                              label="Position"
                              type="number"
                              fullWidth
                              value={moduleEditForm.position}
                              onChange={(event) =>
                                setModuleEditForm({
                                  ...moduleEditForm,
                                  position: Number(event.target.value || 1),
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
                          <Grid item xs={12} md={5}>
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
                          <Grid item xs={6} md={2}>
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
                          <Grid item xs={6} md={2}>
                            <MDInput
                              label="Position"
                              type="number"
                              fullWidth
                              value={activityEditForm.position}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  position: event.target.value,
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
                        Choose an action from the module list, or add an activity below.
                      </MDTypography>

                      <MDBox mt={3} pt={2} borderTop="1px solid #e5e7eb">
                        <MDTypography variant="button" fontWeight="bold">
                          Add Activity
                        </MDTypography>
                        <Grid container spacing={1.5} mt={0.5}>
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
                          <Grid item xs={12} md={3}>
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
                          <Grid item xs={12} md={3}>
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
                              label="Content or JSON"
                              multiline
                              rows={4}
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
                        <MDBox mt={2}>
                          <MDButton
                            variant="gradient"
                            color="success"
                            disabled={saving || !activityForm.title}
                            onClick={createActivity}
                          >
                            Add Activity
                          </MDButton>
                        </MDBox>
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
        <ActivityManagerDialog
          activity={selectedActivity}
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
