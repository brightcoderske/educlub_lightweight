import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import { interactiveBlockHtml } from "./authoringUtils";

function InteractiveBlockDialog({ initialValues, onClose, onSave, open }) {
  const [type, setType] = useState("flash_card");
  const [title, setTitle] = useState("Try this");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(initialValues?.type || "flash_card");
    setTitle(initialValues?.title || "Try this");
    setPrompt(initialValues?.prompt || "");
    setAnswer(initialValues?.answer || "");
  }, [initialValues, open]);

  const save = () => {
    if (!prompt.trim() || !answer.trim()) return;
    onSave(
      interactiveBlockHtml({
        type,
        title: title.trim() || "Try this",
        prompt: prompt.trim(),
        answer: answer.trim(),
      })
    );
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Insert Interactive Learning Block</DialogTitle>
      <DialogContent>
        <MDInput
          select
          label="Block type"
          fullWidth
          value={type}
          onChange={(event) => setType(event.target.value)}
          SelectProps={{ native: true }}
          sx={{ mt: 1, mb: 2 }}
        >
          <option value="flash_card">Flash card</option>
          <option value="reveal">Click to reveal</option>
          <option value="self_check">Ungraded lesson question</option>
        </MDInput>
        <MDInput
          label="Title"
          fullWidth
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          sx={{ mb: 2 }}
        />
        <MDInput
          label={type === "self_check" ? "Question" : "Front or prompt"}
          fullWidth
          multiline
          rows={3}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          sx={{ mb: 2 }}
        />
        <MDInput
          label={type === "reveal" ? "Revealed content" : "Answer"}
          fullWidth
          multiline
          rows={4}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="dark" onClick={onClose}>
          Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          disabled={!prompt.trim() || !answer.trim()}
          onClick={save}
        >
          Save Block
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

InteractiveBlockDialog.propTypes = {
  initialValues: PropTypes.shape({
    answer: PropTypes.string,
    prompt: PropTypes.string,
    title: PropTypes.string,
    type: PropTypes.oneOf(["flash_card", "reveal", "self_check"]),
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};

InteractiveBlockDialog.defaultProps = {
  initialValues: null,
};

export default InteractiveBlockDialog;
