import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { apiClient } from "lib/api";

const activityTypes = [
  "lesson",
  "quiz",
  "assignment",
  "discussion",
  "coding",
  "typing",
  "project",
  "reflection",
];

function emptyModule(position) {
  return {
    title: "",
    description: "",
    position,
    is_published: true,
  };
}

function emptyActivity(position) {
  return {
    title: "",
    activity_type: "lesson",
    content_text: "",
    points: 0,
    position,
    is_required: true,
    completion_rule: "manual",
    is_published: true,
  };
}

function parseActivityPayload(form) {
  let content = {};
  const text = form.content_text || "";

  try {
    content = text.trim().startsWith("{") ? JSON.parse(text) : { body: text };
  } catch (error) {
    content = { body: text };
  }

  return {
    ...form,
    content,
    points: Number(form.points || 0),
    position: Number(form.position || 1),
  };
}

function CourseBuilder() {
  const { templateId, courseId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isTemplate = pathname.startsWith("/system-admin");
  const entityId = isTemplate ? templateId : courseId;
  const [data, setData] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [moduleForm, setModuleForm] = useState(emptyModule(1));
  const [activityForm, setActivityForm] = useState(emptyActivity(1));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const modules = data?.modules || [];
  const selectedModule = useMemo(
    () => modules.find((module) => Number(module.id) === Number(selectedModuleId)) || modules[0],
    [modules, selectedModuleId]
  );
  const course = data?.course || data?.template;

  const loadBuilder = async () => {
    setLoading(true);
    setError("");
    try {
      const response = isTemplate
        ? await apiClient.get(`/course-templates/${entityId}/builder`)
        : await apiClient.get(`/courses/${entityId}/learning-overview`);
      setData(response);
      setSelectedModuleId((current) => current || response.modules?.[0]?.id || null);
      setModuleForm(emptyModule((response.modules?.length || 0) + 1));
      setActivityForm(emptyActivity((response.modules?.[0]?.activities?.length || 0) + 1));
    } catch (err) {
      setError(err.message || "Failed to load builder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedModuleId(null);
    loadBuilder();
  }, [entityId, isTemplate]);

  const createModule = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/${entityId}/modules`
        : `/courses/${entityId}/modules`;
      await apiClient.post(endpoint, moduleForm);
      setMessage("Module added.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateModulePublished = async (courseModule, isPublished) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${courseModule.id}`
        : `/courses/modules/${courseModule.id}`;
      await apiClient.put(endpoint, { ...courseModule, is_published: isPublished });
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteModule = async (courseModule) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${courseModule.id}`
        : `/courses/modules/${courseModule.id}`;
      await apiClient.delete(endpoint);
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createActivity = async () => {
    if (!selectedModule) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${selectedModule.id}/activities`
        : `/courses/modules/${selectedModule.id}/activities`;
      await apiClient.post(endpoint, parseActivityPayload(activityForm));
      setMessage("Activity added.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateActivityPublished = async (activity, isPublished) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/activities/${activity.id}`
        : `/courses/activities/${activity.id}`;
      await apiClient.put(endpoint, { ...activity, is_published: isPublished });
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteActivity = async (activity) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/activities/${activity.id}`
        : `/courses/activities/${activity.id}`;
      await apiClient.delete(endpoint);
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const syncCourse = async (action) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.post(`/courses/${entityId}/${action}-template`, {});
      setMessage(action === "sync" ? "Template updates synced." : "Template content restored.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3} display="flex" justifyContent="space-between" alignItems="center" gap={2}>
          <MDBox minWidth={0}>
            <MDTypography variant="h3">
              {isTemplate ? "Template Builder" : "School Course Builder"}
            </MDTypography>
            <MDTypography variant="body2" color="text">
              {course?.name || "Course"} {course?.version ? `| Version ${course.version}` : ""}
            </MDTypography>
          </MDBox>
          <MDBox display="flex" gap={1} flexWrap="wrap">
            {!isTemplate && (
              <>
                <MDButton
                  variant="outlined"
                  color="info"
                  disabled={saving}
                  onClick={() => syncCourse("sync")}
                >
                  Sync Template
                </MDButton>
                <MDButton
                  variant="outlined"
                  color="warning"
                  disabled={saving}
                  onClick={() => syncCourse("rollback")}
                >
                  Roll Back
                </MDButton>
              </>
            )}
            <MDButton
              variant="outlined"
              color="dark"
              onClick={() =>
                navigate(isTemplate ? "/system-admin/courses" : "/school-admin/courses")
              }
            >
              Close
            </MDButton>
          </MDBox>
        </MDBox>

        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={2}>
            {error}
          </MDTypography>
        )}
        {message && (
          <MDTypography variant="caption" color="success" display="block" mb={2}>
            {message}
          </MDTypography>
        )}

        {loading ? (
          <Card>
            <MDBox p={3}>
              <MDTypography variant="body2" color="text">
                Loading builder...
              </MDTypography>
            </MDBox>
          </Card>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={4}>
              <Card>
                <MDBox p={2.5}>
                  <MDTypography variant="h6" fontWeight="bold" mb={2}>
                    Modules
                  </MDTypography>
                  <MDBox display="flex" flexDirection="column" gap={1}>
                    {modules.map((courseModule) => (
                      <MDButton
                        key={courseModule.id}
                        variant={selectedModule?.id === courseModule.id ? "gradient" : "outlined"}
                        color={courseModule.is_published ? "info" : "dark"}
                        onClick={() => {
                          setSelectedModuleId(courseModule.id);
                          setActivityForm(emptyActivity(courseModule.activities.length + 1));
                        }}
                        sx={{ justifyContent: "space-between", minHeight: 42 }}
                      >
                        {courseModule.title}
                      </MDButton>
                    ))}
                  </MDBox>

                  <MDBox mt={3}>
                    <MDTypography variant="button" fontWeight="bold">
                      Add Module
                    </MDTypography>
                    <MDBox mt={1} display="flex" flexDirection="column" gap={1.25}>
                      <MDInput
                        label="Module title"
                        value={moduleForm.title}
                        onChange={(event) =>
                          setModuleForm({ ...moduleForm, title: event.target.value })
                        }
                      />
                      <MDInput
                        label="Description"
                        multiline
                        rows={2}
                        value={moduleForm.description}
                        onChange={(event) =>
                          setModuleForm({ ...moduleForm, description: event.target.value })
                        }
                      />
                      <MDButton
                        variant="gradient"
                        color="success"
                        disabled={saving || !moduleForm.title}
                        onClick={createModule}
                      >
                        Add Module
                      </MDButton>
                    </MDBox>
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>

            <Grid item xs={12} lg={8}>
              <Card>
                <MDBox p={2.5}>
                  {selectedModule ? (
                    <>
                      <MDBox
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        gap={1}
                      >
                        <MDBox>
                          <MDTypography variant="h5" fontWeight="bold">
                            {selectedModule.title}
                          </MDTypography>
                          <MDTypography variant="body2" color="text">
                            {selectedModule.description || "No description yet."}
                          </MDTypography>
                        </MDBox>
                        <MDBox display="flex" alignItems="center" gap={1}>
                          <Chip
                            size="small"
                            label={selectedModule.is_published ? "Published" : "Unpublished"}
                            color={selectedModule.is_published ? "success" : "default"}
                          />
                          <IconButton
                            aria-label="Toggle module publishing"
                            disabled={saving}
                            onClick={() =>
                              updateModulePublished(selectedModule, !selectedModule.is_published)
                            }
                          >
                            <Icon>
                              {selectedModule.is_published ? "visibility_off" : "visibility"}
                            </Icon>
                          </IconButton>
                          <IconButton
                            aria-label="Delete module"
                            color="error"
                            disabled={saving}
                            onClick={() => deleteModule(selectedModule)}
                          >
                            <Icon>delete</Icon>
                          </IconButton>
                        </MDBox>
                      </MDBox>

                      <MDBox mt={2}>
                        {selectedModule.activities.length === 0 ? (
                          <MDTypography variant="body2" color="text">
                            No activities yet.
                          </MDTypography>
                        ) : (
                          selectedModule.activities.map((activity) => (
                            <MDBox
                              key={activity.id}
                              display="flex"
                              alignItems="center"
                              justifyContent="space-between"
                              py={1.25}
                              borderTop="1px solid #eef0f2"
                              gap={1}
                            >
                              <MDBox minWidth={0}>
                                <MDTypography variant="button" fontWeight="medium">
                                  {activity.title}
                                </MDTypography>
                                <MDTypography variant="caption" color="text" display="block">
                                  {activity.activity_type} | {activity.points || 0} marks
                                  {activity.template_activity_id ? " | Template" : " | School"}
                                </MDTypography>
                              </MDBox>
                              <MDBox display="flex" alignItems="center" gap={1}>
                                <Chip
                                  size="small"
                                  label={activity.is_published ? "Published" : "Unpublished"}
                                  color={activity.is_published ? "success" : "default"}
                                />
                                <IconButton
                                  aria-label="Toggle activity publishing"
                                  disabled={saving}
                                  onClick={() =>
                                    updateActivityPublished(activity, !activity.is_published)
                                  }
                                >
                                  <Icon>
                                    {activity.is_published ? "visibility_off" : "visibility"}
                                  </Icon>
                                </IconButton>
                                <IconButton
                                  aria-label="Delete activity"
                                  color="error"
                                  disabled={saving}
                                  onClick={() => deleteActivity(activity)}
                                >
                                  <Icon>delete</Icon>
                                </IconButton>
                              </MDBox>
                            </MDBox>
                          ))
                        )}
                      </MDBox>

                      <MDBox mt={3} pt={2} borderTop="1px solid #e5e7eb">
                        <MDTypography variant="button" fontWeight="bold">
                          Add Activity
                        </MDTypography>
                        <Grid container spacing={1.5} mt={0.5}>
                          <Grid item xs={12} md={6}>
                            <MDInput
                              label="Activity title"
                              fullWidth
                              value={activityForm.title}
                              onChange={(event) =>
                                setActivityForm({ ...activityForm, title: event.target.value })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <MDInput
                              select
                              label="Type"
                              fullWidth
                              value={activityForm.activity_type}
                              onChange={(event) =>
                                setActivityForm({
                                  ...activityForm,
                                  activity_type: event.target.value,
                                })
                              }
                              SelectProps={{ native: true }}
                            >
                              {activityTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </MDInput>
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <MDInput
                              label="Marks"
                              type="number"
                              fullWidth
                              value={activityForm.points}
                              onChange={(event) =>
                                setActivityForm({ ...activityForm, points: event.target.value })
                              }
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <MDInput
                              label="Content or JSON"
                              multiline
                              rows={4}
                              fullWidth
                              value={activityForm.content_text}
                              onChange={(event) =>
                                setActivityForm({
                                  ...activityForm,
                                  content_text: event.target.value,
                                })
                              }
                            />
                          </Grid>
                        </Grid>
                        <MDBox mt={2}>
                          <MDButton
                            variant="gradient"
                            color="success"
                            disabled={saving || !activityForm.title}
                            onClick={createActivity}
                          >
                            Add Activity
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    </>
                  ) : (
                    <MDTypography variant="body2" color="text">
                      Add a module to begin building this course.
                    </MDTypography>
                  )}
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default CourseBuilder;
