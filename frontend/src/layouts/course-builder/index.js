import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

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

function contentToText(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content.body === "string") return content.body;
  return JSON.stringify(content, null, 2);
}

function moduleToForm(courseModule) {
  return {
    title: courseModule?.title || "",
    description: courseModule?.description || "",
    position: courseModule?.position || 1,
    is_published: courseModule?.is_published !== false,
    learning_outcomes: courseModule?.learning_outcomes || [],
    unlock_at: courseModule?.unlock_at ? String(courseModule.unlock_at).slice(0, 16) : "",
  };
}

function activityToForm(activity) {
  return {
    title: activity?.title || "",
    activity_type: activity?.activity_type || "lesson",
    content_text: contentToText(activity?.content),
    points: activity?.points || 0,
    position: activity?.position || 1,
    is_required: activity?.is_required !== false,
    completion_rule: activity?.completion_rule || "manual",
    pass_score: activity?.pass_score || "",
    is_published: activity?.is_published !== false,
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
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const [editorMode, setEditorMode] = useState("add-module");
  const [moduleActionAnchor, setModuleActionAnchor] = useState(null);
  const [activityActionAnchor, setActivityActionAnchor] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [courseForm, setCourseForm] = useState({});
  const [moduleEditForm, setModuleEditForm] = useState(emptyModule(1));
  const [activityEditForm, setActivityEditForm] = useState(emptyActivity(1));
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
  const selectedActivity = useMemo(
    () =>
      selectedModule?.activities?.find(
        (activity) => Number(activity.id) === Number(selectedActivityId)
      ) || selectedModule?.activities?.[0],
    [selectedModule, selectedActivityId]
  );
  const course = data?.course || data?.template;
  const versionLabel = isTemplate
    ? `Template v${course?.version || 1}`
    : `School v${course?.school_version || 1}${
        course?.template_version ? ` | Synced template v${course.template_version}` : ""
      }${course?.current_template_version ? ` of ${course.current_template_version}` : ""}`;

  const loadBuilder = async () => {
    setLoading(true);
    setError("");
    try {
      const response = isTemplate
        ? await apiClient.get(`/course-templates/${entityId}/builder`)
        : await apiClient.get(`/courses/${entityId}/learning-overview`);
      setData(response);
      setSelectedModuleId((current) =>
        response.modules?.some((module) => Number(module.id) === Number(current)) ? current : null
      );
      setSelectedActivityId((current) =>
        response.modules?.some((module) =>
          module.activities?.some((activity) => Number(activity.id) === Number(current))
        )
          ? current
          : null
      );
      setCourseForm({
        name: (response.course || response.template)?.name || "",
        code: (response.course || response.template)?.code || "",
        target_level: (response.course || response.template)?.target_level || "",
        estimated_weeks: (response.course || response.template)?.estimated_weeks || "",
        description: (response.course || response.template)?.description || "",
        course_category: (response.course || response.template)?.course_category || "general",
        is_active: (response.course || response.template)?.is_active !== false,
      });
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
    setSelectedActivityId(null);
    setEditorMode("add-module");
    setExpandedModules({});
    loadBuilder();
  }, [entityId, isTemplate]);

  useEffect(() => {
    if (selectedModule) {
      setModuleEditForm(moduleToForm(selectedModule));
      setActivityForm(emptyActivity((selectedModule.activities?.length || 0) + 1));
      if (
        editorMode === "edit-activity" &&
        !selectedModule.activities?.some(
          (activity) => Number(activity.id) === Number(selectedActivityId)
        )
      ) {
        setSelectedActivityId(selectedModule.activities?.[0]?.id || null);
      }
    }
  }, [selectedModule?.id]);

  useEffect(() => {
    if (selectedActivity) {
      setActivityEditForm(activityToForm(selectedActivity));
    }
  }, [selectedActivity?.id]);

  const updateCourseDetails = async () => {
    if (!isTemplate) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.put(`/course-templates/${entityId}`, {
        ...courseForm,
        estimated_weeks: courseForm.estimated_weeks ? Number(courseForm.estimated_weeks) : null,
      });
      setMessage("Template details saved.");
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

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

  const closeMenus = () => {
    setModuleActionAnchor(null);
    setActivityActionAnchor(null);
    setActionTarget(null);
  };

  const selectModuleForEdit = (courseModule) => {
    setSelectedModuleId(courseModule.id);
    setSelectedActivityId(null);
    setModuleEditForm(moduleToForm(courseModule));
    setEditorMode("edit-module");
    closeMenus();
  };

  const selectActivityForEdit = (courseModule, activity) => {
    setSelectedModuleId(courseModule.id);
    setSelectedActivityId(activity.id);
    setActivityEditForm(activityToForm(activity));
    setEditorMode("edit-activity");
    closeMenus();
  };

  const updateModulePublished = async (courseModule, isPublished) => {
    setSaving(true);
    setError("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${courseModule.id}`
        : `/courses/modules/${courseModule.id}`;
      await apiClient.put(endpoint, {
        ...courseModule,
        unlock_at: isTemplate ? null : courseModule.unlock_at || null,
        is_published: isPublished,
      });
      await loadBuilder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateModule = async () => {
    if (!selectedModule) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/modules/${selectedModule.id}`
        : `/courses/modules/${selectedModule.id}`;
      await apiClient.put(endpoint, {
        ...moduleEditForm,
        unlock_at: isTemplate ? null : moduleEditForm.unlock_at || null,
      });
      setMessage("Module saved.");
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

  const updateActivity = async () => {
    if (!selectedActivity) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isTemplate
        ? `/course-templates/activities/${selectedActivity.id}`
        : `/courses/activities/${selectedActivity.id}`;
      await apiClient.put(endpoint, parseActivityPayload(activityEditForm));
      setMessage("Activity saved.");
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
              {course?.name || "Course"} | {versionLabel}
            </MDTypography>
            {!isTemplate && course?.update_available && (
              <Chip label="Template update available" color="warning" size="small" sx={{ mt: 1 }} />
            )}
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
            {isTemplate && (
              <Grid item xs={12}>
                <Card>
                  <MDBox p={2.5}>
                    <MDTypography variant="h6" fontWeight="bold" mb={2}>
                      Template Details
                    </MDTypography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={4}>
                        <MDInput
                          label="Template name"
                          fullWidth
                          value={courseForm.name}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, name: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <MDInput
                          label="Code"
                          fullWidth
                          value={courseForm.code}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, code: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <MDInput
                          label="Level"
                          fullWidth
                          value={courseForm.target_level}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, target_level: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <MDInput
                          label="Weeks"
                          type="number"
                          fullWidth
                          value={courseForm.estimated_weeks}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, estimated_weeks: event.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <MDInput
                          label="Description"
                          multiline
                          rows={2}
                          fullWidth
                          value={courseForm.description}
                          onChange={(event) =>
                            setCourseForm({ ...courseForm, description: event.target.value })
                          }
                        />
                      </Grid>
                    </Grid>
                    <MDBox mt={2}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        disabled={saving || !courseForm.name}
                        onClick={updateCourseDetails}
                      >
                        Save Template
                      </MDButton>
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
            )}
            <Grid item xs={12} lg={4}>
              <Card>
                <MDBox p={2.5}>
                  <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <MDTypography variant="h6" fontWeight="bold">
                      Modules
                    </MDTypography>
                    <MDButton
                      variant="outlined"
                      color="info"
                      size="small"
                      onClick={() => setEditorMode("add-module")}
                    >
                      Add
                    </MDButton>
                  </MDBox>
                  <MDBox display="flex" flexDirection="column" gap={1}>
                    {modules.map((courseModule) => {
                      const expanded = Boolean(expandedModules[courseModule.id]);
                      return (
                        <MDBox
                          key={courseModule.id}
                          border="1px solid #e5e7eb"
                          borderRadius="md"
                          overflow="hidden"
                        >
                          <MDBox
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            px={1.5}
                            py={1}
                          >
                            <MDBox minWidth={0}>
                              <MDTypography variant="button" fontWeight="medium">
                                {courseModule.title}
                              </MDTypography>
                              <MDTypography variant="caption" color="text" display="block">
                                {courseModule.activities.length} activities
                              </MDTypography>
                            </MDBox>
                            <MDBox display="flex" alignItems="center" gap={0.5}>
                              <Chip
                                size="small"
                                label={courseModule.is_published ? "Published" : "Hidden"}
                                color={courseModule.is_published ? "success" : "default"}
                              />
                              <IconButton
                                size="small"
                                aria-label="Toggle activities"
                                onClick={() =>
                                  setExpandedModules((current) => ({
                                    ...current,
                                    [courseModule.id]: !current[courseModule.id],
                                  }))
                                }
                              >
                                <Icon>{expanded ? "expand_less" : "expand_more"}</Icon>
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="Module actions"
                                onClick={(event) => {
                                  setActionTarget(courseModule);
                                  setModuleActionAnchor(event.currentTarget);
                                }}
                              >
                                <Icon>more_vert</Icon>
                              </IconButton>
                            </MDBox>
                          </MDBox>
                          <Collapse in={expanded}>
                            <MDBox px={1.5} pb={1.5}>
                              {courseModule.activities.length === 0 ? (
                                <MDTypography variant="caption" color="text">
                                  No activities yet.
                                </MDTypography>
                              ) : (
                                courseModule.activities.map((activity) => (
                                  <MDBox
                                    key={activity.id}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    py={0.75}
                                    borderTop="1px solid #eef0f2"
                                  >
                                    <MDBox minWidth={0}>
                                      <MDTypography variant="caption" fontWeight="medium">
                                        {activity.title}
                                      </MDTypography>
                                      <MDTypography variant="caption" color="text" display="block">
                                        {activity.activity_type} | {activity.points || 0} marks
                                      </MDTypography>
                                    </MDBox>
                                    <IconButton
                                      size="small"
                                      aria-label="Activity actions"
                                      onClick={(event) => {
                                        setActionTarget({ module: courseModule, activity });
                                        setActivityActionAnchor(event.currentTarget);
                                      }}
                                    >
                                      <Icon>more_vert</Icon>
                                    </IconButton>
                                  </MDBox>
                                ))
                              )}
                            </MDBox>
                          </Collapse>
                        </MDBox>
                      );
                    })}
                  </MDBox>

                  <MDBox mt={3} display={editorMode === "add-module" ? "block" : "none"}>
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
                  {editorMode === "edit-module" && selectedModule ? (
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
                        </MDBox>
                      </MDBox>

                      <MDBox mt={2} p={2} border="1px solid #e5e7eb" borderRadius="md">
                        <MDTypography variant="button" fontWeight="bold">
                          Edit Module
                        </MDTypography>
                        <Grid container spacing={1.5} mt={0.5}>
                          <Grid item xs={12} md={5}>
                            <MDInput
                              label="Module title"
                              fullWidth
                              value={moduleEditForm.title}
                              onChange={(event) =>
                                setModuleEditForm({
                                  ...moduleEditForm,
                                  title: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <MDInput
                              label="Position"
                              type="number"
                              fullWidth
                              value={moduleEditForm.position}
                              onChange={(event) =>
                                setModuleEditForm({
                                  ...moduleEditForm,
                                  position: Number(event.target.value || 1),
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={5}>
                            <MDInput
                              select
                              label="Published"
                              fullWidth
                              value={moduleEditForm.is_published ? "yes" : "no"}
                              onChange={(event) =>
                                setModuleEditForm({
                                  ...moduleEditForm,
                                  is_published: event.target.value === "yes",
                                })
                              }
                              SelectProps={{ native: true }}
                            >
                              <option value="yes">Published</option>
                              <option value="no">Unpublished</option>
                            </MDInput>
                          </Grid>
                          <Grid item xs={12}>
                            <MDInput
                              label="Module description"
                              multiline
                              rows={2}
                              fullWidth
                              value={moduleEditForm.description}
                              onChange={(event) =>
                                setModuleEditForm({
                                  ...moduleEditForm,
                                  description: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          {!isTemplate && (
                            <Grid item xs={12} md={5}>
                              <MDInput
                                label="Unlock date"
                                type="datetime-local"
                                fullWidth
                                value={moduleEditForm.unlock_at}
                                onChange={(event) =>
                                  setModuleEditForm({
                                    ...moduleEditForm,
                                    unlock_at: event.target.value,
                                  })
                                }
                              />
                            </Grid>
                          )}
                        </Grid>
                        <MDBox mt={2}>
                          <MDButton
                            variant="gradient"
                            color="info"
                            disabled={saving || !moduleEditForm.title}
                            onClick={updateModule}
                          >
                            Save Module
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    </>
                  ) : editorMode === "edit-activity" && selectedActivity ? (
                    <MDBox>
                      <MDTypography variant="h5" fontWeight="bold">
                        {selectedActivity.title}
                      </MDTypography>
                      <MDTypography variant="body2" color="text">
                        Editing activity in {selectedModule?.title}
                      </MDTypography>
                      <MDBox mt={3} pt={2} borderTop="1px solid #e5e7eb">
                        <MDTypography variant="button" fontWeight="bold">
                          Edit Activity
                        </MDTypography>
                        <Grid container spacing={1.5} mt={0.5}>
                          <Grid item xs={12} md={5}>
                            <MDInput
                              label="Activity title"
                              fullWidth
                              value={activityEditForm.title}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  title: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <MDInput
                              select
                              label="Type"
                              fullWidth
                              value={activityEditForm.activity_type}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
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
                          <Grid item xs={6} md={2}>
                            <MDInput
                              label="Marks"
                              type="number"
                              fullWidth
                              value={activityEditForm.points}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  points: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={6} md={2}>
                            <MDInput
                              label="Position"
                              type="number"
                              fullWidth
                              value={activityEditForm.position}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  position: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <MDInput
                              select
                              label="Completion"
                              fullWidth
                              value={activityEditForm.completion_rule}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  completion_rule: event.target.value,
                                })
                              }
                              SelectProps={{ native: true }}
                            >
                              <option value="manual">Manual</option>
                              <option value="viewed">Viewed</option>
                              <option value="submitted">Submitted</option>
                              <option value="graded">Graded</option>
                              <option value="score_at_least">Score at least</option>
                            </MDInput>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <MDInput
                              select
                              label="Published"
                              fullWidth
                              value={activityEditForm.is_published ? "yes" : "no"}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  is_published: event.target.value === "yes",
                                })
                              }
                              SelectProps={{ native: true }}
                            >
                              <option value="yes">Published</option>
                              <option value="no">Unpublished</option>
                            </MDInput>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <MDInput
                              label="Pass score"
                              type="number"
                              fullWidth
                              value={activityEditForm.pass_score}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  pass_score: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <MDInput
                              label="Content or JSON"
                              multiline
                              rows={5}
                              fullWidth
                              value={activityEditForm.content_text}
                              onChange={(event) =>
                                setActivityEditForm({
                                  ...activityEditForm,
                                  content_text: event.target.value,
                                })
                              }
                            />
                          </Grid>
                        </Grid>
                        <MDBox mt={2}>
                          <MDButton
                            variant="gradient"
                            color="info"
                            disabled={saving || !activityEditForm.title}
                            onClick={updateActivity}
                          >
                            Save Activity
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    </MDBox>
                  ) : selectedModule ? (
                    <MDBox>
                      <MDTypography variant="h5" fontWeight="bold">
                        {selectedModule.title}
                      </MDTypography>
                      <MDTypography variant="body2" color="text">
                        Choose an action from the module list, or add an activity below.
                      </MDTypography>

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
                    </MDBox>
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
        <Menu anchorEl={moduleActionAnchor} open={Boolean(moduleActionAnchor)} onClose={closeMenus}>
          <MenuItem onClick={() => selectModuleForEdit(actionTarget)}>Edit</MenuItem>
          <MenuItem
            onClick={() => {
              updateModulePublished(actionTarget, !actionTarget?.is_published);
              closeMenus();
            }}
          >
            {actionTarget?.is_published ? "Unpublish" : "Publish"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (actionTarget) deleteModule(actionTarget);
              closeMenus();
            }}
          >
            Delete
          </MenuItem>
        </Menu>
        <Menu
          anchorEl={activityActionAnchor}
          open={Boolean(activityActionAnchor)}
          onClose={closeMenus}
        >
          <MenuItem
            onClick={() => selectActivityForEdit(actionTarget?.module, actionTarget?.activity)}
          >
            Edit
          </MenuItem>
          <MenuItem
            onClick={() => {
              updateActivityPublished(
                actionTarget?.activity,
                !actionTarget?.activity?.is_published
              );
              closeMenus();
            }}
          >
            {actionTarget?.activity?.is_published ? "Unpublish" : "Publish"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (actionTarget?.activity) deleteActivity(actionTarget.activity);
              closeMenus();
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default CourseBuilder;
