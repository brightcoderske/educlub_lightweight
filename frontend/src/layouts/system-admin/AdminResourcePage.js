import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString();
  }
  return value;
}

function renderCell(item, column, navigate) {
  const value = item[column.key];

  if (column.type === "internalLink" && value) {
    return (
      <MDTypography
        component="button"
        variant="button"
        color="info"
        fontWeight="medium"
        onClick={() => navigate(column.path(item))}
        sx={{
          background: "none",
          border: 0,
          cursor: "pointer",
          p: 0,
          textAlign: "left",
        }}
      >
        {value}
      </MDTypography>
    );
  }

  if (column.type === "link" && value) {
    return (
      <MDTypography
        component="a"
        href={value}
        target="_blank"
        rel="noreferrer"
        variant="button"
        color="info"
        fontWeight="medium"
      >
        Open
      </MDTypography>
    );
  }

  return formatCell(value);
}

function AdminResourcePage({
  title,
  subtitle,
  endpoint,
  columns,
  formFields,
  createLabel,
  actions,
}) {
  const { isSystemAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(endpoint);
      setItems(Array.isArray(response) ? response : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (isSystemAdmin()) {
      loadItems();
    } else {
      setLoading(false);
    }
  }, [authLoading, user]);

  const handleChange = (name, value, type) => {
    setForm((current) => ({
      ...current,
      [name]: type === "number" && value !== "" ? Number(value) : value,
    }));
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.post(endpoint, form);
      setForm({});
      await loadItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <MDBox p={3}>Loading...</MDBox>;
  }

  if (!isSystemAdmin()) {
    return <MDBox p={3}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <MDTypography variant="h3">{title}</MDTypography>
          <MDTypography variant="body2" color="text">
            {subtitle}
          </MDTypography>
        </MDBox>

        {formFields.length > 0 && (
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h5" mb={2}>
                {createLabel}
              </MDTypography>
              <Grid container spacing={2}>
                {formFields.map((field) => (
                  <Grid item xs={12} md={field.fullWidth ? 12 : 6} key={field.name}>
                    <MDInput
                      label={field.label}
                      type={field.type || "text"}
                      fullWidth
                      value={form[field.name] || ""}
                      onChange={(event) => handleChange(field.name, event.target.value, field.type)}
                    />
                  </Grid>
                ))}
              </Grid>
              {error && (
                <MDTypography variant="caption" color="error" display="block" mt={2}>
                  {error}
                </MDTypography>
              )}
              <MDBox mt={3}>
                <MDButton variant="gradient" color="info" onClick={handleCreate} disabled={saving}>
                  {saving ? "Saving..." : createLabel}
                </MDButton>
              </MDBox>
            </MDBox>
          </Card>
        )}

        <Card sx={{ mt: 3 }}>
          <MDBox p={3}>
            <MDTypography variant="h5" mb={2}>
              Records
            </MDTypography>
            {error && formFields.length === 0 && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {error}
              </MDTypography>
            )}
            {loading ? (
              <MDTypography variant="body2">Loading...</MDTypography>
            ) : items.length === 0 ? (
              <MDTypography variant="body2" color="text">
                No records yet.
              </MDTypography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      {columns.map((column) => (
                        <TableCell key={column.key} sx={{ whiteSpace: "nowrap" }}>
                          {column.label}
                        </TableCell>
                      ))}
                      {actions.length > 0 && <TableCell align="center">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id || JSON.stringify(item)}>
                        {columns.map((column) => (
                          <TableCell key={column.key} sx={{ verticalAlign: "middle" }}>
                            {renderCell(item, column, navigate)}
                          </TableCell>
                        ))}
                        {actions.length > 0 && (
                          <TableCell align="center">
                            <MDBox display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                              {actions.map((action) => (
                                <MDButton
                                  key={action.label}
                                  variant={action.variant || "outlined"}
                                  color={action.color || "info"}
                                  size="small"
                                  onClick={() => navigate(action.path(item))}
                                >
                                  {action.label}
                                </MDButton>
                              ))}
                            </MDBox>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

AdminResourcePage.defaultProps = {
  formFields: [],
  createLabel: "Create",
  actions: [],
};

AdminResourcePage.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  endpoint: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(PropTypes.object).isRequired,
  formFields: PropTypes.arrayOf(PropTypes.object),
  createLabel: PropTypes.string,
  actions: PropTypes.arrayOf(PropTypes.object),
};

export default AdminResourcePage;
