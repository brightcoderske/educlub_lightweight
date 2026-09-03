import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useAppPalette } from "lib/appTheme";

function changeLabel(first, latest) {
  if (first === 0) return latest === 0 ? "No learners enrolled yet" : "First learners enrolled";
  const change = Math.round(((latest - first) / first) * 100);
  if (change === 0) return "Same size as when you started";
  return `${change > 0 ? "Up" : "Down"} ${Math.abs(change)}% since your first term`;
}

/**
 * The school roll, term by term. It answers one question a teacher actually
 * asks - "are we growing?" - so the first and current terms are called out in
 * words, and the bars are there to show the shape between them.
 */
function PopulationTrend({ population, loading }) {
  const palette = useAppPalette();
  const terms = population || [];
  const latest = terms[terms.length - 1];
  const first = terms[0];
  const peak = terms.reduce((highest, term) => Math.max(highest, term.learner_count), 0);

  return (
    <Card sx={{ height: "100%" }}>
      <MDBox p={1.75}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
          <MDTypography variant="h6" fontWeight="bold">
            School population
          </MDTypography>
          <Icon sx={{ color: palette.accentText }} fontSize="small">
            trending_up
          </Icon>
        </MDBox>

        {loading ? (
          <MDTypography variant="caption" color="text">
            Loading the roll…
          </MDTypography>
        ) : terms.length === 0 ? (
          <MDTypography variant="caption" color="text">
            No learners have been enrolled in a term yet. The trend appears once your first term has
            a roll.
          </MDTypography>
        ) : (
          <>
            <MDBox display="flex" alignItems="baseline" gap={1}>
              <MDTypography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                {latest.learner_count}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                enrolled in {latest.term} {latest.academic_year}
              </MDTypography>
            </MDBox>
            <MDTypography variant="caption" sx={{ color: palette.accentText, fontWeight: 700 }}>
              {changeLabel(first.learner_count, latest.learner_count)}
            </MDTypography>

            <MDBox
              display="flex"
              alignItems="flex-end"
              gap={0.75}
              mt={1.25}
              sx={{ height: 84, overflowX: "auto" }}
            >
              {terms.map((term) => (
                <MDBox
                  key={`${term.academic_year}-${term.term}`}
                  title={`${term.term} ${term.academic_year}: ${term.learner_count} learners`}
                  sx={{
                    minWidth: 30,
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  <MDTypography variant="caption" sx={{ fontSize: ".62rem", fontWeight: 700 }}>
                    {term.learner_count}
                  </MDTypography>
                  <MDBox
                    sx={{
                      width: "min(100%, 22px)",
                      minHeight: 3,
                      // Scaled against the busiest term so the shape is visible
                      // whether the school has 12 learners or 1,200.
                      height: `${peak ? (term.learner_count / peak) * 46 : 3}px`,
                      borderRadius: "5px 5px 2px 2px",
                      background: term.is_current
                        ? "linear-gradient(#7fd8a6,#12855b)"
                        : "linear-gradient(#b18aef,#7444d6)",
                    }}
                  />
                  <MDTypography
                    variant="caption"
                    color="text"
                    sx={{ fontSize: ".58rem", mt: 0.25, whiteSpace: "nowrap" }}
                  >
                    {String(term.term).replace(/^Term\s*/i, "T")}
                  </MDTypography>
                </MDBox>
              ))}
            </MDBox>
          </>
        )}
      </MDBox>
    </Card>
  );
}

PopulationTrend.propTypes = {
  population: PropTypes.arrayOf(
    PropTypes.shape({
      academic_year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      term: PropTypes.string,
      learner_count: PropTypes.number,
      is_current: PropTypes.bool,
    })
  ),
  loading: PropTypes.bool,
};

PopulationTrend.defaultProps = { population: [], loading: false };

export default PopulationTrend;
