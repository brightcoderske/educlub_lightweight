import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { promotionTermOptions, suggestedNextTerm } from "lib/promotionTerms";

const learnerCount = (count) => `${count} ${count === 1 ? "learner" : "learners"}`;
const gradeNumber = (grade) => Number(String(grade || "").match(/\d+/)?.[0] || 99);
const byClassThenName = (a, b) =>
  gradeNumber(a.grade) - gradeNumber(b.grade) ||
  String(a.stream || "").localeCompare(String(b.stream || "")) ||
  String(a.full_name || "").localeCompare(String(b.full_name || ""));

/**
 * Moves the ticked learners into a next term, a next class, or both.
 *
 * Where they go comes first: a term (the term after the current one to start
 * with) and a class - kept, each moved up one grade from their own, or one grade
 * for everyone. Who goes is a ticked list. The search, grade and class filters
 * only change what is shown: ticks stay as the filters change, so learners from
 * several classes can be gathered before moving them together, and the count
 * says how many are ticked, including any the filters are hiding.
 */
function PromoteLearnersDialog({
  learners,
  grades,
  streams,
  academicTerms,
  saving,
  error,
  onConfirm,
  onClose,
}) {
  const options = useMemo(() => promotionTermOptions(academicTerms), [academicTerms]);
  const [termValue, setTermValue] = useState(() => suggestedNextTerm(options)?.value || "");
  const [classMove, setClassMove] = useState("keep");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [ticked, setTicked] = useState(() => new Set());

  const chosenTerm = options.find((option) => option.value === termValue) || null;

  // Someone who has graduated has left the school, and is never moved on.
  const movable = useMemo(
    () =>
      learners.filter((learner) => learner.graduation_status !== "graduated").sort(byClassThenName),
    [learners]
  );
  const shown = movable.filter(
    (learner) =>
      (!grade || learner.grade === grade) &&
      (!stream || learner.stream === stream) &&
      (!search.trim() ||
        String(learner.full_name || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase()))
  );
  const tickedShown = shown.filter((learner) => ticked.has(learner.id)).length;
  const tickedHidden = ticked.size - tickedShown;

  const toggle = (id) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const tickShown = (on) =>
    setTicked((current) => {
      const next = new Set(current);
      shown.forEach((learner) => (on ? next.add(learner.id) : next.delete(learner.id)));
      return next;
    });

  const nothingChanges = !chosenTerm && classMove === "keep";
  const confirm = () =>
    onConfirm({
      learner_ids: movable.filter((learner) => ticked.has(learner.id)).map((learner) => learner.id),
      ...(chosenTerm ? { next_term: chosenTerm.name, academic_year: chosenTerm.academicYear } : {}),
      ...(classMove !== "keep" ? { next_grade: classMove } : {}),
    });

  let destination = `move to ${[chosenTerm?.label, classMove !== "keep" && classMove]
    .filter(Boolean)
    .join(" and ")}`;
  if (classMove === "up") {
    destination = chosenTerm
      ? `move to ${chosenTerm.label} and each up one grade`
      : "each move up one grade";
  }
  let summary = `${learnerCount(ticked.size)} ticked will ${destination}.`;
  if (nothingChanges) summary = "Choose a term, a class, or both.";
  else if (ticked.size === 0) summary = "Tick the learners who are moving.";

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Move learners to the next term or class</DialogTitle>
      <DialogContent dividers>
        <MDTypography variant="button" fontWeight="bold" display="block" mb={1}>
          1. Where are they moving?
        </MDTypography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <MDInput
              select
              label="Next term"
              fullWidth
              value={termValue}
              onChange={(event) => setTermValue(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
              helperText={chosenTerm ? chosenTerm.dates : "Their term stays as it is."}
            >
              <option value="">Keep their current term</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MDInput>
            {options.length === 0 && (
              <MDTypography variant="caption" color="error" display="block" mt={1}>
                No current or upcoming term is set up. Add the next term under Academic Years and
                Terms to move learners into it.
              </MDTypography>
            )}
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              select
              label="Next class"
              fullWidth
              value={classMove}
              onChange={(event) => setClassMove(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
              helperText={
                classMove === "up" ? "Grade 5 goes to Grade 6, and so on. Grade 12 stays." : " "
              }
            >
              <option value="keep">Keep their current class</option>
              <option value="up">Each up one grade</option>
              {grades.map((item) => (
                <option key={item} value={item}>
                  Everyone to {item}
                </option>
              ))}
            </MDInput>
          </Grid>
        </Grid>

        <MDTypography variant="button" fontWeight="bold" display="block" mt={2} mb={1}>
          2. Who is moving?
        </MDTypography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <MDInput
              label="Search name"
              fullWidth
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <MDInput
              select
              label="Grade"
              fullWidth
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
            >
              <option value="">All grades</option>
              {grades.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </MDInput>
          </Grid>
          <Grid item xs={6} sm={4}>
            <MDInput
              select
              label="Class / stream"
              fullWidth
              value={stream}
              onChange={(event) => setStream(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
            >
              <option value="">All classes</option>
              {streams.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </MDInput>
          </Grid>
        </Grid>

        <MDBox
          mt={1.5}
          border="1px solid #e2e8f0"
          borderRadius="lg"
          sx={{ maxHeight: 340, overflowY: "auto" }}
        >
          <MDBox
            display="flex"
            alignItems="center"
            px={1}
            py={0.5}
            sx={{ position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}
            borderBottom="1px solid #e2e8f0"
          >
            <Checkbox
              inputProps={{ "aria-label": "Tick everyone shown" }}
              checked={shown.length > 0 && tickedShown === shown.length}
              indeterminate={tickedShown > 0 && tickedShown < shown.length}
              disabled={shown.length === 0}
              onChange={(event) => tickShown(event.target.checked)}
            />
            <MDTypography variant="caption" fontWeight="bold">
              {shown.length === movable.length
                ? `All ${learnerCount(shown.length)}`
                : `${learnerCount(shown.length)} shown`}
            </MDTypography>
          </MDBox>
          {shown.map((learner) => (
            <MDBox
              key={learner.id}
              component="label"
              display="flex"
              alignItems="center"
              px={1}
              sx={{ cursor: "pointer", "&:hover": { bgcolor: "rgba(120,120,160,.06)" } }}
            >
              <Checkbox
                inputProps={{ "aria-label": learner.full_name }}
                checked={ticked.has(learner.id)}
                onChange={() => toggle(learner.id)}
              />
              <MDTypography variant="button" fontWeight="medium" sx={{ flex: 1, minWidth: 0 }}>
                {learner.full_name}
              </MDTypography>
              <MDTypography variant="caption" color="text" sx={{ flexShrink: 0, pl: 1 }}>
                {learner.grade || "No grade"}
                {learner.stream ? ` · ${learner.stream}` : ""}
              </MDTypography>
            </MDBox>
          ))}
          {shown.length === 0 && (
            <MDTypography variant="caption" color="text" display="block" p={2}>
              No learners match these filters.
            </MDTypography>
          )}
        </MDBox>

        <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap" mt={1.5}>
          <MDTypography variant="body2" fontWeight="medium" data-testid="promotion-summary">
            {summary}
          </MDTypography>
          {tickedHidden > 0 && (
            <MDTypography variant="caption" color="text" data-testid="promotion-hidden">
              ({tickedHidden} not shown by the filters)
            </MDTypography>
          )}
          {ticked.size > 0 && (
            <MDButton
              variant="text"
              color="secondary"
              size="small"
              onClick={() => setTicked(new Set())}
            >
              Clear ticks
            </MDButton>
          )}
        </MDBox>
        {error && (
          <MDTypography variant="caption" color="error" display="block" mt={1}>
            {error}
          </MDTypography>
        )}
      </DialogContent>
      <DialogActions>
        <MDButton variant="text" color="secondary" onClick={onClose}>
          Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="success"
          onClick={confirm}
          disabled={saving || ticked.size === 0 || nothingChanges}
        >
          {saving ? "Moving..." : `Move ${learnerCount(ticked.size)}`}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

PromoteLearnersDialog.propTypes = {
  learners: PropTypes.arrayOf(PropTypes.object).isRequired,
  grades: PropTypes.arrayOf(PropTypes.string).isRequired,
  streams: PropTypes.arrayOf(PropTypes.string).isRequired,
  academicTerms: PropTypes.arrayOf(PropTypes.object).isRequired,
  saving: PropTypes.bool,
  error: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

PromoteLearnersDialog.defaultProps = { saving: false, error: "" };

export default PromoteLearnersDialog;
