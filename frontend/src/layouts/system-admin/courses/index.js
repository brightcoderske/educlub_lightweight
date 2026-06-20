import AdminResourcePage from "layouts/system-admin/AdminResourcePage";

function SystemAdminCourses() {
  return (
    <AdminResourcePage
      title="Courses"
      subtitle="Master course templates that schools can adopt and safely customize."
      endpoint="/course-templates"
      columns={[
        {
          key: "name",
          label: "Course Template",
          type: "internalLink",
          path: (course) => `/system-admin/courses/${course.id}/builder`,
        },
        { key: "code", label: "Code" },
        { key: "target_level", label: "Level" },
        { key: "estimated_weeks", label: "Weeks" },
        { key: "course_category", label: "Category" },
        { key: "independent_price_amount", label: "Independent Price" },
        { key: "independent_currency", label: "Currency" },
        { key: "version", label: "Version" },
        { key: "is_active", label: "Active" },
      ]}
      actions={[
        {
          label: "View as Learner",
          color: "info",
          path: (course) => `/system-admin/courses/${course.id}/preview`,
        },
        {
          label: "Reviews",
          color: "dark",
          path: (course) => `/system-admin/courses/${course.id}/reviews`,
        },
      ]}
      formFields={[
        { name: "name", label: "Course title" },
        { name: "code", label: "Course code" },
        { name: "target_level", label: "Target grade or level" },
        { name: "estimated_weeks", label: "Estimated weeks", type: "number" },
        {
          name: "independent_price_amount",
          label: "Independent learner price",
          type: "number",
          defaultValue: 0,
        },
        {
          name: "independent_currency",
          label: "Currency",
          defaultValue: "KES",
        },
        {
          name: "is_active",
          label: "Publishing status",
          type: "boolean",
          defaultValue: false,
          options: [
            { value: false, label: "Draft - visible only to system admin" },
            { value: true, label: "Published - schools can adopt" },
          ],
        },
        { name: "description", label: "Description", fullWidth: true },
      ]}
      createLabel="Create Course"
    />
  );
}

export default SystemAdminCourses;
