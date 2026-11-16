import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderText } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

const LINE_HEIGHT_PX = 20;

// Python is taught with four-space indents; the web languages with two, which
// is what the starter code in every course uses.
const LANGUAGES = {
  python: { extension: python, indent: "    " },
  html: { extension: html, indent: "  " },
  css: { extension: css, indent: "  " },
  javascript: { extension: javascript, indent: "  " },
};

function languageExtensions(language) {
  const setup = LANGUAGES[language] || LANGUAGES.python;
  return [
    setup.extension(),
    indentUnit.of(setup.indent),
    EditorState.tabSize.of(setup.indent.length),
  ];
}

// A code editor that behaves like VS Code: Enter keeps the indent and adds a
// level after `:` or `{`, Tab and Shift+Tab indent, brackets and quotes close
// themselves, Ctrl+/ comments, Ctrl+F searches. Escape then Tab moves focus on,
// so the editor is never a keyboard trap.
function CodeEditor({ value, onChange, language, label, placeholder, rows, readOnly }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const languageRef = useRef(new Compartment());
  const readOnlyRef = useRef(new Compartment());

  onChangeRef.current = onChange;

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value || "",
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          languageRef.current.of(languageExtensions(language)),
          readOnlyRef.current.of(EditorState.readOnly.of(Boolean(readOnly))),
          oneDark,
          placeholder ? placeholderText(placeholder) : [],
          EditorView.contentAttributes.of({ "aria-label": label || "Code editor" }),
          EditorView.theme({
            "&": { fontSize: "14px", borderRadius: "8px" },
            ".cm-scroller": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              lineHeight: `${LINE_HEIGHT_PX}px`,
              minHeight: `${rows * LINE_HEIGHT_PX}px`,
              maxHeight: "70vh",
            },
            "&.cm-focused": { outline: "2px solid #60a5fa" },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // The parent replaces the code when the learner moves to another activity or
  // their saved work is restored. Typing round-trips through here too, and is
  // skipped because the document already matches.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = value || "";
    if (view.state.doc.toString() === next) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: languageRef.current.reconfigure(languageExtensions(language)),
    });
  }, [language]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyRef.current.reconfigure(EditorState.readOnly.of(Boolean(readOnly))),
    });
  }, [readOnly]);

  return (
    <MDBox>
      {label && (
        <MDTypography variant="caption" fontWeight="medium" color="text" display="block" mb={0.5}>
          {label}
        </MDTypography>
      )}
      <MDBox
        ref={hostRef}
        sx={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #1e293b" }}
      />
    </MDBox>
  );
}

CodeEditor.defaultProps = {
  value: "",
  onChange: undefined,
  language: "python",
  label: "",
  placeholder: "",
  rows: 12,
  readOnly: false,
};

CodeEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  language: PropTypes.oneOf(Object.keys(LANGUAGES)),
  label: PropTypes.string,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  readOnly: PropTypes.bool,
};

export default CodeEditor;
