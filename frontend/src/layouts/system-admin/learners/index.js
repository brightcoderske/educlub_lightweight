import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Autocomplete from "@mui/material/Autocomplete";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import LearnerDetailModal from "components/LearnerDetailModal";
import { getCachedPage, setCachedPage } from "lib/pageCache";

const emptyForm = {
  school: null,
  first_name: "",
  second_name: "",
  third_name: "",
};

const CACHE_KEY = "system-admin:learners";

function SystemAdminLearners() {
  const { isSystemAdmin } = useAuth();
  const cachedData = getCachedPage(CACHE_KEY)?.value;
  const [schools, setSchools] = useState(() => cachedData?.schools || []);
  const [learners, setLearners] = useState(() => cachedData?.learners || []);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!cachedData);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState(null);
  const [supportLearner, setSupportLearner] = useState(null);
  const [supportAllocations, setSupportAllocations] = useState([]);
  const [supportDrafts, setSupportDrafts] = useState({});
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportError, setSupportError] = useState("");

  const loadData = async (background = false) => {
    const cached = getCachedPage(CACHE_KEY)?.value;
    if (cached && !background) {
      setSchools(cached.schools || []);
      setLearners(cached.learners || []);
    }
    setLoading(!cached && !background);
    setError("");
    try {
      const [schoolsRes, learnersRes] = await Promise.all([
        apiClient.get("/schools"),
        apiClient.get("/learners"),
      ]);
      setSchools(schoolsRes);
      setLearners(learnersRes);
      setCachedPage(CACHE_KEY, { schools: schoolsRes, learners: learnersRes });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSystemAdmin()) loadData();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiClient.post("/learners", {
        school_id: form.school?.id,
        first_name: form.first_name,
        second_name: form.second_name,
        third_name: form.third_name,
      });
      setMessage(`Learner created. Username: ${result.username}`);
      setForm(emptyForm);
      await loadData(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetLearnerByEmail = async (learner) => {
    if (!learner.user_id) {
      setError("Learner login account is not linked yet.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const result = await apiClient.put(`/users/${learner.user_id}/reset-password-email`, {});
      setMessage(result.message || "Password reset email sent.");
    } catch (err) {
      setError(err.message);
    }
  };

  const resetLearnerPassword = async (learnerId, temporaryPassword = "") => {
    setError("");
    setMessage("");
    try {
      const result = await apiClient.put(`/learners/${learnerId}/reset-password`, {
        temporary_password: temporaryPassword,
      });
      const nextMessage = result.temporaryPassword
        ? `${result.message} Temporary password: ${result.temporaryPassword}`
        : result.message;
      setMessage(nextMessage);
      return nextMessage;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const loadSupportAllocations = async (learner) => {
    setSupportLearner(learner);
    setSupportAllocations([]);
    setSupportDrafts({});
    setSupportMessage("");
    setSupportError("");
    if (!learner) return;
    setSupportLoading(true);
    try {
      const allocations = await apiClient.get(`/allocations?learner_id=${learner.id}&category=all`);
      setSupportAllocations(allocations);
      setSupportDrafts(
        allocations.reduce((acc, allocation) => {
          acc[allocation.id] = {
            access_level: "paid",
            payment_reference: allocation.payment_reference || "",
            note: "",
          };
          return acc;
        }, {})
      );
    } catch (err) {
      setSupportError(err.message);
    } finally {
      setSupportLoading(false);
    }
  };

  const updateSupportDraft = (allocationId, field, value) => {
    setSupportDrafts((current) => ({
      ...current,
      [allocationId]: {
        ...(current[allocationId] || {
          access_level: "paid",
          payment_reference: "",
          note: "",
        }),
        [field]: value,
      },
    }));
  };

  const grantManualAccess = async (allocation) => {
    const draft = supportDrafts[allocation.id] || {};
    setSupportError("");
    setSupportMessage("");
    try {
      const updated = await apiClient.post(`/allocations/${allocation.id}/manual-access`, {
        access_level: draft.access_level || "paid",
        payment_reference: draft.payment_reference,
        note: draft.note,
      });
      setSupportAllocations((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );
      setSupportMessage(
        `${allocation.course_name} access updated for ${supportLearner?.full_name}.`
      );
    } catch (err) {
      setSupportError(err.message);
    }
  };

  if (!isSystemAdmin()) {
    return <MDBox p={2}>Access denied. System Admin only.</MDBox>;
  }

  const filteredLearners = learners.filter((learner) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      learner.full_name?.toLowerCase().includes(query) ||
      learner.username?.toLowerCase().includes(query) ||
      learner.email?.toLowerCase().includes(query);
    const matchesSchool = !schoolFilter || learner.school_id === schoolFilter.id;

    return matchesSearch && matchesSchool;
  });
  const independentSchoolIds = new Set(
    schools
      .filter((school) => {
        const name = String(school.name || "").toLowerCase();
        const code = String(school.code || "").toLowerCase();
        return (
          school.is_independent_school === true ||
          code === "educlub-independent" ||
          name.includes("independent learners")
        );
      })
      .map((school) => school.id)
  );
  const independentLearners = learners.filter((learner) =>
    independentSchoolIds.has(learner.school_id)
  );

  return (
    <DashboardLayout>
      <DashboardNavbar
        title="Learners"
        subtitle="Register learner accounts with school and name only. School Admins can complete the profile later."
      />
      <MDBox py={2}>
        <Card>
          <MDBox p={2}>
            <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
              Register Learner
            </MDTypography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={schools}
                  getOptionLabel={(option) => `${option.name} (${option.code})`}
                  value={form.school}
                  onChange={(_, value) => setForm((current) => ({ ...current, school: value }))}
                  renderInput={(params) => <MDInput {...params} label="School" />}
                />
              </Grid>
              {[
                ["first_name", "First Name"],
                ["second_name", "Second Name"],
                ["third_name", "Third Name"],
              ].map(([name, label]) => (
                <Grid item xs={12} md={name === "third_name" ? 12 : 6} key={name}>
                  <MDInput
                    label={label}
                    fullWidth
                    value={form[name]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [name]: event.target.value }))
                    }
                  />
                </Grid>
              ))}
            </Grid>
            {message && (
              <MDTypography variant="caption" color="success" display="block" mt={2}>
                {message}
              </MDTypography>
            )}
            {error && (
              <MDTypography variant="caption" color="error" display="block" mt={2}>
                {error}
              </MDTypography>
            )}
            <MDBox mt={3}>
              <MDButton
                variant="gradient"
                color="info"
                onClick={handleCreate}
                disabled={saving || !form.school || !form.first_name || !form.second_name}
              >
                {saving ? "Registering..." : "Register Learner"}
              </MDButton>
            </MDBox>
          </MDBox>
        </Card>

        <Card sx={{ mt: 3 }}>
          <MDBox p={2}>
            <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
              Learner Accounts
            </MDTypography>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={6}>
                <MDInput
                  label="Search learner, username, or email"
                  fullWidth
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={schools}
                  getOptionLabel={(option) => `${option.name} (${option.code})`}
                  value={schoolFilter}
                  onChange={(_, value) => setSchoolFilter(value)}
                  renderInput={(params) => <MDInput {...params} label="Filter by school" />}
                />
              </Grid>
            </Grid>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              Showing {filteredLearners.length} of {learners.length} learners
            </MDTypography>
            {loading ? (
              <MDTypography variant="body2">Loading...</MDTypography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Learner</TableCell>
                      <TableCell>Username</TableCell>
                      <TableCell>School</TableCell>
                      <TableCell>Grade</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell align="center">Password</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLearners.map((learner) => (
                      <TableRow key={learner.id}>
                        <TableCell>
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => setSelectedLearnerId(learner.id)}
                          >
                            {learner.full_name}
                          </MDButton>
                        </TableCell>
                        <TableCell>{learner.username || "-"}</TableCell>
                        <TableCell>{learner.school_name}</TableCell>
                        <TableCell>{learner.grade || "-"}</TableCell>
                        <TableCell>{learner.stream || "-"}</TableCell>
                        <TableCell align="center">
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => resetLearnerByEmail(learner)}
                          >
                            Email Reset
                          </MDButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </MDBox>
        </Card>

        <Card sx={{ mt: 3 }}>
          <MDBox p={2}>
            <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
              Independent Learner Payment Support
            </MDTypography>
            <MDTypography variant="body2" color="text" mb={2}>
              Use this only after confirming the payment in Flutterwave. The action unlocks the
              existing course allocation and records an audit note.
            </MDTypography>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={7}>
                <Autocomplete
                  options={independentLearners}
                  getOptionLabel={(option) =>
                    `${option.full_name} - ${option.username || option.email || "no login"}`
                  }
                  value={supportLearner}
                  onChange={(_, value) => loadSupportAllocations(value)}
                  renderInput={(params) => <MDInput {...params} label="Find learner" />}
                />
              </Grid>
            </Grid>
            {supportMessage && (
              <MDTypography variant="caption" color="success" display="block" mb={2}>
                {supportMessage}
              </MDTypography>
            )}
            {supportError && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {supportError}
              </MDTypography>
            )}
            {supportLoading ? (
              <MDTypography variant="body2">Loading learner allocations...</MDTypography>
            ) : supportLearner && supportAllocations.length === 0 ? (
              <MDTypography variant="body2" color="text">
                No course allocations found for this learner.
              </MDTypography>
            ) : supportLearner ? (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell>Course</TableCell>
                      <TableCell>Access</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Grant as</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell>Note</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {supportAllocations.map((allocation) => {
                      const draft = supportDrafts[allocation.id] || {};
                      const currency = allocation.independent_currency || "KES";
                      const amount = Number(allocation.independent_price_amount || 0);
                      return (
                        <TableRow key={allocation.id}>
                          <TableCell>{allocation.course_name}</TableCell>
                          <TableCell>{allocation.access_level || "paid"}</TableCell>
                          <TableCell>
                            {currency} {amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <MDInput
                              select
                              fullWidth
                              value={draft.access_level || "paid"}
                              onChange={(event) =>
                                updateSupportDraft(
                                  allocation.id,
                                  "access_level",
                                  event.target.value
                                )
                              }
                              SelectProps={{ native: true }}
                            >
                              <option value="paid">Paid</option>
                              <option value="grant">Admin Grant</option>
                              <option value="scholarship">Scholarship</option>
                            </MDInput>
                          </TableCell>
                          <TableCell>
                            <MDInput
                              fullWidth
                              placeholder="Flutterwave ref"
                              value={draft.payment_reference || ""}
                              onChange={(event) =>
                                updateSupportDraft(
                                  allocation.id,
                                  "payment_reference",
                                  event.target.value
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <MDInput
                              fullWidth
                              placeholder="Reason / support note"
                              value={draft.note || ""}
                              onChange={(event) =>
                                updateSupportDraft(allocation.id, "note", event.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell align="center">
                            <MDButton
                              variant="gradient"
                              color="success"
                              size="small"
                              onClick={() => grantManualAccess(allocation)}
                              disabled={
                                !draft.note ||
                                (draft.access_level === "paid" && !draft.payment_reference)
                              }
                            >
                              Unlock
                            </MDButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <MDTypography variant="body2" color="text">
                Choose a learner to review their course payment access.
              </MDTypography>
            )}
          </MDBox>
        </Card>
      </MDBox>
      <LearnerDetailModal
        open={Boolean(selectedLearnerId)}
        learnerId={selectedLearnerId}
        onClose={() => setSelectedLearnerId(null)}
        onResetPassword={resetLearnerPassword}
      />
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminLearners;
