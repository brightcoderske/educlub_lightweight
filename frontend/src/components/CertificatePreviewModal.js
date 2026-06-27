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
import { apiClient } from "lib/api";

function CertificatePreviewModal({ open, onClose, certificateId }) {
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (open && certificateId) {
      fetchCertificate();
    }
    // Reset zoom and rotation when modal closes
    if (!open) {
      setZoom(1);
      setRotation(0);
      setError("");
    }
  }, [open, certificateId]);

  const fetchCertificate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get(`/certificates/${certificateId}`);
      setCertificate(response);
    } catch (error) {
      console.error("Failed to fetch certificate:", error);
      setError(error.message || "Failed to fetch certificate.");
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const downloadPdf = async (openForPrint = false) => {
    if (!certificate?.id) return;
    setError("");
    try {
      const { blob, filename } = await apiClient.download(
        `/certificates/download/${certificate.id}`
      );
      const url = URL.createObjectURL(blob);
      if (openForPrint) {
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `educlub-certificate-${certificate.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || "Failed to download certificate.");
    }
  };
  const handleDownload = () => downloadPdf(false);
  const handlePrint = () => downloadPdf(true);

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
              card_membership
            </Icon>
            <MDBox>
              <MDTypography variant="h5" fontWeight="bold">
                Certificate Preview
              </MDTypography>
              {certificate && (
                <MDTypography variant="caption" color="text">
                  {certificate.course_name} - {certificate.learner_name}
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
              Loading certificate...
            </MDTypography>
          </MDBox>
        ) : certificate ? (
          <MDBox>
            {error && (
              <MDTypography variant="caption" color="error" display="block" mb={2}>
                {error}
              </MDTypography>
            )}
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
                    variant="outlined"
                    size="small"
                    onClick={handleRotate}
                    startIcon={<Icon fontSize="small">rotate_right</Icon>}
                  >
                    Rotate
                  </MDButton>
                  <MDButton
                    variant="gradient"
                    color="info"
                    size="small"
                    onClick={handleDownload}
                    startIcon={<DownloadIcon fontSize="small" />}
                  >
                    Download
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

            {/* Certificate Preview */}
            <Card
              sx={{
                p: 2,
                bgcolor: "white",
                minHeight: "500px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                sx={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: "transform 0.3s ease",
                  maxWidth: "100%",
                  maxHeight: "600px",
                  overflow: "auto",
                }}
              >
                <Box
                  sx={{
                    width: "800px",
                    height: "600px",
                    border: "8px solid #d4af37",
                    borderRadius: "8px",
                    p: 4,
                    bgcolor: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  }}
                >
                  {/* Certificate Header */}
                  <Box sx={{ textAlign: "center", mb: 3 }}>
                    <Icon fontSize="large" color="warning" sx={{ mb: 1 }}>
                      emoji_events
                    </Icon>
                    <MDTypography variant="h4" fontWeight="bold" color="dark">
                      Certificate of Completion
                    </MDTypography>
                    <MDTypography variant="body2" color="text">
                      This is to certify that
                    </MDTypography>
                  </Box>

                  {/* Learner Name */}
                  <Box sx={{ textAlign: "center", my: 2 }}>
                    <MDTypography variant="h3" fontWeight="bold" color="primary">
                      {certificate.learner_name}
                    </MDTypography>
                  </Box>

                  {/* Course Info */}
                  <Box sx={{ textAlign: "center", my: 2 }}>
                    <MDTypography variant="body1" color="text">
                      has successfully completed the course
                    </MDTypography>
                    <MDTypography variant="h5" fontWeight="bold" color="dark" sx={{ my: 1 }}>
                      {certificate.course_name}
                    </MDTypography>
                    <MDTypography variant="body2" color="text">
                      on {new Date(certificate.issued_date).toLocaleDateString()}
                    </MDTypography>
                  </Box>

                  {/* Decorative Border */}
                  <Box sx={{ width: "60%", height: "2px", bgcolor: "#d4af37", my: 2 }} />

                  {/* Footer */}
                  <Box sx={{ textAlign: "center", mt: 2 }}>
                    <MDTypography variant="caption" color="text" sx={{ opacity: 0.7 }}>
                      EduClub Learning Management System
                    </MDTypography>
                  </Box>
                </Box>
              </Box>
            </Card>

            {/* Certificate Details */}
            <Card sx={{ mt: 2, p: 3, bgcolor: "white" }}>
              <MDTypography variant="h6" fontWeight="bold" mb={2}>
                Certificate Details
              </MDTypography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <MDBox>
                    <MDTypography variant="caption" color="text" fontWeight="medium">
                      Course
                    </MDTypography>
                    <MDTypography variant="body2">{certificate.course_name}</MDTypography>
                  </MDBox>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MDBox>
                    <MDTypography variant="caption" color="text" fontWeight="medium">
                      Learner
                    </MDTypography>
                    <MDTypography variant="body2">{certificate.learner_name}</MDTypography>
                  </MDBox>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MDBox>
                    <MDTypography variant="caption" color="text" fontWeight="medium">
                      Issued Date
                    </MDTypography>
                    <MDTypography variant="body2">
                      {new Date(certificate.issued_date).toLocaleDateString()}
                    </MDTypography>
                  </MDBox>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MDBox>
                    <MDTypography variant="caption" color="text" fontWeight="medium">
                      Certificate ID
                    </MDTypography>
                    <MDTypography variant="body2">{certificate.id}</MDTypography>
                  </MDBox>
                </Grid>
              </Grid>
            </Card>
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
              Certificate not found
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

export default CertificatePreviewModal;
