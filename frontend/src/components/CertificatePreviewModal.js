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
                    position: "relative",
                    overflow: "hidden",
                    border: "3px solid #d4af37",
                    p: 5,
                    bgcolor: "#fff",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    color: "#061a3a",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: 180,
                      height: 210,
                      background:
                        "linear-gradient(135deg, #061a3a 0%, #071b3f 70%, transparent 71%)",
                    },
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      right: -35,
                      top: -35,
                      width: 160,
                      height: 160,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle, #061a3a 0 43%, #d4af37 44% 53%, #f5c451 54% 65%, transparent 66%)",
                      boxShadow: "0 8px 22px rgba(6, 26, 58, 0.2)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      left: 24,
                      bottom: 0,
                      width: 320,
                      height: 118,
                      background:
                        "linear-gradient(135deg, #061a3a 0%, #071b3f 58%, #d4af37 59%, #f5c451 62%, transparent 63%)",
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      right: 54,
                      top: 54,
                      width: 78,
                      height: 132,
                      background: "linear-gradient(180deg, #f5c451, #d4af37)",
                      clipPath: "polygon(0 0, 100% 0, 100% 76%, 50% 62%, 0 76%)",
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      right: 42,
                      top: 42,
                      width: 100,
                      height: 100,
                      borderRadius: "50%",
                      border: "8px solid #d4af37",
                      bgcolor: "#061a3a",
                      zIndex: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      px: 1,
                    }}
                  >
                    <MDTypography
                      variant="caption"
                      sx={{ color: "#f5c451", fontWeight: 800, lineHeight: 1.1 }}
                    >
                      EduClub Excellence
                    </MDTypography>
                  </Box>

                  <Box sx={{ position: "relative", zIndex: 1 }}>
                    <Box display="flex" justifyContent="center" alignItems="center" gap={4} mb={4}>
                      <Box display="flex" alignItems="center" gap={2} minWidth={260}>
                        <Box
                          sx={{
                            width: 54,
                            height: 62,
                            borderRadius: 1,
                            bgcolor: "#061a3a",
                            border: "2px solid #d4af37",
                            color: "#f5c451",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 24,
                          }}
                        >
                          {(certificate.school_name || "S").slice(0, 1).toUpperCase()}
                        </Box>
                        <Box textAlign="left">
                          <MDTypography variant="h6" sx={{ color: "#061a3a", fontWeight: 800 }}>
                            {certificate.school_name || "Your School Name"}
                          </MDTypography>
                          <MDTypography
                            variant="caption"
                            sx={{ color: "#b8860b", letterSpacing: 2 }}
                          >
                            LEARN - LEAD - INSPIRE
                          </MDTypography>
                        </Box>
                      </Box>
                      <Box sx={{ width: 1, height: 56, bgcolor: "#98a2b3" }} />
                      <Box textAlign="left" minWidth={230}>
                        <MDTypography variant="h4" sx={{ color: "#061a3a", fontWeight: 800 }}>
                          educlub
                        </MDTypography>
                        <MDTypography variant="caption" sx={{ color: "#b8860b", letterSpacing: 2 }}>
                          LEARN. SHARE. GROW.
                        </MDTypography>
                      </Box>
                    </Box>

                    <Box sx={{ textAlign: "center" }}>
                      <MDTypography
                        variant="h1"
                        sx={{
                          color: "#061a3a",
                          fontSize: "3rem",
                          letterSpacing: 6,
                          fontWeight: 800,
                          mb: 0.5,
                        }}
                      >
                        CERTIFICATE
                      </MDTypography>
                      <MDTypography
                        variant="h5"
                        sx={{ color: "#b8860b", letterSpacing: 5, fontWeight: 500 }}
                      >
                        OF COMPLETION
                      </MDTypography>
                      <MDTypography
                        variant="button"
                        sx={{
                          color: "#061a3a",
                          display: "block",
                          mt: 3,
                          letterSpacing: 1.4,
                        }}
                      >
                        THIS CERTIFICATE IS PROUDLY PRESENTED TO
                      </MDTypography>
                      <MDTypography
                        sx={{
                          color: "#061a3a",
                          fontFamily: "Georgia, serif",
                          fontStyle: "italic",
                          fontSize: "3rem",
                          mt: 1,
                          lineHeight: 1,
                        }}
                      >
                        {certificate.learner_name}
                      </MDTypography>
                      <Box
                        sx={{ width: "52%", height: 1, bgcolor: "#d4af37", mx: "auto", my: 2 }}
                      />
                      <MDTypography variant="body1" sx={{ color: "#667085" }}>
                        for successfully completing
                      </MDTypography>
                      <MDTypography variant="h4" sx={{ color: "#0b1633", fontWeight: 800, mt: 1 }}>
                        {certificate.course_name}
                      </MDTypography>
                      <MDTypography variant="body2" sx={{ color: "#667085", mt: 1.5 }}>
                        {[certificate.term, certificate.academic_year].filter(Boolean).join(" | ")}
                        {certificate.term || certificate.academic_year ? " | " : ""}
                        Issued: {new Date(certificate.issued_date).toLocaleDateString()}
                      </MDTypography>
                    </Box>

                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-end"
                      sx={{ mt: 6, px: 10 }}
                    >
                      <Box textAlign="center">
                        <Box sx={{ width: 150, height: 1, bgcolor: "#0b1633", mb: 1 }} />
                        <MDTypography variant="button" sx={{ color: "#0b1633" }}>
                          School Approval
                        </MDTypography>
                      </Box>
                      <Box
                        sx={{
                          width: 92,
                          height: 92,
                          borderRadius: "50%",
                          bgcolor: "#f5c451",
                          border: "5px solid #d4af37",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          color: "#061a3a",
                          fontWeight: 800,
                          boxShadow: "0 6px 15px rgba(0,0,0,0.18)",
                        }}
                      >
                        TOGETHER WE GROW
                      </Box>
                      <Box textAlign="center">
                        <Box sx={{ width: 150, height: 1, bgcolor: "#0b1633", mb: 1 }} />
                        <MDTypography variant="button" sx={{ color: "#0b1633" }}>
                          EduClub
                        </MDTypography>
                      </Box>
                    </Box>

                    <MDTypography
                      variant="caption"
                      sx={{ color: "#667085", display: "block", textAlign: "center", mt: 3 }}
                    >
                      Certificate ID: CERT-{certificate.id}
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
