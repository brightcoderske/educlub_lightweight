import { useEffect, useState } from "react";
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

function AcademicTable({ title, rows, columns }) {
  return (
    <Card>
      <MDBox p={3}>
        <MDTypography variant="h5" mb={2}>
          {title}
        </MDTypography>
        {rows.length === 0 ? (
          <MDTypography variant="body2" color="text">
            No records yet.
          </MDTypography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ display: "table-header-group" }}>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.key}>{column.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((column) => (
                      <TableCell key={column.key}>{row[column.key] ?? "-"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MDBox>
    </Card>
  );
}

AcademicTable.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  columns: PropTypes.arrayOf(PropTypes.object).isRequired,
};

function SystemAdminAcademic() {
  const { isSystemAdmin } = useAuth();
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [yearForm, setYearForm] = useState({});
  const [termForm, setTermForm] = useState({});
  const [error, setError] = useState("");

  const loadAcademic = async () => {
    const [yearsResponse, termsResponse] = await Promise.all([
      apiClient.get("/academic/years"),
      apiClient.get("/academic/terms"),
    ]);
    setYears(yearsResponse);
    setTerms(termsResponse);
  };

  useEffect(() => {
    if (isSystemAdmin()) {
      loadAcademic().catch((err) => setError(err.message));
    }
  }, []);

  const createYear = async () => {
    await apiClient.post("/academic/years", {
      year: Number(yearForm.year),
      start_date: yearForm.start_date,
      end_date: yearForm.end_date,
      is_active: yearForm.is_active === "true",
    });
    setYearForm({});
    await loadAcademic();
  };

  const createTerm = async () => {
    await apiClient.post("/academic/terms", {
      academic_year_id: Number(termForm.academic_year_id),
      name: termForm.name,
      start_date: termForm.start_date,
      end_date: termForm.end_date,
      is_active: termForm.is_active === "true",
    });
    setTermForm({});
    await loadAcademic();
  };

  if (!isSystemAdmin()) {
    return <MDBox p={3}>Access denied. System Admin only.</MDBox>;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDTypography variant="h3">Academic Years & Terms</MDTypography>
        <MDTypography variant="body2" color="text" mb={3}>
          Manage the year-aware, term-aware, and week-aware academic structure.
        </MDTypography>

        {error && (
          <MDTypography variant="caption" color="error" display="block" mb={2}>
            {error}
          </MDTypography>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Create Academic Year
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      label="Year"
                      type="number"
                      fullWidth
                      value={yearForm.year || ""}
                      onChange={(event) => setYearForm({ ...yearForm, year: event.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      type="date"
                      fullWidth
                      value={yearForm.start_date || ""}
                      onChange={(event) =>
                        setYearForm({ ...yearForm, start_date: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      type="date"
                      fullWidth
                      value={yearForm.end_date || ""}
                      onChange={(event) =>
                        setYearForm({ ...yearForm, end_date: event.target.value })
                      }
                    />
                  </Grid>
                </Grid>
                <MDBox mt={2}>
                  <MDButton variant="gradient" color="info" onClick={createYear}>
                    Create Year
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" mb={2}>
                  Create Term
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      label="Academic Year ID"
                      type="number"
                      fullWidth
                      value={termForm.academic_year_id || ""}
                      onChange={(event) =>
                        setTermForm({ ...termForm, academic_year_id: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      label="Term Name"
                      fullWidth
                      value={termForm.name || ""}
                      onChange={(event) => setTermForm({ ...termForm, name: event.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      type="date"
                      fullWidth
                      value={termForm.start_date || ""}
                      onChange={(event) =>
                        setTermForm({ ...termForm, start_date: event.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      type="date"
                      fullWidth
                      value={termForm.end_date || ""}
                      onChange={(event) =>
                        setTermForm({ ...termForm, end_date: event.target.value })
                      }
                    />
                  </Grid>
                </Grid>
                <MDBox mt={2}>
                  <MDButton variant="gradient" color="info" onClick={createTerm}>
                    Create Term
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <AcademicTable
              title="Academic Years"
              rows={years}
              columns={[
                { key: "id", label: "ID" },
                { key: "year", label: "Year" },
                { key: "start_date", label: "Start" },
                { key: "end_date", label: "End" },
                { key: "is_active", label: "Active" },
              ]}
            />
          </Grid>
          <Grid item xs={12} lg={6}>
            <AcademicTable
              title="Terms"
              rows={terms}
              columns={[
                { key: "id", label: "ID" },
                { key: "academic_year_id", label: "Year ID" },
                { key: "name", label: "Term" },
                { key: "total_weeks", label: "Weeks" },
                { key: "is_active", label: "Active" },
              ]}
            />
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SystemAdminAcademic;
