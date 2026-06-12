import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { executableBlockHtml, splitExecutableSource } from "./authoringUtils";

const starterSource = `<style>
h2 { color: teal; }
</style>

<h2>Hello learner</h2>

<script>
console.log("Ready");
</script>`;

function previewDocument(source) {
  const { html, css, js } = splitExecutableSource(source);
  return `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
}

function ExecutableCodeDialog({ open, initialValues, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState(starterSource);
  const [showPreview, setShowPreview] = useState(false);
  const preview = useMemo(() => previewDocument(source), [source]);

  useEffect(() => {
    if (!open) return;
    setTitle(initialValues?.title || "Executable web code");
    setSource(initialValues?.source || starterSource);
    setShowPreview(false);
  }, [open, initialValues]);

  const save = () => {
    onSave(executableBlockHtml({ source, title }));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Executable HTML, CSS and JavaScript</DialogTitle>
      <DialogContent>
        <MDInput
          label="Block title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          fullWidth
          sx={{ mt: 1, mb: 2 }}
        />
        <Grid container spacing={2}>
          <Grid item xs={12} md={showPreview ? 7 : 12}>
            <MDTypography variant="caption" color="text">
              Keep HTML, CSS in &lt;style&gt;, and JavaScript in &lt;script&gt; together.
            </MDTypography>
            <MDInput
              multiline
              minRows={16}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              fullWidth
              sx={{
                mt: 1,
                "& textarea": {
                  fontFamily: "Courier New, monospace",
                  bgcolor: "#111827",
                  color: "#e5e7eb",
                  p: 1.5,
                },
              }}
            />
          </Grid>
          {showPreview && (
            <Grid item xs={12} md={5}>
              <MDTypography variant="caption" color="text">
                Browser preview
              </MDTypography>
              <MDBox
                component="iframe"
                title="Executable code preview"
                sandbox="allow-scripts"
                srcDoc={preview}
                width="100%"
                height="390px"
                mt={1}
                sx={{ border: "1px solid #d1d5db", bgcolor: "#ffffff" }}
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton color="secondary" onClick={onClose}>
          Cancel
        </MDButton>
        <MDButton color="dark" onClick={() => setShowPreview((current) => !current)}>
          {showPreview ? "Hide preview" : "Run preview"}
        </MDButton>
        <MDButton color="info" onClick={save} disabled={!source.trim()}>
          Save block
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

ExecutableCodeDialog.defaultProps = {
  initialValues: null,
};

ExecutableCodeDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  initialValues: PropTypes.shape({
    title: PropTypes.string,
    source: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default ExecutableCodeDialog;
