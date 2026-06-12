import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";

import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { resourceHtml } from "./authoringUtils";

function ResourceDialog({ open, initialType, initialValues, onClose, onSave }) {
  const [type, setType] = useState(initialType);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setUrl(initialValues?.url || "");
    setLabel(initialValues?.label || "");
    setAlt(initialValues?.alt || "");
    setError("");
  }, [open, initialType, initialValues]);

  const save = () => {
    try {
      onSave(resourceHtml({ type, url, label, alt }));
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Insert resource</DialogTitle>
      <DialogContent>
        <MDInput
          select
          label="Resource type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          fullWidth
          sx={{ mt: 1, mb: 2 }}
        >
          <MenuItem value="link">Text link</MenuItem>
          <MenuItem value="image">Online image</MenuItem>
          <MenuItem value="resource">Video or external resource</MenuItem>
        </MDInput>
        <MDInput
          label={type === "image" ? "Image URL" : "Web address"}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
        {type === "image" ? (
          <MDInput
            label="Image description"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            fullWidth
          />
        ) : (
          <MDInput
            label="Link text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={type === "link" ? "Open link" : "Open video or resource"}
            fullWidth
          />
        )}
        {error && (
          <MDTypography color="error" variant="caption" display="block" mt={1}>
            {error}
          </MDTypography>
        )}
      </DialogContent>
      <DialogActions>
        <MDButton color="secondary" onClick={onClose}>
          Cancel
        </MDButton>
        <MDButton color="info" onClick={save}>
          Insert
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

ResourceDialog.defaultProps = {
  initialType: "link",
  initialValues: null,
};

ResourceDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  initialType: PropTypes.oneOf(["link", "image", "resource"]),
  initialValues: PropTypes.shape({
    url: PropTypes.string,
    label: PropTypes.string,
    alt: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default ResourceDialog;
