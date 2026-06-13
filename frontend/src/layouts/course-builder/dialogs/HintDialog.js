import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import { hintBlockHtml } from "./authoringUtils";

function HintDialog({ initialValues, onClose, onSave, open }) {
  const [title, setTitle] = useState("Need a hint?");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initialValues?.title || "Need a hint?");
    setBody(initialValues?.body || "");
  }, [initialValues, open]);

  const save = () => {
    if (!body.trim()) return;
    onSave(hintBlockHtml({ title: title.trim() || "Need a hint?", body: body.trim() }));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Insert Hint</DialogTitle>
      <DialogContent>
        <MDInput
          label="Hint title"
          fullWidth
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          sx={{ mt: 1, mb: 2 }}
        />
        <MDInput
          label="Hint content"
          fullWidth
          multiline
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="dark" onClick={onClose}>
          Cancel
        </MDButton>
        <MDButton variant="gradient" color="warning" disabled={!body.trim()} onClick={save}>
          Save Hint
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

HintDialog.propTypes = {
  initialValues: PropTypes.shape({
    body: PropTypes.string,
    title: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};

HintDialog.defaultProps = {
  initialValues: null,
};

export default HintDialog;
