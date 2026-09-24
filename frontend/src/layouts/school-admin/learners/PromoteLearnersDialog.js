import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";

import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { promotionTermOptions, suggestedNextTerm } from "lib/promotionTerms";

const learnerCount = (count) => `${count} ${count === 1 ? "learner" : "learners"}`;

/**
 * Moves learners into their next term and, if wanted, their next grade.
 *
 * The question that matters comes first and is required: which term they are
 * moving to. It is one dropdown of the terms that exist - the year is part of each
 * option - and it starts on the term after the current one. Below it the dialog
 * says how many learners will move before anything is done, because leaving the
 * grade and class alone means everyone at the school.
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
  const [learnerId, setLearnerId] = useState("");
  const [grade, setGrade] = useState("");
  const [stream, setStream] = useState("");
  const [nextGrade, setNextGrade] = useState("");

  const chosenTerm = options.find((option) => option.value === termValue) || null;

  // Someone who has graduated has left the school, and is never moved on.
  const moving = learners.filter(
    (learner) =>
      learner.graduation_status !== "graduated" &&
      (learnerId
        ? String(learner.id) === learnerId
        : (!grade || learner.grade === grade) && (!stream || learner.stream === stream))
  );

  const confirm = () =>
    onConfirm({
      ...(learnerId
        ? { learner_ids: [Number(learnerId)] }
        : { grade: grade || undefined, stream: stream || undefined }),
      next_term: chosenTerm.name,
      academic_year: chosenTerm.academicYear,
      ...(nextGrade ? { next_grade: nextGrade } : {}),
    });

  const where = [grade, stream && `class ${stream}`].filter(Boolean).join(", ");
  const who = learnerId
    ? moving[0]?.full_name || "The chosen learner"
    : `${learnerCount(moving.length)} ${where ? `in ${where}` : "across the school"}`;

  const summary = chosenTerm
    ? `${who} will move to ${chosenTerm.label}${nextGrade ? ` and ${nextGrade}` : ""}.`
    : "Choose the term they are moving to.";

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Graduate learners to the next term</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <MDTypography variant="button" fontWeight="bold" display="block" mb={1}>
              1. Which term are they moving to?
            </MDTypography>
            <MDInput
              select
              label="Next term"
              fullWidth
              value={termValue}
              onChange={(event) => setTermValue(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
              disabled={options.length === 0}
              helperText={chosenTerm ? chosenTerm.dates : ""}
            >
              <option value="">Choose a term</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </MDInput>
            {options.length === 0 && (
              <MDTypography variant="caption" color="error" display="block" mt={1}>
                No current or upcoming term is set up. Add the next term under Academic Years and
                Terms, then come back.
              </MDTypography>
            )}
          </Grid>

          <Grid item xs={12}>
            <MDTypography variant="button" fontWeight="bold" display="block" mb={1}>
              2. Who is moving?
            </MDTypography>
          </Grid>
          <Grid item xs={12}>
            <MDInput
              select
              label="Learners"
              fullWidth
              value={learnerId}
              onChange={(event) => setLearnerId(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
            >
              <option value="">Everyone in the grade and class chosen below</option>
              {learners
                .filter((learner) => learner.graduation_status !== "graduated")
                .map((learner) => (
                  <option key={learner.id} value={learner.id}>
                    {learner.full_name} - {learner.grade || "No grade"}
                    {learner.stream ? ` (${learner.stream})` : ""}
                  </option>
                ))}
            </MDInput>
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              select
              label="Grade"
              fullWidth
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
              disabled={Boolean(learnerId)}
            >
              <option value="">Any grade</option>
              {grades.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </MDInput>
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              select
              label="Class / stream"
              fullWidth
              value={stream}
              onChange={(event) => setStream(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
              disabled={Boolean(learnerId)}
            >
              <option value="">Any class</option>
              {streams.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </MDInput>
          </Grid>

          <Grid item xs={12}>
            <MDTypography variant="button" fontWeight="bold" display="block" mb={1}>
              3. Move up a grade as well? (optional)
            </MDTypography>
            <MDInput
              select
              label="Next grade"
              fullWidth
              value={nextGrade}
              onChange={(event) => setNextGrade(event.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
            >
              <option value="">Keep their current grade</option>
              {grades.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </MDInput>
          </Grid>

          <Grid item xs={12}>
            <MDTypography variant="body2" fontWeight="medium" data-testid="promotion-summary">
              {summary}
            </MDTypography>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mt={1}>
                {error}
              </MDTypography>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="text" color="secondary" onClick={onClose}>
          Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="success"
          onClick={confirm}
          disabled={saving || !chosenTerm || moving.length === 0}
        >
          {saving ? "Moving..." : `Graduate ${learnerCount(moving.length)}`}
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
