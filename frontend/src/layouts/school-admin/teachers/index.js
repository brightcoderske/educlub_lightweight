import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardIdentity from "components/DashboardIdentity";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useAuth } from "context/AuthContext";
import { apiClient } from "lib/api";

function Teachers() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "" });
  const [error, setError] = useState("");

  const loadTeachers = () =>
    apiClient
      .get("/users?role=teacher")
      .then(setTeachers)
      .catch((err) => setError(err.message));

  useEffect(() => {
    loadTeachers();
  }, []);

  const save = async () => {
    try {
      setError("");
      await apiClient.post("/users/staff", { ...form, role: "teacher" });
      setOpen(false);
      setForm({ full_name: "", email: "" });
      await loadTeachers();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (teacher) => {
    try {
      await apiClient.put(`/users/${teacher.id}`, {
        full_name: teacher.full_name,
        email: teacher.email,
        username: teacher.username,
        is_active: !teacher.is_active,
      });
      await loadTeachers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <DashboardIdentity
            user={user}
            title="Teachers"
            subtitle={`Teacher accounts for ${user?.schoolName || "your school"}`}
          />
          <MDButton color="info" onClick={() => setOpen(true)}>
            Add Teacher
          </MDButton>
        </MDBox>
        <Card>
          <MDBox p={3}>
            {error && (
              <MDTypography variant="body2" color="error" mb={2}>
                {error}
              </MDTypography>
            )}
            <TableContainer>
              <Table>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email / Username</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>{teacher.full_name}</TableCell>
                      <TableCell>{teacher.email}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={teacher.is_active ? "success" : "default"}
                          label={teacher.is_active ? "Active" : "Inactive"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <MDButton
                          size="small"
                          color={teacher.is_active ? "warning" : "success"}
                          variant="outlined"
                          onClick={() => toggleActive(teacher)}
                        >
                          {teacher.is_active ? "Deactivate" : "Activate"}
                        </MDButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create teacher account</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Teacher name"
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            type="email"
            label="Email address"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <MDTypography variant="caption" color="text">
            The email is the username. The teacher must change the temporary password at first
            login.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton color="dark" variant="text" onClick={() => setOpen(false)}>
            Cancel
          </MDButton>
          <MDButton color="info" onClick={save}>
            Create Teacher
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default Teachers;
