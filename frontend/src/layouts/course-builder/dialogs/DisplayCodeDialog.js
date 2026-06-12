import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";

import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import { displayCodeBlockHtml } from "./authoringUtils";

const languages = ["text", "html", "css", "javascript", "python", "java", "c", "cpp", "sql"];

function DisplayCodeDialog({ open, initialValues, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("text");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initialValues?.title || "");
    setLanguage(initialValues?.language || "text");
    setCode(initialValues?.code || "");
  }, [open, initialValues]);

  const save = () => {
    onSave(displayCodeBlockHtml({ title, language, code }));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Insert code example</DialogTitle>
      <DialogContent>
        <MDInput
          label="Optional title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          fullWidth
          sx={{ mt: 1, mb: 2 }}
        />
        <MDInput
          select
          label="Language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        >
          {languages.map((item) => (
            <MenuItem key={item} value={item}>
              {item.toUpperCase()}
            </MenuItem>
          ))}
        </MDInput>
        <MDInput
          multiline
          minRows={12}
          label="Code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          fullWidth
          sx={{ "& textarea": { fontFamily: "Courier New, monospace" } }}
        />
      </DialogContent>
      <DialogActions>
        <MDButton color="secondary" onClick={onClose}>
          Cancel
        </MDButton>
        <MDButton color="info" onClick={save} disabled={!code.trim()}>
          Save block
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

DisplayCodeDialog.defaultProps = {
  initialValues: null,
};

DisplayCodeDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  initialValues: PropTypes.shape({
    title: PropTypes.string,
    language: PropTypes.string,
    code: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default DisplayCodeDialog;
