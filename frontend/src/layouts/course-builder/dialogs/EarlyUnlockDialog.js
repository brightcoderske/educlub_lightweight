import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { apiClient } from "lib/api";
import { buildEarlyUnlockPayload } from "./authoringUtils";

function EarlyUnlockDialog({ open, courseId, courseModule, activity, onClose, onSaved }) {
  const [learners, setLearners] = useState([]);
  const [scopeType, setScopeType] = useState("learner");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setScopeType("learner");
    setSelectedIds([]);
    setSearch("");
    setGrade("");
    setStream("");
    setReason("");
    setError("");
    setLoading(true);
    apiClient
      .get("/learners")
      .then((response) => setLearners(Array.isArray(response) ? response : response.learners || []))
      .catch((loadError) => setError(loadError.message || "Could not load learners."))
      .finally(() => setLoading(false));
  }, [open]);

  const filteredLearners = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return learners;
    return learners.filter((learner) =>
      [learner.full_name, learner.username, learner.grade, learner.stream]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [learners, search]);

  const toggleLearner = (learnerId) => {
    if (scopeType === "learner") {
      setSelectedIds([learnerId]);
      return;
    }
    setSelectedIds((current) =>
      current.includes(learnerId)
        ? current.filter((id) => id !== learnerId)
        : [...current, learnerId]
    );
  };

  const save = async () => {
    setError("");
    try {
      const payload = buildEarlyUnlockPayload({
        scopeType,
        learnerIds: selectedIds,
        moduleId: courseModule?.id,
        activityId: activity?.id,
        grade,
        stream,
        reason,
      });
      setSaving(true);
      await apiClient.post(`/courses/${courseId}/availability-overrides`, payload);
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Could not save the early unlock.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Early unlock: {activity?.title || courseModule?.title || "course content"}
      </DialogTitle>
      <DialogContent>
        <MDInput
          select
          label="Unlock for"
          value={scopeType}
          onChange={(event) => {
            setScopeType(event.target.value);
            setSelectedIds([]);
          }}
          fullWidth
          sx={{ mt: 1, mb: 2 }}
        >
          <MenuItem value="learner">One learner</MenuItem>
          <MenuItem value="learners">Selected learners</MenuItem>
          <MenuItem value="class">Class or stream</MenuItem>
        </MDInput>

        {scopeType === "class" ? (
          <MDBox display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={2}>
            <MDInput
              label="Grade (optional)"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              fullWidth
            />
            <MDInput
              label="Stream (optional)"
              value={stream}
              onChange={(event) => setStream(event.target.value)}
              fullWidth
            />
          </MDBox>
        ) : (
          <>
            <MDInput
              label="Find learner by name or username"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              sx={{ mb: 1 }}
            />
            <MDBox
              sx={{
                maxHeight: 260,
                overflowY: "auto",
                border: "1px solid #d1d5db",
                borderRadius: 1,
              }}
            >
              {loading && (
                <MDTypography variant="body2" color="text" p={2}>
                  Loading learners...
                </MDTypography>
              )}
              {!loading &&
                filteredLearners.map((learner) => (
                  <MDBox
                    key={learner.id}
                    display="flex"
                    alignItems="center"
                    px={1}
                    py={0.5}
                    sx={{ borderBottom: "1px solid #eef2f7", cursor: "pointer" }}
                    onClick={() => toggleLearner(learner.id)}
                  >
                    <Checkbox checked={selectedIds.includes(learner.id)} />
                    <MDBox>
                      <MDTypography variant="button">{learner.full_name}</MDTypography>
                      <MDTypography variant="caption" color="text" display="block">
                        {[learner.username, learner.grade, learner.stream]
                          .filter(Boolean)
                          .join(" | ")}
                      </MDTypography>
                    </MDBox>
                  </MDBox>
                ))}
              {!loading && filteredLearners.length === 0 && (
                <MDTypography variant="body2" color="text" p={2}>
                  No learners match this search.
                </MDTypography>
              )}
            </MDBox>
          </>
        )}

        <MDInput
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={2}
          fullWidth
          sx={{ mt: 2 }}
        />
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
        <MDButton color="info" onClick={save} disabled={saving || loading}>
          {saving ? "Saving..." : "Save unlock"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

EarlyUnlockDialog.defaultProps = {
  courseModule: null,
  activity: null,
};

EarlyUnlockDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  courseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  courseModule: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
  }),
  activity: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default EarlyUnlockDialog;
