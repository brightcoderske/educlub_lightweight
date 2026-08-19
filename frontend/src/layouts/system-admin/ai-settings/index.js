import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
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

const roleLabels = {
  system_admin: "System Admin",
  school_admin: "School Admin",
  teacher: "Teacher",
  learner: "Learner",
};

const defaultSettings = {
  is_enabled: false,
  default_provider_key: "",
  fallback_provider_key: "",
  max_requests_per_hour: 50,
  max_tokens_per_hour: 100000,
  max_requests_per_day: 250,
  max_tokens_per_day: 500000,
  retain_prompt_days: 0,
  debug_logging_enabled: false,
};

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function SystemAdminAiSettings() {
  const { isSystemAdmin } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [providers, setProviders] = useState([]);
  const [roleLimits, setRoleLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const enabledProviders = useMemo(
    () => providers.filter((provider) => provider.is_enabled),
    [providers]
  );

  const loadSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/ai/settings");
      setSettings({ ...defaultSettings, ...(response.settings || {}) });
      setProviders(response.providers || []);
      setRoleLimits(response.role_limits || []);
    } catch (err) {
      setError(err.message || "Failed to load AI settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSystemAdmin()) {
      loadSettings();
    }
  }, []);

  const updateProvider = (providerKey, changes) => {
    setProviders((current) =>
      current.map((provider) =>
        provider.provider_key === providerKey ? { ...provider, ...changes } : provider
      )
    );
  };

  const updateRoleLimit = (role, changes) => {
    setRoleLimits((current) =>
      current.map((limit) => (limit.role === role ? { ...limit, ...changes } : limit))
    );
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        settings: {
          ...settings,
          max_requests_per_hour: normalizeNumber(settings.max_requests_per_hour),
          max_tokens_per_hour: normalizeNumber(settings.max_tokens_per_hour),
          max_requests_per_day: normalizeNumber(settings.max_requests_per_day),
          max_tokens_per_day: normalizeNumber(settings.max_tokens_per_day),
          retain_prompt_days: Number(settings.retain_prompt_days) || 0,
        },
        providers,
        role_limits: roleLimits,
      };
      const response = await apiClient.put("/ai/settings", payload);
      setSettings({ ...defaultSettings, ...(response.settings || {}) });
      setProviders(response.providers || []);
      setRoleLimits(response.role_limits || []);
      setMessage("AI settings saved.");
    } catch (err) {
      setError(err.message || "Failed to save AI settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSystemAdmin()) {
    return <MDBox p={2}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <MDTypography variant="h3">AI Control Center</MDTypography>
          <MDTypography variant="body2" color="text">
            Configure provider access, global limits, and role permissions before enabling AI tools.
          </MDTypography>
        </MDBox>

        {error && (
          <MDBox mb={2} p={2} borderRadius="lg" bgColor="error">
            <MDTypography variant="button" color="white">
              {error}
            </MDTypography>
          </MDBox>
        )}
        {message && (
          <MDBox mb={2} p={2} borderRadius="lg" bgColor="success">
            <MDTypography variant="button" color="white">
              {message}
            </MDTypography>
          </MDBox>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} lg={4}>
            <Card>
              <MDBox p={2}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <MDBox>
                    <MDTypography variant="h5">Global AI</MDTypography>
                    <MDTypography variant="caption" color="text">
                      Keep this off until providers and limits are ready.
                    </MDTypography>
                  </MDBox>
                  <Chip
                    color={settings.is_enabled ? "success" : "default"}
                    label={settings.is_enabled ? "Enabled" : "Disabled"}
                  />
                </MDBox>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="AI enabled"
                      fullWidth
                      value={settings.is_enabled ? "true" : "false"}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          is_enabled: event.target.value === "true",
                        })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Default provider"
                      fullWidth
                      value={settings.default_provider_key || ""}
                      onChange={(event) =>
                        setSettings({ ...settings, default_provider_key: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="">Choose provider</option>
                      {enabledProviders.map((provider) => (
                        <option key={provider.provider_key} value={provider.provider_key}>
                          {provider.display_name}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      select
                      label="Fallback provider"
                      fullWidth
                      value={settings.fallback_provider_key || ""}
                      onChange={(event) =>
                        setSettings({ ...settings, fallback_provider_key: event.target.value })
                      }
                      SelectProps={{ native: true }}
                    >
                      <option value="">None</option>
                      {enabledProviders.map((provider) => (
                        <option key={provider.provider_key} value={provider.provider_key}>
                          {provider.display_name}
                        </option>
                      ))}
                    </MDInput>
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      label="Requests/hour"
                      type="number"
                      fullWidth
                      value={settings.max_requests_per_hour}
                      onChange={(event) =>
                        setSettings({ ...settings, max_requests_per_hour: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      label="Tokens/hour"
                      type="number"
                      fullWidth
                      value={settings.max_tokens_per_hour}
                      onChange={(event) =>
                        setSettings({ ...settings, max_tokens_per_hour: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      label="Requests/day"
                      type="number"
                      fullWidth
                      value={settings.max_requests_per_day}
                      onChange={(event) =>
                        setSettings({ ...settings, max_requests_per_day: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <MDInput
                      label="Tokens/day"
                      type="number"
                      fullWidth
                      value={settings.max_tokens_per_day}
                      onChange={(event) =>
                        setSettings({ ...settings, max_tokens_per_day: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MDInput
                      label="Prompt retention days"
                      type="number"
                      fullWidth
                      value={settings.retain_prompt_days}
                      onChange={(event) =>
                        setSettings({ ...settings, retain_prompt_days: event.target.value })
                      }
                    />
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
                  Providers
                </MDTypography>
                <Grid container spacing={2}>
                  {providers.map((provider) => (
                    <Grid item xs={12} md={6} key={provider.provider_key}>
                      <MDBox border="1px solid #e9ecef" borderRadius="lg" p={2} height="100%">
                        <MDBox display="flex" justifyContent="space-between" alignItems="center">
                          <MDTypography variant="h6">{provider.display_name}</MDTypography>
                          <Checkbox
                            checked={Boolean(provider.is_enabled)}
                            onChange={(event) =>
                              updateProvider(provider.provider_key, {
                                is_enabled: event.target.checked,
                              })
                            }
                          />
                        </MDBox>
                        <MDTypography variant="caption" color="text">
                          {provider.api_key_configured ? "API key saved" : "No API key saved"}
                        </MDTypography>
                        <Grid container spacing={1.5} mt={1}>
                          <Grid item xs={12}>
                            <MDInput
                              label="Base URL"
                              fullWidth
                              value={provider.base_url || ""}
                              onChange={(event) =>
                                updateProvider(provider.provider_key, {
                                  base_url: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <MDInput
                              label="Default model"
                              fullWidth
                              value={provider.default_model || ""}
                              onChange={(event) =>
                                updateProvider(provider.provider_key, {
                                  default_model: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <MDInput
                              label="Fallback model"
                              fullWidth
                              value={provider.fallback_model || ""}
                              onChange={(event) =>
                                updateProvider(provider.provider_key, {
                                  fallback_model: event.target.value,
                                })
                              }
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <MDInput
                              label="New API key"
                              type="password"
                              fullWidth
                              value={provider.api_key || ""}
                              onChange={(event) =>
                                updateProvider(provider.provider_key, {
                                  api_key: event.target.value,
                                })
                              }
                              placeholder="Leave blank to keep existing key"
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <MDBox display="flex" alignItems="center" gap={1}>
                              <Checkbox
                                checked={Boolean(provider.clear_api_key)}
                                onChange={(event) =>
                                  updateProvider(provider.provider_key, {
                                    clear_api_key: event.target.checked,
                                  })
                                }
                              />
                              <MDTypography variant="caption" color="text">
                                Remove saved API key on save
                              </MDTypography>
                            </MDBox>
                          </Grid>
                        </Grid>
                      </MDBox>
                    </Grid>
                  ))}
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="button" fontWeight="medium" display="block" mb={1}>
                  Role Permissions & Limits
                </MDTypography>
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table
                    sx={{
                      minWidth: 820,
                      tableLayout: "fixed",
                      "& th, & td": {
                        verticalAlign: "middle",
                        borderBottom: "1px solid #eef2f7",
                      },
                      "& th": {
                        color: "#475569",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      },
                    }}
                  >
                    <TableHead sx={{ display: "table-header-group" }}>
                      <TableRow>
                        <TableCell sx={{ width: 180 }}>Role</TableCell>
                        <TableCell align="center" sx={{ width: 96 }}>
                          Enabled
                        </TableCell>
                        <TableCell align="right">Requests/hour</TableCell>
                        <TableCell align="right">Tokens/hour</TableCell>
                        <TableCell align="right">Requests/day</TableCell>
                        <TableCell align="right">Tokens/day</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {roleLimits.map((limit) => (
                        <TableRow key={limit.role}>
                          <TableCell>
                            <MDTypography variant="button" fontWeight="medium">
                              {roleLabels[limit.role] || limit.role}
                            </MDTypography>
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={Boolean(limit.is_enabled)}
                              onChange={(event) =>
                                updateRoleLimit(limit.role, {
                                  is_enabled: event.target.checked,
                                })
                              }
                            />
                          </TableCell>
                          {[
                            "requests_per_hour",
                            "tokens_per_hour",
                            "requests_per_day",
                            "tokens_per_day",
                          ].map((field) => (
                            <TableCell key={field} align="right">
                              <MDInput
                                type="number"
                                fullWidth
                                value={limit[field]}
                                onChange={(event) =>
                                  updateRoleLimit(limit.role, {
                                    [field]: event.target.value,
                                  })
                                }
                                sx={{
                                  maxWidth: 132,
                                  "& input": {
                                    textAlign: "right",
                                    py: 1,
                                  },
                                }}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MDBox>
            </Card>
          </Grid>
        </Grid>

        <MDBox mt={3} display="flex" gap={1}>
          <MDButton
            variant="gradient"
            color="info"
            onClick={saveSettings}
            disabled={loading || saving}
          >
            <Icon>save</Icon>&nbsp;{saving ? "Saving..." : "Save AI Settings"}
          </MDButton>
          <MDButton variant="outlined" color="dark" onClick={loadSettings} disabled={loading}>
            Refresh
          </MDButton>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminAiSettings;
