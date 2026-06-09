import AdminResourcePage from "layouts/system-admin/AdminResourcePage";

function SystemAdminCertificates() {
  return (
    <AdminResourcePage
      title="Certificates"
      subtitle="Track certificates issued from course completion or admin approval."
      endpoint="/certificates"
      columns={[
        { key: "learner_id", label: "Learner ID" },
        { key: "course_id", label: "Course ID" },
        { key: "term", label: "Term" },
        { key: "academic_year", label: "Year" },
        { key: "completion_status", label: "Completion" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Created" },
      ]}
    />
  );
}

export default SystemAdminCertificates;
