import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useAppPalette } from "lib/appTheme";

// Matches the green/purple split the old bar chart used for the current vs.
// past terms, so the line picks up where that visual language left off.
const CURRENT_COLOR = "#12855b";
const TREND_COLOR = "#7444d6";

// The viewBox is wide and short - like the card it plots into - rather than
// square, so the non-uniform scale that `preserveAspectRatio="none"` applies
// stays close to 1:1 and the point markers don't render as flattened ellipses.
const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 30;

function growthLabel(previous, latest) {
  if (previous == null) return { text: "First term on record", color: "text" };
  if (previous === 0) {
    return latest === 0
      ? { text: "Still no allocations this term", color: "text" }
      : { text: "Up from zero last term", color: "success" };
  }
  const change = Math.round(((latest - previous) / previous) * 100);
  if (change === 0) return { text: "Same as last term", color: "text" };
  return {
    text: `${change > 0 ? "Up" : "Down"} ${Math.abs(change)}% vs last term`,
    color: change > 0 ? "success" : "error",
  };
}

function termLabel(term) {
  return String(term.term).replace(/^Term\s*/i, "T");
}

/**
 * Club growth, term by term: how many course allocations were made each
 * term (the current one plus up to 5 before it), as a line so an upward
 * trend reads as a rising line rather than same-height bars.
 *
 * Allocation counts are used rather than a live headcount because a
 * learner's `term` field moves forward the moment they're promoted - a
 * headcount keyed off that field collapses every past term to whoever
 * hasn't been promoted yet, which is not the size that term actually was.
 */
function AllocationTrend({ terms, loading }) {
  const palette = useAppPalette();
  const [hoverIndex, setHoverIndex] = useState(null);
  const series = terms || [];
  const latest = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;

  const points = useMemo(() => {
    if (series.length < 2) return null;
    const counts = series.map((term) => term.allocation_count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const span = max - min;
    return series.map((term, index) => ({
      // Centered in each term's slot rather than run edge-to-edge, so the
      // points line up with the labels below them.
      x: ((index + 0.5) / series.length) * VIEWBOX_WIDTH,
      // Padded 10-90% of the viewBox height: the line never touches the card
      // edges, and a flat series (min === max) draws as a flat line instead
      // of dividing by zero.
      y:
        span === 0
          ? VIEWBOX_HEIGHT / 2
          : VIEWBOX_HEIGHT * 0.9 - ((term.allocation_count - min) / span) * VIEWBOX_HEIGHT * 0.8,
      term,
    }));
  }, [series]);

  const linePoints = points ? points.map((p) => `${p.x},${p.y}`).join(" ") : "";
  const areaPath = points
    ? `M${points[0].x},${VIEWBOX_HEIGHT} ${points.map((p) => `L${p.x},${p.y}`).join(" ")} L${
        points[points.length - 1].x
      },${VIEWBOX_HEIGHT} Z`
    : "";

  const growth = latest ? growthLabel(previous?.allocation_count, latest.allocation_count) : null;

  return (
    <Card sx={{ height: "100%" }}>
      <MDBox p={1.75}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
          <MDTypography variant="h6" fontWeight="bold">
            Club growth
          </MDTypography>
          <Icon sx={{ color: palette.accentText }} fontSize="small">
            trending_up
          </Icon>
        </MDBox>

        {loading ? (
          <MDTypography variant="caption" color="text">
            Loading term allocations…
          </MDTypography>
        ) : series.length === 0 ? (
          <MDTypography variant="caption" color="text">
            No courses have been allocated in a term yet. The trend appears once your
            first term has an allocation.
          </MDTypography>
        ) : (
          <>
            <MDBox display="flex" alignItems="baseline" gap={1}>
              <MDTypography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                {latest.allocation_count}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                allocation{latest.allocation_count === 1 ? "" : "s"} in {latest.term}{" "}
                {latest.academic_year}
              </MDTypography>
            </MDBox>
            <MDTypography variant="caption" color={growth.color} fontWeight="bold">
              {growth.text}
            </MDTypography>

            {points && (
              <MDBox sx={{ position: "relative", height: 84, mt: 1.25 }}>
                <svg
                  viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                  preserveAspectRatio="none"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                  aria-hidden="true"
                >
                  <path d={areaPath} fill={TREND_COLOR} fillOpacity="0.1" stroke="none" />
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke={TREND_COLOR}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {points.map((p, index) => (
                    <circle
                      key={`${p.term.academic_year}-${p.term.term}-dot`}
                      cx={p.x}
                      cy={p.y}
                      r={p.term.is_current || index === hoverIndex ? 2 : 1.4}
                      fill={p.term.is_current ? CURRENT_COLOR : TREND_COLOR}
                      stroke={palette.surface}
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
                {/* Transparent hit targets, one per term, so hovering or
                    focusing anywhere in that term's column - not just the
                    2px-wide point - surfaces its exact count. */}
                <MDBox sx={{ position: "relative", display: "flex", height: "100%" }}>
                  {points.map((p, index) => (
                    <MDBox
                      key={`${p.term.academic_year}-${p.term.term}-hit`}
                      flex={1}
                      tabIndex={0}
                      title={`${p.term.term} ${p.term.academic_year}: ${p.term.allocation_count} allocation${
                        p.term.allocation_count === 1 ? "" : "s"
                      }`}
                      onMouseEnter={() => setHoverIndex(index)}
                      onMouseLeave={() => setHoverIndex(null)}
                      onFocus={() => setHoverIndex(index)}
                      onBlur={() => setHoverIndex(null)}
                    />
                  ))}
                </MDBox>
              </MDBox>
            )}

            <MDBox display="flex" gap={0.75} mt={points ? 0.5 : 1.25}>
              {series.map((term) => (
                <MDBox key={`${term.academic_year}-${term.term}-label`} flex={1} textAlign="center">
                  <MDTypography
                    variant="caption"
                    sx={{ fontSize: ".62rem", fontWeight: 700, display: "block" }}
                  >
                    {term.allocation_count}
                  </MDTypography>
                  <MDTypography variant="caption" color="text" sx={{ fontSize: ".58rem" }}>
                    {termLabel(term)}
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

AllocationTrend.propTypes = {
  terms: PropTypes.arrayOf(
    PropTypes.shape({
      academic_year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      term: PropTypes.string,
      allocation_count: PropTypes.number,
      is_current: PropTypes.bool,
    })
  ),
  loading: PropTypes.bool,
};

AllocationTrend.defaultProps = { terms: [], loading: false };

export default AllocationTrend;
