import PropTypes from "prop-types";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { similarLearners } from "lib/similarLearners";

const placement = (learner) =>
  `${learner.grade || "No grade"}${learner.stream ? ` ${learner.stream}` : ""}${
    learner.graduation_status === "graduated" ? " (graduated)" : ""
  }`;

const CLASS_LIST_LIMIT = 20;

/**
 * Shown in Add Learner, so a learner already at the school is not added again.
 *
 * Once a name is being typed it lists the school's learners with similar names
 * and their class. Before any name, once a grade is picked, it lists who is
 * already in that class. Either way it only informs: Add Learner still works,
 * because two learners can share a name.
 */
function LearnerNameCheck({ learners, form }) {
  const similar = similarLearners(learners, [form.first_name, form.second_name, form.third_name]);
  const typing = [form.first_name, form.second_name, form.third_name].some((name) =>
    String(name || "").trim()
  );

  if (typing) {
    if (!similar.length) {
      return (
        <MDTypography variant="caption" color="text" display="block" mt={1}>
          No learner at your school has a similar name.
        </MDTypography>
      );
    }
    const exact = similar.some((entry) => entry.sameName);
    return (
      <MDBox
        mt={1.5}
        p={1.25}
        borderRadius="md"
        data-testid="similar-learners"
        sx={{ bgcolor: "rgba(251,140,0,.08)", border: "1px solid rgba(251,140,0,.35)" }}
      >
        <MDTypography variant="caption" fontWeight="bold" display="block" mb={0.5}>
          {exact
            ? "A learner with this name is already at your school. Is it the same child?"
            : "Learners at your school with similar names:"}
        </MDTypography>
        {similar.map(({ learner, sameName }) => (
          <MDTypography
            key={learner.id}
            variant="caption"
            display="block"
            fontWeight={sameName ? "bold" : "regular"}
          >
            {learner.full_name} - {placement(learner)}
          </MDTypography>
        ))}
        <MDTypography variant="caption" color="text" display="block" mt={0.5}>
          Different children can share a name: you can still add this learner.
        </MDTypography>
      </MDBox>
    );
  }

  if (!form.grade) return null;
  const inClass = learners
    .filter(
      (learner) =>
        learner.graduation_status !== "graduated" &&
        learner.grade === form.grade &&
        (!form.stream || learner.stream === form.stream)
    )
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  const where = `${form.grade}${form.stream ? ` ${form.stream}` : ""}`;

  return (
    <MDBox mt={1.5} data-testid="class-learners">
      <MDTypography variant="caption" fontWeight="bold" display="block" mb={0.5}>
        {inClass.length ? `Already in ${where} (${inClass.length}):` : `Nobody is in ${where} yet.`}
      </MDTypography>
      {inClass.length > 0 && (
        <MDTypography variant="caption" color="text" display="block">
          {inClass
            .slice(0, CLASS_LIST_LIMIT)
            .map((learner) => learner.full_name)
            .join(", ")}
          {inClass.length > CLASS_LIST_LIMIT
            ? ` and ${inClass.length - CLASS_LIST_LIMIT} more`
            : ""}
        </MDTypography>
      )}
    </MDBox>
  );
}

LearnerNameCheck.propTypes = {
  learners: PropTypes.arrayOf(PropTypes.object).isRequired,
  form: PropTypes.shape({
    first_name: PropTypes.string,
    second_name: PropTypes.string,
    third_name: PropTypes.string,
    grade: PropTypes.string,
    stream: PropTypes.string,
  }).isRequired,
};

export default LearnerNameCheck;
