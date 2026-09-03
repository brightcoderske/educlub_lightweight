import { useEffect, useRef, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import { useNavigate } from "react-router-dom";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDAvatar from "components/MDAvatar";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { LearningArt } from "components/DashboardIdentity";
import { getUserDisplayName, getUserPhotoUrl } from "lib/userDisplay";
import { useAppPalette } from "lib/appTheme";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function LearnerProfile() {
  const navigate = useNavigate();
  const palette = useAppPalette();
  const { user, isLearner, resetPassword, updateProfilePhoto } = useAuth();
  const photoInput = useRef(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [learner, setLearner] = useState(null);
  // Grade is the only field a learner may change. Everything else on this
  // screen is placement data an operator owns, so it is read from the learner
  // record and rendered as text rather than as an input.
  const [grade, setGrade] = useState("");
  const [passwords, setPasswords] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const choosePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    setPhotoMessage("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setPhotoError("Choose a JPG, PNG, or WebP photo up to 5 MB.");
      return;
    }
    setPhotoBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, 320, 320);
        const side = Math.min(bitmap.width, bitmap.height);
        context.drawImage(
          bitmap,
          (bitmap.width - side) / 2,
          (bitmap.height - side) / 2,
          side,
          side,
          0,
          0,
          320,
          320
        );
        setPhotoPreview(canvas.toDataURL("image/jpeg", 0.82));
      } finally {
        bitmap.close();
      }
    } catch {
      setPhotoError("We couldn’t open that photo. Please choose another image.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const savePhoto = async (dataUrl) => {
    setPhotoBusy(true);
    setPhotoError("");
    setPhotoMessage("");
    try {
      await updateProfilePhoto(dataUrl);
      setPhotoPreview("");
      setPhotoMessage(
        dataUrl ? "Your new photo is saved!" : "Photo removed. Your character is back."
      );
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  useEffect(() => {
    if (isLearner()) {
      loadProfile();
    }
  }, [user?.email]);

  const loadProfile = async () => {
    setError("");
    try {
      const learners = await apiClient.get(
        `/learners?email=${encodeURIComponent(user?.email || "")}`
      );
      const currentLearner = learners[0];
      setLearner(currentLearner || null);
      setGrade(currentLearner?.grade || "");
    } catch (err) {
      setError(err.message);
    }
  };

  const saveGrade = async () => {
    if (!learner) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await apiClient.put(`/learners/${learner.id}`, { grade });
      setLearner(updated);
      setGrade(updated.grade || "");
      setMessage("Your grade is updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await resetPassword(passwords.oldPassword, passwords.newPassword);
      setPasswords({ oldPassword: "", newPassword: "" });
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isLearner()) {
    return <MDBox p={3}>Access denied. Learner only.</MDBox>;
  }

  // The API normalises to "Grade 1".."Grade 12" and rejects anything else, so
  // that is the list offered. A record already holding a value outside it keeps
  // showing its own, rather than the select silently reading as blank.
  const gradeChoices = Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`);
  const grades = grade && !gradeChoices.includes(grade) ? [grade, ...gradeChoices] : gradeChoices;

  const details = [
    ["Full name", learner?.full_name || getUserDisplayName(user)],
    ["Email", learner?.email || user?.email],
    ["School", learner?.school_name || user?.schoolName],
    ["Class / Stream", learner?.stream],
    ["Term", learner?.term],
    ["Academic year", learner?.academic_year],
  ];

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="My Profile"
        subtitle="Keep your learner details complete and protect your password."
      />
      <MDBox py={2}>
        <Card sx={{ mb: 2, background: palette.heroBackground }}>
          <MDBox p={2} display="flex" alignItems="center" gap={1.75}>
            <MDAvatar
              src={getUserPhotoUrl(user)}
              alt={`${getUserDisplayName(user)} profile photo`}
              sx={{
                width: { xs: 56, sm: 68 },
                height: { xs: 56, sm: 68 },
                bgcolor: palette.accentSoft,
                border: `3px solid ${palette.surface}`,
                flexShrink: 0,
              }}
            >
              <LearningArt kind="kid" size={68} />
            </MDAvatar>
            <MDBox minWidth={0} flex={1}>
              <MDTypography
                component="h2"
                variant="h5"
                sx={{ fontSize: { xs: "1.05rem", sm: "1.25rem" }, overflowWrap: "anywhere" }}
              >
                {getUserDisplayName(user)}
              </MDTypography>
              <MDBox display="flex" flexWrap="wrap" gap={0.75} mt={0.5}>
                {learner?.grade && (
                  <Chip label={learner.grade} size="small" sx={{ bgcolor: palette.chipSurface }} />
                )}
                {(learner?.school_name || user?.schoolName) && (
                  <Chip
                    label={learner?.school_name || user.schoolName}
                    size="small"
                    sx={{ bgcolor: palette.chipSurface, maxWidth: "100%" }}
                  />
                )}
              </MDBox>
              <MDBox display="flex" flexWrap="wrap" alignItems="center" gap={0.75} mt={1}>
                <MDButton
                  color="info"
                  variant="contained"
                  size="small"
                  startIcon={<Icon>add_a_photo</Icon>}
                  disabled={photoBusy}
                  onClick={() => photoInput.current?.click()}
                  aria-describedby="profile-photo-help"
                >
                  {photoBusy ? "Preparing…" : getUserPhotoUrl(user) ? "Change photo" : "Add photo"}
                </MDButton>
                {getUserPhotoUrl(user) && (
                  <MDButton
                    color="info"
                    variant="text"
                    size="small"
                    disabled={photoBusy}
                    onClick={() => savePhoto(null)}
                  >
                    Remove photo
                  </MDButton>
                )}
                <MDTypography id="profile-photo-help" variant="caption" color="text">
                  JPG, PNG or WebP, up to 5 MB.
                </MDTypography>
              </MDBox>
            </MDBox>
          </MDBox>
          <input
            ref={photoInput}
            type="file"
            aria-label="Choose profile photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={choosePhoto}
            hidden
          />
        </Card>
        {photoMessage && (
          <MDTypography role="status" variant="body2" color="success" mb={1}>
            {photoMessage}
          </MDTypography>
        )}
        {photoError && !photoPreview && (
          <MDTypography role="alert" variant="body2" color="error" mb={1}>
            {photoError}
          </MDTypography>
        )}
        <MDBox display="flex" flexWrap="wrap" gap={1} mb={2}>
          <MDButton
            color="info"
            variant="text"
            size="small"
            onClick={() => navigate("/learner/progress")}
            endIcon={<Icon>arrow_forward</Icon>}
          >
            My Progress
          </MDButton>
          <MDButton
            color="info"
            variant="text"
            size="small"
            onClick={() => navigate("/learner/certificates")}
            endIcon={<Icon>arrow_forward</Icon>}
          >
            Badges & Certificates
          </MDButton>
        </MDBox>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={2}>
                <MDTypography variant="h6">
                  <Icon
                    sx={{ color: palette.accentText, mr: 0.75, verticalAlign: "middle" }}
                    fontSize="sm"
                  >
                    face
                  </Icon>
                  All about you
                </MDTypography>
                <MDTypography variant="caption" color="text" display="block" mb={1}>
                  Your school keeps these up to date. If something looks wrong, tell your teacher.
                </MDTypography>
                <MDBox component="dl" m={0}>
                  {details.map(([label, value]) => (
                    <MDBox
                      key={label}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="baseline"
                      gap={2}
                      py={0.85}
                      sx={{ borderBottom: `1px solid ${palette.borderSoft}` }}
                    >
                      <MDTypography component="dt" variant="caption" color="text" flexShrink={0}>
                        {label}
                      </MDTypography>
                      <MDTypography
                        component="dd"
                        variant="button"
                        fontWeight="medium"
                        sx={{ m: 0, textAlign: "right", overflowWrap: "anywhere" }}
                      >
                        {value || "—"}
                      </MDTypography>
                    </MDBox>
                  ))}
                </MDBox>
                <MDBox mt={2}>
                  <MDInput
                    select
                    label="My grade"
                    fullWidth
                    value={grade}
                    disabled={!learner || saving}
                    onChange={(event) => setGrade(event.target.value)}
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: true }}
                  >
                    <option value="" />
                    {grades.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </MDInput>
                  <MDButton
                    variant="gradient"
                    color="info"
                    sx={{ mt: 1.5 }}
                    onClick={saveGrade}
                    disabled={saving || !learner || !grade || grade === (learner?.grade || "")}
                  >
                    {saving ? "Saving…" : "Save my grade"}
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <MDBox p={2}>
                <MDTypography variant="h6">
                  <Icon
                    sx={{ color: palette.accentText, mr: 0.75, verticalAlign: "middle" }}
                    fontSize="sm"
                  >
                    shield
                  </Icon>
                  Keep your account safe
                </MDTypography>
                <MDTypography variant="caption" color="text" display="block" mb={2}>
                  Use at least 8 characters with uppercase, lowercase, number, and symbol.
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <MDInput
                      label="Current Password"
                      type="password"
                      autoComplete="current-password"
                      fullWidth
                      value={passwords.oldPassword}
                      onChange={(event) =>
                        setPasswords((current) => ({ ...current, oldPassword: event.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      label="New Password"
                      type="password"
                      autoComplete="new-password"
                      fullWidth
                      value={passwords.newPassword}
                      onChange={(event) =>
                        setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                      }
                    />
                  </Grid>
                </Grid>
                <MDBox mt={2}>
                  <MDButton
                    variant="gradient"
                    color="warning"
                    onClick={changePassword}
                    disabled={saving || !passwords.oldPassword || !passwords.newPassword}
                  >
                    Change Password
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>

        {message && (
          <MDTypography role="status" variant="caption" color="success" display="block" mt={2}>
            {message}
          </MDTypography>
        )}
        {error && (
          <MDTypography role="alert" variant="caption" color="error" display="block" mt={2}>
            {error}
          </MDTypography>
        )}
      </MDBox>
      <Dialog
        open={Boolean(photoPreview)}
        onClose={() => {
          if (!photoBusy) {
            setPhotoPreview("");
            setPhotoError("");
          }
        }}
        maxWidth="xs"
        fullWidth
        aria-labelledby="photo-preview-title"
      >
        <DialogTitle id="photo-preview-title">Your new profile photo</DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <MDBox
            component="img"
            src={photoPreview || undefined}
            alt="Preview of your profile photo"
            sx={{
              width: 180,
              height: 180,
              maxWidth: "100%",
              borderRadius: "50%",
              objectFit: "cover",
              mb: 1,
            }}
          />
          <MDTypography variant="body2">
            This picture will appear on your profile and in the header.
          </MDTypography>
          {photoError && (
            <MDTypography role="alert" variant="body2" color="error" mt={1}>
              {photoError}
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <MDButton
            disabled={photoBusy}
            onClick={() => {
              setPhotoPreview("");
              setPhotoError("");
            }}
          >
            Cancel
          </MDButton>
          <MDButton
            color="info"
            variant="contained"
            disabled={photoBusy}
            onClick={() => savePhoto(photoPreview)}
          >
            {photoBusy ? "Saving…" : "Save photo"}
          </MDButton>
        </DialogActions>
      </Dialog>
      <Footer />
    </DashboardLayout>
  );
}

export default LearnerProfile;
