import { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import { apiClient } from "lib/api";

function ResultSlipPreviewModal({ open, onClose, learnerId, term, academicYear }) {
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open && learnerId && term && academicYear) {
      fetchResultSlip();
    }
    // Reset zoom when modal closes
    if (!open) {
      setZoom(1);
    }
  }, [open, learnerId, term, academicYear]);

  const fetchResultSlip = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        `/reports/result-slip/${learnerId}?term=${term}&academicYear=${academicYear}`
      );
      setResultData(response);
    } catch (error) {
      console.error("Failed to fetch result slip:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));
  const handleDownload = () => {
    if (resultData?.download_url) {
      window.open(resultData.download_url, "_blank", "noopener,noreferrer");
    }
  };
  const handlePrint = () => {
    window.print();
  };

  const getGradeColor = (grade) => {
    if (grade >= 80) return "success";
    if (grade >= 60) return "info";
    if (grade >= 50) return "warning";
    return "error";
  };

  const getGradeLabel = (grade) => {
    if (grade >= 80) return "A";
    if (grade >= 70) return "B";
    if (grade >= 60) return "C";
    if (grade >= 50) return "D";
    return "E";
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: "95vh",
          bgcolor: "#f8f9fa",
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, bgcolor: "white", borderBottom: "1px solid #e0e0e0" }}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center">
          <MDBox display="flex" alignItems="center" gap={2}>
            <Icon fontSize="medium" color="primary">
              assessment
            </Icon>
            <MDBox>
              <MDTypography variant="h5" fontWeight="bold">
                Result Slip
              </MDTypography>
              {resultData && (
                <MDTypography variant="caption" color="text">
                  {term} - {academicYear}
                </MDTypography>
              )}
            </MDBox>
          </MDBox>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </MDBox>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loading ? (
          <MDBox
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            py={8}
          >
            <Icon fontSize="large" color="info" sx={{ mb: 2 }}>
              hourglass_empty
            </Icon>
            <MDTypography variant="body2" color="text">
              Loading result slip...
            </MDTypography>
          </MDBox>
        ) : resultData ? (
          <MDBox>
            {/* Toolbar */}
            <Card sx={{ mb: 2, p: 2, bgcolor: "white" }}>
              <MDBox
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                gap={1}
              >
                <MDBox display="flex" alignItems="center" gap={1}>
                  <MDButton
                    variant="outlined"
                    size="small"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                  >
                    <ZoomOutIcon fontSize="small" />
                  </MDButton>
                  <MDTypography variant="body2" sx={{ minWidth: 50, textAlign: "center" }}>
                    {Math.round(zoom * 100)}%
                  </MDTypography>
                  <MDButton
                    variant="outlined"
                    size="small"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                  >
                    <ZoomInIcon fontSize="small" />
                  </MDButton>
                </MDBox>
                <MDBox display="flex" gap={1}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    size="small"
                    onClick={handleDownload}
                    startIcon={<DownloadIcon fontSize="small" />}
                  >
                    Download PDF
                  </MDButton>
                  <MDButton
                    variant="gradient"
                    color="success"
                    size="small"
                    onClick={handlePrint}
                    startIcon={<PrintIcon fontSize="small" />}
                  >
                    Print
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>

            {/* Result Slip Preview */}
            <Box
              sx={{
                transform: `scale(${zoom})`,
                transition: "transform 0.3s ease",
                transformOrigin: "top center",
              }}
            >
              <Card sx={{ p: 4, bgcolor: "white", maxWidth: "800px", mx: "auto" }}>
                {/* Header */}
                <MDBox mb={3} textAlign="center">
                  <Icon fontSize="large" color="primary" sx={{ mb: 1 }}>
                    school
                  </Icon>
                  <MDTypography variant="h4" fontWeight="bold" color="dark">
                    Result Slip
                  </MDTypography>
                  <MDTypography variant="body2" color="text">
                    {term} Term - {academicYear}
                  </MDTypography>
                </MDBox>

                <Divider sx={{ my: 2 }} />

                {/* Student Info */}
                <Grid container spacing={2} mb={3}>
                  <Grid item xs={6}>
                    <MDBox>
                      <MDTypography variant="caption" color="text" fontWeight="medium">
                        Student Name
                      </MDTypography>
                      <MDTypography variant="body2" fontWeight="bold">
                        {resultData.learner_name}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={6}>
                    <MDBox>
                      <MDTypography variant="caption" color="text" fontWeight="medium">
                        Admission Number
                      </MDTypography>
                      <MDTypography variant="body2">
                        {resultData.admission_number || "N/A"}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={6}>
                    <MDBox>
                      <MDTypography variant="caption" color="text" fontWeight="medium">
                        Grade/Stream
                      </MDTypography>
                      <MDTypography variant="body2">
                        {resultData.grade} - {resultData.stream}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                  <Grid item xs={6}>
                    <MDBox>
                      <MDTypography variant="caption" color="text" fontWeight="medium">
                        Date Issued
                      </MDTypography>
                      <MDTypography variant="body2">{new Date().toLocaleDateString()}</MDTypography>
                    </MDBox>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                {/* Results Table */}
                <MDBox mb={3}>
                  <MDTypography variant="h6" fontWeight="bold" mb={2}>
                    Subject Results
                  </MDTypography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "info.main" }}>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Subject</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }} align="center">
                            Score
                          </TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }} align="center">
                            Grade
                          </TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }} align="center">
                            Remarks
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {resultData.subjects?.map((subject, index) => (
                          <TableRow key={index} hover>
                            <TableCell>{subject.name}</TableCell>
                            <TableCell align="center">
                              <MDTypography variant="body2" fontWeight="bold">
                                {subject.score}%
                              </MDTypography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={getGradeLabel(subject.score)}
                                color={getGradeColor(subject.score)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <MDTypography
                                variant="caption"
                                color={subject.score >= 50 ? "success" : "error"}
                              >
                                {subject.score >= 50 ? "Pass" : "Fail"}
                              </MDTypography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </MDBox>

                {/* Summary */}
                <Card sx={{ p: 3, bgcolor: "grey.50" }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <MDBox>
                        <MDTypography variant="caption" color="text" fontWeight="medium">
                          Total Score
                        </MDTypography>
                        <MDTypography variant="h5" fontWeight="bold" color="primary">
                          {resultData.total_score || 0}%
                        </MDTypography>
                      </MDBox>
                    </Grid>
                    <Grid item xs={6}>
                      <MDBox>
                        <MDTypography variant="caption" color="text" fontWeight="medium">
                          Overall Grade
                        </MDTypography>
                        <MDTypography variant="h5" fontWeight="bold" color="success">
                          {getGradeLabel(resultData.total_score || 0)}
                        </MDTypography>
                      </MDBox>
                    </Grid>
                    <Grid item xs={6}>
                      <MDBox>
                        <MDTypography variant="caption" color="text" fontWeight="medium">
                          Class Position
                        </MDTypography>
                        <MDTypography variant="body2">
                          {resultData.class_position || "N/A"}
                        </MDTypography>
                      </MDBox>
                    </Grid>
                    <Grid item xs={6}>
                      <MDBox>
                        <MDTypography variant="caption" color="text" fontWeight="medium">
                          Attendance
                        </MDTypography>
                        <MDTypography variant="body2">
                          {resultData.attendance || "N/A"}%
                        </MDTypography>
                      </MDBox>
                    </Grid>
                  </Grid>
                </Card>

                {/* Footer */}
                <MDBox mt={3} pt={2} borderTop="1px solid #e0e0e0" textAlign="center">
                  <MDTypography variant="caption" color="text" sx={{ opacity: 0.7 }}>
                    This result slip is computer-generated and does not require a signature.
                    Generated by EduClub Learning Management System.
                  </MDTypography>
                </MDBox>
              </Card>
            </Box>
          </MDBox>
        ) : (
          <MDBox
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            py={8}
          >
            <Icon fontSize="large" color="error" sx={{ mb: 2 }}>
              error_outline
            </Icon>
            <MDTypography variant="body2" color="text">
              Result slip not found
            </MDTypography>
          </MDBox>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0, bgcolor: "white", borderTop: "1px solid #e0e0e0" }}>
        <MDButton onClick={onClose} color="info" variant="gradient">
          Close
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

export default ResultSlipPreviewModal;
