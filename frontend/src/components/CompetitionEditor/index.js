import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Grid from "@mui/material/Grid";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import { apiClient } from "lib/api";

export const gradeOptions = Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);

export const competitionTypes = [
  ["quiz", "Quiz"],
  ["typing", "Typing"],
  ["maths", "Maths"],
  ["science", "Science"],
  ["stem", "STEM"],
];

const emptyForm = {
  name: "",
  description: "",
  competition_type: "quiz",
  eligible_grades: [],
  start_date: "",
  end_date: "",
  price_amount: 0,
  currency: "KES",
  image_url: "",
  practice_available: false,
  is_featured: false,
  is_active: true,
};

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formFromCompetition(competition) {
  if (!competition) return emptyForm;
  return {
    name: competition.name || "",
    description: competition.description || "",
    competition_type: competition.competition_type || "quiz",
    eligible_grades: Array.isArray(competition.eligible_grades) ? competition.eligible_grades : [],
    start_date: dateInputValue(competition.start_date),
    end_date: dateInputValue(competition.end_date),
    price_amount: Number(competition.price_amount || 0),
    currency: competition.currency || "KES",
    image_url: competition.image_url || "",
    practice_available: Boolean(competition.practice_available),
    is_featured: Boolean(competition.is_featured),
    is_active: competition.is_active !== false,
  };
}

const byGradeNumber = (a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0);

/** A competition's banner, or a placeholder when it has none. */
export function CompetitionBanner({ imageUrl, altText, height }) {
  if (!imageUrl) {
    return (
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="100%"
        height={height}
        borderRadius="lg"
        bgColor="grey-100"
        border="1px dashed #cbd5e1"
      >
        <MDTypography variant="caption" color="text">
          No banner uploaded
        </MDTypography>
      </MDBox>
    );
  }
  return (
    <MDBox
      component="img"
      src={imageUrl}
      alt={altText}
      width="100%"
      height={height}
      borderRadius="lg"
      sx={{ objectFit: "cover", border: "1px solid #e5e7eb" }}
    />
  );
}

CompetitionBanner.defaultProps = { imageUrl: "", height: "120px" };
CompetitionBanner.propTypes = {
  imageUrl: PropTypes.string,
  altText: PropTypes.string.isRequired,
  height: PropTypes.string,
};

/** Where a competition's quiz or typing test is set up. */
export function competitionSetupPath(basePath, competition) {
  return competition.competition_type === "typing"
    ? `${basePath}?competition_id=${competition.id}`
    : `${basePath}?category=weekly_quiz&competition_id=${competition.id}`;
}

/**
 * Creates or edits a competition, then opens its quiz or typing test setup.
 *
 * `schoolRun` is the school's own version: no price (payments go to eduClub's
 * account), no featured flag, and the banner is optional. The server enforces
 * the same limits.
 */
function CompetitionEditor({ editing, schoolRun, setupPath, onSaved, onCancel }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(formFromCompetition(editing));
  const [gradePicker, setGradePicker] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(formFromCompetition(editing));
    setGradePicker("");
    setMessage("");
    setError("");
  }, [editing]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const toggleGrade = (grade) =>
    setForm((current) => {
      const grades = current.eligible_grades || [];
      return {
        ...current,
        eligible_grades: grades.includes(grade)
          ? grades.filter((item) => item !== grade)
          : [...grades, grade].sort(byGradeNumber),
      };
    });

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = editing
        ? await apiClient.put(`/competitions/${editing.id}`, form)
        : await apiClient.post("/competitions", form);
      setMessage(editing ? "Competition updated." : "Competition created.");
      setForm(emptyForm);
      setGradePicker("");
      await onSaved(saved);
      if (saved?.id) navigate(competitionSetupPath(setupPath, saved));
    } catch (err) {
      setError(err.message || "Could not save competition");
    } finally {
      setSaving(false);
    }
  };

  const uploadBanner = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Banner image must be 2MB or smaller.");
      return;
    }
    setUploadingBanner(true);
    setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await apiClient.post("/competitions/banner", {
          fileName: file.name,
          dataUrl: reader.result,
        });
        setField("image_url", result.image_url);
        setMessage("Banner image uploaded.");
      } catch (err) {
        setError(err.message || "Could not upload banner image");
      } finally {
        setUploadingBanner(false);
      }
    };
    reader.onerror = () => {
      setUploadingBanner(false);
      setError("Could not read banner image.");
    };
    reader.readAsDataURL(file);
  };

  let bannerStatus = schoolRun
    ? "Optional: a PNG or JPG banner learners see on the competition."
    : "Upload a PNG or JPG banner for learner adverts.";
  if (form.image_url) bannerStatus = "Banner uploaded and ready.";
  if (uploadingBanner) bannerStatus = "Uploading banner...";

  const missing =
    !form.name || !form.start_date || !form.end_date || (!schoolRun && !form.image_url);

  return (
    <MDBox p={2}>
      <MDTypography variant="h5" fontWeight="bold" mb={schoolRun ? 0.5 : 2}>
        {editing ? "Edit Competition" : "New Competition"}
      </MDTypography>
      {schoolRun && (
        <MDTypography variant="caption" color="text" display="block" mb={2}>
          Only your school&apos;s learners see this competition. School competitions are free to
          enter.
        </MDTypography>
      )}
      <MDBox mb={2}>
        <MDInput
          label="Competition name"
          fullWidth
          value={form.name}
          onChange={(event) => setField("name", event.target.value)}
        />
      </MDBox>
      <MDBox mb={2}>
        <MDInput
          label="Description"
          fullWidth
          multiline
          rows={3}
          value={form.description}
          onChange={(event) => setField("description", event.target.value)}
        />
      </MDBox>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <MDInput
            select
            label="Competition type"
            fullWidth
            value={form.competition_type}
            SelectProps={{ native: true }}
            onChange={(event) => setField("competition_type", event.target.value)}
          >
            {competitionTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </MDInput>
        </Grid>
        <Grid item xs={12} md={6}>
          <MDTypography variant="caption" color="text" display="block" mb={0.5}>
            Eligible grades
          </MDTypography>
          <MDInput
            select
            fullWidth
            value={gradePicker}
            SelectProps={{ native: true }}
            onChange={(event) => {
              if (event.target.value) toggleGrade(event.target.value);
              setGradePicker("");
            }}
          >
            <option value="">Select grade</option>
            {gradeOptions.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </MDInput>
          <MDBox display="flex" flexWrap="wrap" gap={0.75} mt={1}>
            {form.eligible_grades.length ? (
              form.eligible_grades.map((grade) => (
                <Chip
                  key={grade}
                  label={grade}
                  color="info"
                  onDelete={() => toggleGrade(grade)}
                  size="small"
                />
              ))
            ) : (
              <MDTypography variant="caption" color="text">
                No grades selected. Learners from all grades can view it.
              </MDTypography>
            )}
          </MDBox>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <MDInput
            type="date"
            label="Start"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.start_date}
            onChange={(event) => setField("start_date", event.target.value)}
          />
        </Grid>
        <Grid item xs={6}>
          <MDInput
            type="date"
            label="End"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.end_date}
            onChange={(event) => setField("end_date", event.target.value)}
          />
        </Grid>
      </Grid>
      {!schoolRun && (
        <Grid container spacing={2} mt={0.5}>
          <Grid item xs={7}>
            <MDInput
              type="number"
              label="Price"
              fullWidth
              value={form.price_amount}
              onChange={(event) => setField("price_amount", Number(event.target.value))}
            />
          </Grid>
          <Grid item xs={5}>
            <MDInput
              label="Currency"
              fullWidth
              value={form.currency}
              onChange={(event) => setField("currency", event.target.value.toUpperCase())}
            />
          </Grid>
        </Grid>
      )}
      <MDBox mt={2}>
        <CompetitionBanner
          imageUrl={form.image_url}
          altText={`${form.name || "Competition"} banner`}
        />
      </MDBox>
      <MDBox mt={1.5}>
        <MDInput
          type="file"
          label="Banner image"
          fullWidth
          InputLabelProps={{ shrink: true }}
          inputProps={{ accept: "image/png,image/jpeg,image/jpg" }}
          onChange={(event) => uploadBanner(event.target.files?.[0])}
        />
        <MDTypography
          variant="caption"
          color={form.image_url ? "success" : "text"}
          display="block"
          mt={0.5}
        >
          {bannerStatus}
        </MDTypography>
      </MDBox>
      <MDBox display="flex" alignItems="center" mt={2}>
        <Checkbox
          checked={form.practice_available}
          onChange={(event) => setField("practice_available", event.target.checked)}
        />
        <MDTypography variant="button" color="text">
          Practice available
        </MDTypography>
      </MDBox>
      {!schoolRun && (
        <MDBox display="flex" alignItems="center">
          <Checkbox
            checked={form.is_featured}
            onChange={(event) => setField("is_featured", event.target.checked)}
          />
          <MDTypography variant="button" color="text">
            Featured
          </MDTypography>
        </MDBox>
      )}
      <MDBox display="flex" alignItems="center">
        <Checkbox
          checked={form.is_active}
          onChange={(event) => setField("is_active", event.target.checked)}
        />
        <MDTypography variant="button" color="text">
          Active
        </MDTypography>
      </MDBox>
      {message && (
        <MDTypography variant="caption" color="success" display="block" mb={1}>
          {message}
        </MDTypography>
      )}
      {error && (
        <MDTypography variant="caption" color="error" display="block" mb={1}>
          {error}
        </MDTypography>
      )}
      <MDButton
        variant="gradient"
        color="info"
        fullWidth
        onClick={save}
        disabled={saving || missing}
      >
        {saving ? "Saving..." : editing ? "Update Competition" : "Create Competition"}
      </MDButton>
      {editing && (
        <MDButton variant="text" color="dark" fullWidth onClick={onCancel}>
          Cancel Edit
        </MDButton>
      )}
    </MDBox>
  );
}

CompetitionEditor.defaultProps = {
  editing: null,
  schoolRun: false,
};

CompetitionEditor.propTypes = {
  editing: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  schoolRun: PropTypes.bool,
  setupPath: PropTypes.string.isRequired,
  onSaved: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default CompetitionEditor;
