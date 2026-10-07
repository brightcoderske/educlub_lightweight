import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import { apiClient } from "lib/api";
import { useAppPalette } from "lib/appTheme";

const WARNING = "#c77700";

function placement(learner) {
  if (!learner.term) return "no term set";
  return `still in ${learner.term}${learner.academic_year ? ` ${learner.academic_year}` : ""}`;
}

/**
 * Bulk allocation leaves out learners who are not in the term being allocated:
 * they have not been promoted, so the roll still has them in an earlier term.
 * This names them and, for someone allowed to promote, lets them tick who to
 * move into the term now - each one, or all at once - and then runs the
 * allocation again through `onPromoted`, so the course reaches them too.
 */
function NotInTermNotice({ learners, term, academicYear, canPromote, onPromoted }) {
  const palette = useAppPalette();
  const [selected, setSelected] = useState([]);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState("");

  // A new allocation brings a new list; ticks from the last one do not carry over.
  useEffect(() => {
    setSelected([]);
    setError("");
  }, [learners]);

  if (!learners?.length) return null;

  const termName = `${term} ${academicYear}`;
  const allSelected = selected.length === learners.length;
  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  const promote = async () => {
    setPromoting(true);
    setError("");
    try {
      await apiClient.post("/learners/promote", {
        learner_ids: selected,
        next_term: term,
        academic_year: academicYear,
      });
      await onPromoted();
    } catch (err) {
      setError(err.message || "Could not promote the selected learners.");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <MDBox
      role="status"
      mt={2}
      p={1.5}
      sx={{
        bgcolor: palette.surfaceMuted,
        border: `1px solid ${palette.border}`,
        borderLeft: `4px solid ${WARNING}`,
        borderRadius: "10px",
      }}
    >
      <MDTypography variant="button" fontWeight="bold" display="block" sx={{ color: palette.text }}>
        {learners.length === 1
          ? `1 learner is not in ${termName} yet`
          : `${learners.length} learners are not in ${termName} yet`}
      </MDTypography>
      <MDTypography variant="caption" display="block" mb={1} sx={{ color: palette.textMuted }}>
        {canPromote
          ? `They were not promoted, so this allocation left them out. Tick who to move into ${termName} now and they will get the course too.`
          : "They were not promoted, so this allocation left them out. Ask your school admin to promote them, then allocate again."}
      </MDTypography>

      {canPromote && (
        <FormControlLabel
          sx={{ ml: 0, mb: 0.5 }}
          control={
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              onChange={() => setSelected(allSelected ? [] : learners.map((learner) => learner.id))}
            />
          }
          label={
            <MDTypography variant="caption" fontWeight="bold" sx={{ color: palette.text }}>
              Select all
            </MDTypography>
          }
        />
      )}

      <MDBox
        component="ul"
        sx={{ listStyle: "none", m: 0, p: 0, maxHeight: 240, overflowY: "auto" }}
      >
        {learners.map((learner) => {
          const details = (
            <MDTypography variant="caption" sx={{ color: palette.text }}>
              {learner.full_name}
              <MDTypography component="span" variant="caption" sx={{ color: palette.textMuted }}>
                {" "}
                {learner.stream ? `(${learner.stream}) ` : ""}- {placement(learner)}
              </MDTypography>
            </MDTypography>
          );
          return (
            <MDBox component="li" key={learner.id}>
              {canPromote ? (
                <FormControlLabel
                  sx={{ ml: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={selected.includes(learner.id)}
                      onChange={() => toggle(learner.id)}
                    />
                  }
                  label={details}
                />
              ) : (
                <MDBox py={0.25}>{details}</MDBox>
              )}
            </MDBox>
          );
        })}
      </MDBox>

      {error && (
        <MDTypography variant="caption" color="error" display="block" mt={1}>
          {error}
        </MDTypography>
      )}
      {canPromote && (
        <MDBox mt={1}>
          <MDButton
            variant="gradient"
            color="warning"
            size="small"
            disabled={promoting || selected.length === 0}
            onClick={promote}
          >
            {promoting ? "Promoting…" : `Promote ${selected.length} to ${termName} and allocate`}
          </MDButton>
        </MDBox>
      )}
    </MDBox>
  );
}

NotInTermNotice.propTypes = {
  learners: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      full_name: PropTypes.string,
      stream: PropTypes.string,
      term: PropTypes.string,
      academic_year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    })
  ),
  term: PropTypes.string.isRequired,
  academicYear: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  canPromote: PropTypes.bool,
  onPromoted: PropTypes.func,
};

NotInTermNotice.defaultProps = {
  learners: [],
  canPromote: false,
  onPromoted: () => {},
};

export default NotInTermNotice;
