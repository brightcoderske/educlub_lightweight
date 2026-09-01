import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";

export default function AssessmentTermTools({
  grades,
  streams,
  courses,
  terms,
  academicYears,
  bulkForm,
  setBulkForm,
  syncForm,
  setSyncForm,
  bulkAllocate,
  syncResults,
}) {
  return (
    <MDBox
      mt={2}
      p={{ xs: 2, md: 2.5 }}
      sx={{ bgcolor: "#f8fafc", border: "1px solid #e8edf4", borderRadius: "14px" }}
    >
      <MDBox display="flex" alignItems="center" gap={1} mb={2}>
        <Icon sx={{ color: "#1A73E8" }}>tune</Icon>
        <MDBox>
          <MDTypography variant="button" color="dark" fontWeight="bold" display="block">
            Term tools
          </MDTypography>
          <MDTypography variant="caption" color="text">
            Allocate activities and synchronize one explicitly selected term and week.
          </MDTypography>
        </MDBox>
      </MDBox>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <MDInput
            select
            label="Grade"
            fullWidth
            value={bulkForm.grade}
            onChange={(event) => setBulkForm({ ...bulkForm, grade: event.target.value })}
            SelectProps={{ native: true }}
          >
            <option value="" />
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDInput
            select
            label="Stream"
            fullWidth
            value={bulkForm.stream}
            onChange={(event) => setBulkForm({ ...bulkForm, stream: event.target.value })}
            SelectProps={{ native: true }}
          >
            <option value="">All streams</option>
            {streams.map((stream) => (
              <option key={stream} value={stream}>
                {stream}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDInput
            select
            label="Activity"
            fullWidth
            value={bulkForm.course_id}
            onChange={(event) => setBulkForm({ ...bulkForm, course_id: event.target.value })}
            SelectProps={{ native: true }}
          >
            <option value="" />
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDInput
            select
            label="Term"
            fullWidth
            value={bulkForm.term}
            onChange={(event) => setBulkForm({ ...bulkForm, term: event.target.value })}
            SelectProps={{ native: true }}
          >
            {terms.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDInput
            select
            label="Academic Year"
            fullWidth
            value={bulkForm.academic_year}
            onChange={(event) =>
              setBulkForm({ ...bulkForm, academic_year: event.target.value })
            }
            SelectProps={{ native: true }}
          >
            {academicYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDButton
            variant="gradient"
            color="info"
            fullWidth
            onClick={bulkAllocate}
            disabled={!bulkForm.grade || !bulkForm.course_id}
          >
            Allocate
          </MDButton>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDInput
            select
            label="Sync Term"
            fullWidth
            value={syncForm.term}
            onChange={(event) => setSyncForm({ ...syncForm, term: event.target.value })}
            SelectProps={{ native: true }}
          >
            {terms.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDInput
            select
            label="Sync Year"
            fullWidth
            value={syncForm.academic_year}
            onChange={(event) =>
              setSyncForm({ ...syncForm, academic_year: event.target.value })
            }
            SelectProps={{ native: true }}
          >
            {academicYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={3}>
          <MDInput
            label="Week"
            type="number"
            fullWidth
            value={syncForm.week_number}
            onChange={(event) => setSyncForm({ ...syncForm, week_number: event.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <MDButton variant="outlined" color="success" fullWidth onClick={syncResults}>
            Sync results
          </MDButton>
        </Grid>
      </Grid>
    </MDBox>
  );
}
