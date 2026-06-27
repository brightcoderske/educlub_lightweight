const certificatesService = require("../services/certificates.service");

function sendError(res, error, fallbackMessage) {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || fallbackMessage });
}

async function getAllCertificates(req, res) {
  try {
    const certificates = await certificatesService.getAllCertificates(
      req.query,
      req.user
    );
    res.json(certificates);
  } catch (error) {
    console.error("Get certificates error:", error);
    sendError(res, error, "Failed to get certificates");
  }
}

async function getCertificateById(req, res) {
  try {
    const certificate = await certificatesService.getCertificateById(
      req.params.id,
      req.user
    );
    res.json(certificate);
  } catch (error) {
    console.error("Get certificate error:", error);
    sendError(res, error, "Failed to get certificate");
  }
}

async function generateCertificate(req, res) {
  try {
    const certificate = await certificatesService.generateCertificate(
      req.body,
      req.user
    );
    res.status(201).json(certificate);
  } catch (error) {
    console.error("Generate certificate error:", error);
    sendError(res, error, "Failed to generate certificate");
  }
}

async function downloadCertificate(req, res) {
  try {
    const { filename, buffer } =
      await certificatesService.downloadCertificatePdf(req.params.id, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Download certificate error:", error);
    sendError(res, error, "Failed to download certificate");
  }
}

async function approveCertificate(req, res) {
  try {
    const certificate = await certificatesService.approveCertificate(
      req.params.id,
      req.user.userId,
      req.user
    );
    res.json(certificate);
  } catch (error) {
    console.error("Approve certificate error:", error);
    sendError(res, error, "Failed to approve certificate");
  }
}

module.exports = {
  getAllCertificates,
  getCertificateById,
  generateCertificate,
  downloadCertificate,
  approveCertificate,
};
