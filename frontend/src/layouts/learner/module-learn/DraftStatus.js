import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

function savedTime(at) {
  const date = at ? new Date(at) : new Date();
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const RESTORED = {
  device: "Restored work from this device that had not reached the server yet.",
  draft: "Your saved work has been loaded.",
  submission: "Your last submitted work has been loaded.",
};

// One line under the editor telling the learner whether their work is safe.
function DraftStatus({ status, onLoadNewest, onKeepMine, onStartOver }) {
  const { state } = status;
  if (state === "idle") return null;

  const line = {
    loading: ["hourglass_empty", "text", "Loading your saved work…"],
    unsaved: ["edit", "text", "Changes not saved yet…"],
    saving: ["cloud_upload", "text", "Saving…"],
    saved: [
      "cloud_done",
      "success",
      status.at ? `All changes saved at ${savedTime(status.at)}` : "All changes saved",
    ],
    restored: ["history", "info", RESTORED[status.source] || RESTORED.draft],
    offline: [
      "cloud_off",
      "warning",
      "Saved on this device only. It will upload when the connection is back.",
    ],
    error: ["error_outline", "error", status.message || "This work could not be saved."],
    conflict: ["sync_problem", "warning", "Newer work was saved from another tab or device."],
  }[state];
  if (!line) return null;
  const [icon, color, text] = line;

  return (
    <MDBox
      mt={1}
      display="flex"
      alignItems="center"
      gap={1}
      flexWrap="wrap"
      role="status"
      aria-live="polite"
    >
      <MDTypography variant="caption" color={color} display="flex" alignItems="center" gap={0.5}>
        <Icon fontSize="small">{icon}</Icon>
        {text}
      </MDTypography>
      {state === "conflict" && (
        <>
          <MDButton size="small" variant="outlined" color="info" onClick={onLoadNewest}>
            Load newest work
          </MDButton>
          <MDButton size="small" variant="text" color="dark" onClick={onKeepMine}>
            Keep this tab&apos;s work
          </MDButton>
        </>
      )}
      {onStartOver && ["saved", "restored"].includes(state) && (
        <MDButton size="small" variant="text" color="secondary" onClick={onStartOver}>
          Start over
        </MDButton>
      )}
    </MDBox>
  );
}

DraftStatus.defaultProps = {
  onStartOver: undefined,
};

DraftStatus.propTypes = {
  status: PropTypes.shape({
    state: PropTypes.string.isRequired,
    at: PropTypes.string,
    source: PropTypes.string,
    message: PropTypes.string,
  }).isRequired,
  onLoadNewest: PropTypes.func.isRequired,
  onKeepMine: PropTypes.func.isRequired,
  onStartOver: PropTypes.func,
};

export default DraftStatus;
