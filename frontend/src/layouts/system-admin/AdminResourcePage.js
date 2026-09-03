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
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";
import { getCachedPage, setCachedPage } from "lib/pageCache";

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

  // A column can render itself when one cell is really two fields - a price and
  // its currency, say - so the table does not need a column for each.
  if (typeof column.render === "function") {
    return column.render(item);
  }

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
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Several actions per row grew every row to three lines. Edit stays visible;
  // the rest live behind this menu.
  const [rowMenu, setRowMenu] = useState({ anchor: null, item: null });

  const cacheKey = `system-admin-resource:${endpoint}`;

  const loadItems = async (background = false) => {
    const cached = getCachedPage(cacheKey)?.value;
    if (cached && !background) {
      setItems(cached);
    }
    setLoading(!cached && !background);
    setError("");
    try {
      const response = await apiClient.get(endpoint);
      const nextItems = Array.isArray(response) ? response : [];
      setItems(nextItems);
      setCachedPage(cacheKey, nextItems);
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
  }, [authLoading, user, endpoint]);

  const handleChange = (name, value, type) => {
    setForm((current) => ({
      ...current,
      [name]:
        type === "number" && value !== ""
          ? Number(value)
          : type === "boolean"
          ? value === "true"
          : value,
    }));
  };

  const resetForm = () => {
    setForm({});
    setEditingId(null);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm(
      formFields.reduce((record, field) => {
        record[field.name] =
          item[field.name] !== undefined && item[field.name] !== null
            ? item[field.name]
            : field.defaultValue ?? "";
        return record;
      }, {})
    );
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await apiClient.put(`${endpoint}/${editingId}`, form);
      } else {
        await apiClient.post(endpoint, form);
      }
      resetForm();
      await loadItems(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <MDBox p={2}>Loading...</MDBox>;
  }

  if (!isSystemAdmin()) {
    return <MDBox p={2}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar title={title} subtitle={subtitle} />
      <MDBox py={2}>
        {formFields.length > 0 && (
          <Card>
            <MDBox p={2}>
              <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
                {createLabel}
              </MDTypography>
              <Grid container spacing={2}>
                {formFields.map((field) => {
                  const hasDefault = Object.prototype.hasOwnProperty.call(field, "defaultValue");
                  const value =
                    form[field.name] !== undefined
                      ? form[field.name]
                      : hasDefault
                      ? field.defaultValue
                      : "";
                  return (
                    <Grid item xs={12} md={field.fullWidth ? 12 : 6} key={field.name}>
                      <MDInput
                        select={Boolean(field.options)}
                        label={field.label}
                        type={field.options ? undefined : field.type || "text"}
                        fullWidth
                        value={String(value)}
                        SelectProps={field.options ? { native: true } : undefined}
                        InputLabelProps={field.options ? { shrink: true } : undefined}
                        onChange={(event) =>
                          handleChange(field.name, event.target.value, field.type)
                        }
                      >
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </MDInput>
                    </Grid>
                  );
                })}
              </Grid>
              {error && (
                <MDTypography variant="caption" color="error" display="block" mt={2}>
                  {error}
                </MDTypography>
              )}
              <MDBox mt={3}>
                <MDButton variant="gradient" color="info" onClick={handleCreate} disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save Changes" : createLabel}
                </MDButton>
                {editingId && (
                  <MDButton variant="text" color="secondary" onClick={resetForm} sx={{ ml: 1 }}>
                    Cancel
                  </MDButton>
                )}
              </MDBox>
            </MDBox>
          </Card>
        )}

        <Card sx={{ mt: 2 }}>
          <MDBox p={2}>
            <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
              Records
            </MDTypography>
            {error && formFields.length === 0 && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {error}
              </MDTypography>
            )}
            {loading ? (
              <MDTypography variant="caption" color="text">
                Loading…
              </MDTypography>
            ) : items.length === 0 ? (
              <MDTypography variant="caption" color="text">
                No records yet.
              </MDTypography>
            ) : (
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      {columns.map((column) => (
                        <TableCell key={column.key} sx={{ whiteSpace: "nowrap" }}>
                          {column.label}
                        </TableCell>
                      ))}
                      {(actions.length > 0 || formFields.length > 0) && (
                        <TableCell align="right">Actions</TableCell>
                      )}
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
                        {(actions.length > 0 || formFields.length > 0) && (
                          <TableCell align="right">
                            <MDBox
                              display="flex"
                              gap={0.5}
                              justifyContent="flex-end"
                              alignItems="center"
                              flexWrap="nowrap"
                            >
                              {formFields.length > 0 && (
                                <MDButton
                                  variant="text"
                                  color="info"
                                  size="small"
                                  onClick={() => startEdit(item)}
                                >
                                  Edit
                                </MDButton>
                              )}
                              {actions.length > 0 && (
                                <IconButton
                                  size="small"
                                  aria-label="More actions"
                                  onClick={(event) =>
                                    setRowMenu({ anchor: event.currentTarget, item })
                                  }
                                >
                                  <Icon fontSize="small">more_vert</Icon>
                                </IconButton>
                              )}
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
      <Menu
        anchorEl={rowMenu.anchor}
        open={Boolean(rowMenu.anchor)}
        onClose={() => setRowMenu({ anchor: null, item: null })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            onClick={() => {
              navigate(action.path(rowMenu.item));
              setRowMenu({ anchor: null, item: null });
            }}
          >
            {action.label}
          </MenuItem>
        ))}
      </Menu>
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
