import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import useMediaQuery from "@mui/material/useMediaQuery";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import PopulationTrend from "components/PopulationTrend";
import { apiClient } from "lib/api";
import API_BASE_URL from "lib/apiBase";
import { useAppPalette } from "lib/appTheme";

function formatMoney(amount, currency) {
  const value = Number(amount) || 0;
  return `${currency || "KES"} ${value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatWhen(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// audit_logs stores machine-shaped action names. This is the only place a
// custodian reads them, so they are humanised here rather than in the database.
function readableAction(action) {
  return String(action || "")
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

/**
 * Everything a system administrator needs to look after one school as a
 * customer: how many learners it enrolled each term, what it has been invoiced,
 * what has happened inside it, and whether its access is on or off.
 */
function SchoolCustodyModal({ open, onClose, school, onSchoolChanged }) {
  const palette = useAppPalette();
  const fullScreen = useMediaQuery("(max-width:900px)");
  const [tab, setTab] = useState(0);
  const [enrollments, setEnrollments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [rate, setRate] = useState("");
  const [term, setTerm] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [reason, setReason] = useState("");
  const [kraPin, setKraPin] = useState("");
  const [identity, setIdentity] = useState(null);
  const [paying, setPaying] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("M-Pesa");
  const [paymentReference, setPaymentReference] = useState("");

  const schoolId = school?.id;

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError("");
    try {
      const [enrollmentsRes, invoicesRes, activityRes, identityRes] = await Promise.all([
        apiClient.get(`/schools/${schoolId}/enrollments`).catch(() => []),
        apiClient.get(`/schools/${schoolId}/invoices`).catch(() => []),
        apiClient.get(`/schools/${schoolId}/activity?limit=40`).catch(() => []),
        apiClient.get("/schools/billing-identity").catch(() => null),
      ]);
      setIdentity(identityRes);
      setEnrollments(Array.isArray(enrollmentsRes) ? enrollmentsRes : []);
      setInvoices(Array.isArray(invoicesRes) ? invoicesRes : []);
      setActivity(Array.isArray(activityRes) ? activityRes : []);

      // Default the invoice form to the term the school is actually in, so the
      // common case needs no typing.
      const current =
        enrollmentsRes?.find((row) => row.is_current) ||
        enrollmentsRes?.[enrollmentsRes.length - 1];
      if (current) {
        setTerm((value) => value || current.term);
        setAcademicYear((value) => value || String(current.academic_year));
      }
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (open) {
      setRate(school?.invoice_rate_per_learner ?? "");
      setKraPin(school?.kra_pin || "");
      setReason(school?.suspension_reason || "");
      setMessage("");
      load();
    }
  }, [open, schoolId, load]);

  const run = async (work, successMessage) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await work();
      if (successMessage) setMessage(successMessage);
      await load();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveRate = () =>
    run(async () => {
      const updated = await apiClient.put(`/schools/${schoolId}/billing-rate`, {
        rate_per_learner: rate === "" ? null : Number(rate),
        kra_pin: kraPin,
      });
      onSchoolChanged?.(updated);
      return updated;
    }, "Billing rate saved.");

  const issueInvoice = () =>
    run(
      () =>
        apiClient.post(`/schools/${schoolId}/invoices`, {
          term,
          academic_year: Number(academicYear),
        }),
      "Invoice issued."
    );

  const setStatus = (invoice, status, extra = {}) =>
    run(() => apiClient.put(`/schools/invoices/${invoice.id}/status`, { status, ...extra }));

  const confirmPayment = async () => {
    await setStatus(paying, "paid", {
      payment_method: paymentMethod,
      payment_reference: paymentReference,
    });
    setPaying(null);
    setPaymentReference("");
  };

  const saveIdentity = (patch) =>
    run(async () => {
      const next = await apiClient.put("/schools/billing-identity", {
        ...identity,
        ...patch,
      });
      setIdentity(next);
      return next;
    }, "Billing identity saved.");

  const toggleSuspension = () => {
    const suspending = school?.is_active !== false;
    return run(
      async () => {
        const updated = await apiClient.put(`/schools/${schoolId}/suspension`, {
          suspended: suspending,
          reason,
        });
        onSchoolChanged?.(updated);
        return updated;
      },
      suspending ? "School access paused." : "School access restored."
    );
  };

  // An <a href> cannot carry the bearer token, so the PDF is fetched and opened
  // from a blob URL - the same approach the report card print uses.
  const printDocument = async (invoice, kind) => {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/schools/invoices/${invoice.id}/${kind}.pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Could not generate the ${kind}.`);
      }
      const url = window.URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch (err) {
      setError(err.message);
    }
  };

  const suspended = school?.is_active === false;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      aria-labelledby="school-custody-title"
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : "14px",
          bgcolor: palette.surface,
          backgroundImage: "none",
          color: palette.text,
          "& .MuiTypography-root": { color: palette.text },
          "& .MuiTypography-caption, & .MuiTypography-body2": { color: palette.textMuted },
          "& .MuiCard-root": {
            bgcolor: palette.surface,
            backgroundImage: "none",
            border: `1px solid ${palette.border}`,
            boxShadow: "none",
          },
          "& .MuiTableCell-head": {
            bgcolor: palette.surfaceSunken,
            color: palette.textMuted,
            fontWeight: 700,
          },
          "& .MuiTableCell-body": { borderColor: palette.borderSoft, color: palette.text },
          "& .MuiOutlinedInput-root": { bgcolor: palette.surface, color: palette.text },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: palette.border },
          "& .MuiInputLabel-root, & .MuiInputBase-input": { color: palette.text },
        },
      }}
    >
      <DialogTitle id="school-custody-title" sx={{ pb: 0.5 }}>
        <MDBox display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <MDBox minWidth={0}>
            <MDTypography variant="h6" fontWeight="bold">
              {school?.name || "School"}
            </MDTypography>
            <MDBox display="flex" gap={0.75} mt={0.5} flexWrap="wrap">
              <Chip size="small" label={school?.code || "-"} />
              <Chip
                size="small"
                color={suspended ? "error" : "success"}
                label={suspended ? "Access paused" : "Active"}
              />
            </MDBox>
          </MDBox>
          <IconButton onClick={onClose} size="small" aria-label="Close">
            <Icon>close</Icon>
          </IconButton>
        </MDBox>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Tabs value={tab} onChange={(event, value) => setTab(value)} sx={{ mb: 1.5 }}>
          <Tab label="Enrolments" />
          <Tab label="Invoices" />
          <Tab label="Activity" />
          <Tab label="Access" />
        </Tabs>

        {message && (
          <MDTypography role="status" variant="caption" color="success" display="block" mb={1}>
            {message}
          </MDTypography>
        )}
        {error && (
          <MDTypography role="alert" variant="caption" color="error" display="block" mb={1}>
            {error}
          </MDTypography>
        )}

        {tab === 0 && (
          <>
            <PopulationTrend population={enrollments} loading={loading} />
            <TableContainer sx={{ mt: 1.5, maxHeight: 260, overflowX: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Term</TableCell>
                    <TableCell>Year</TableCell>
                    <TableCell align="right">Learners</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enrollments.map((row) => (
                    <TableRow key={`${row.academic_year}-${row.term}`}>
                      <TableCell>
                        {row.term}
                        {row.is_current && (
                          <Chip size="small" color="success" label="Current" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>{row.academic_year}</TableCell>
                      <TableCell align="right">{row.learner_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {tab === 1 && (
          <>
            <MDBox display="flex" gap={1} flexWrap="wrap" alignItems="center" mb={1.5}>
              <MDInput
                label="Rate per learner"
                type="number"
                size="small"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                sx={{ maxWidth: 170 }}
              />
              <MDInput
                label="School KRA PIN"
                size="small"
                value={kraPin}
                onChange={(event) => setKraPin(event.target.value)}
                sx={{ maxWidth: 190 }}
              />
              <MDButton
                size="small"
                color="info"
                variant="outlined"
                disabled={busy}
                onClick={saveRate}
              >
                Save
              </MDButton>
              <MDTypography variant="caption" color="text">
                Leave the rate blank if this school is not billed through eduClub.
              </MDTypography>
            </MDBox>

            {identity && (
              <MDBox
                display="flex"
                gap={1}
                flexWrap="wrap"
                alignItems="center"
                mb={1.5}
                p={1.25}
                sx={{ bgcolor: palette.surfaceMuted, borderRadius: "10px" }}
              >
                <MDTypography variant="caption" fontWeight="bold">
                  eduClub VAT
                </MDTypography>
                <MDInput
                  select
                  label="Charge VAT"
                  size="small"
                  value={identity.vat_registered ? "yes" : "no"}
                  onChange={(event) =>
                    saveIdentity({ vat_registered: event.target.value === "yes" })
                  }
                  SelectProps={{ native: true }}
                  sx={{ maxWidth: 120 }}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </MDInput>
                <MDInput
                  label="VAT %"
                  type="number"
                  size="small"
                  defaultValue={identity.vat_rate}
                  onBlur={(event) => saveIdentity({ vat_rate: Number(event.target.value) })}
                  sx={{ maxWidth: 100 }}
                />
                <MDInput
                  label="eduClub KRA PIN"
                  size="small"
                  defaultValue={identity.kra_pin}
                  onBlur={(event) => saveIdentity({ kra_pin: event.target.value })}
                  sx={{ maxWidth: 190 }}
                />
                <MDTypography variant="caption" color="text">
                  With VAT on, documents print as a Tax Invoice showing both PINs.
                </MDTypography>
              </MDBox>
            )}

            <MDBox display="flex" gap={1} flexWrap="wrap" alignItems="center" mb={1.5}>
              <MDInput
                label="Term"
                size="small"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                sx={{ maxWidth: 150 }}
              />
              <MDInput
                label="Year"
                type="number"
                size="small"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                sx={{ maxWidth: 120 }}
              />
              <MDButton
                size="small"
                color="info"
                variant="contained"
                disabled={busy || !term || !academicYear}
                onClick={issueInvoice}
              >
                Issue invoice
              </MDButton>
            </MDBox>

            <TableContainer sx={{ maxHeight: 300, overflowX: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Term</TableCell>
                    <TableCell align="right">Learners</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <MDTypography variant="caption" color="text">
                          No invoices issued yet.
                        </MDTypography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          {invoice.term} {invoice.academic_year}
                        </TableCell>
                        <TableCell align="right">{invoice.learner_count}</TableCell>
                        <TableCell align="right">
                          {formatMoney(invoice.amount, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={invoice.status}
                            color={
                              invoice.status === "paid"
                                ? "success"
                                : invoice.status === "void"
                                ? "default"
                                : "warning"
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <MDBox display="flex" gap={0.5} justifyContent="flex-end">
                            <MDButton
                              size="small"
                              variant="text"
                              color="info"
                              onClick={() => printDocument(invoice, "invoice")}
                            >
                              Invoice
                            </MDButton>
                            {invoice.status === "paid" && (
                              <MDButton
                                size="small"
                                variant="text"
                                color="success"
                                onClick={() => printDocument(invoice, "receipt")}
                              >
                                Receipt
                              </MDButton>
                            )}
                            {invoice.status === "issued" && (
                              <MDButton
                                size="small"
                                variant="text"
                                color="success"
                                disabled={busy}
                                onClick={() => setPaying(invoice)}
                              >
                                Confirm payment
                              </MDButton>
                            )}
                            {invoice.status !== "void" && (
                              <MDButton
                                size="small"
                                variant="text"
                                color="error"
                                disabled={busy}
                                onClick={() => setStatus(invoice, "void")}
                              >
                                Void
                              </MDButton>
                            )}
                          </MDBox>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {tab === 2 && (
          <TableContainer sx={{ maxHeight: 380, overflowX: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead sx={{ display: "table-header-group" }}>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Who</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <MDTypography variant="caption" color="text">
                        No recorded activity for this school yet.
                      </MDTypography>
                    </TableCell>
                  </TableRow>
                ) : (
                  activity.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatWhen(entry.created_at)}</TableCell>
                      <TableCell>
                        {entry.actor_name}
                        <MDTypography variant="caption" color="text" display="block">
                          {entry.actor_role}
                        </MDTypography>
                      </TableCell>
                      <TableCell>{readableAction(entry.action)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 3 && (
          <MDBox>
            <MDTypography variant="caption" color="text" display="block" mb={1.5}>
              Pausing a school signs out its learners and teachers at their next sign in. The school
              administrator keeps access so they can read the reason and put it right.
            </MDTypography>
            <MDInput
              label="Reason shown to the school"
              fullWidth
              multiline
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              sx={{ mb: 1.5 }}
            />
            <MDButton
              color={suspended ? "success" : "error"}
              variant="contained"
              disabled={busy}
              onClick={toggleSuspension}
            >
              {suspended ? "Restore access" : "Pause access"}
            </MDButton>
          </MDBox>
        )}
      </DialogContent>

      {/* Confirming payment is what creates the receipt, so the method and
          reference are captured here rather than typed onto the PDF later. */}
      <Dialog
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="confirm-payment-title"
      >
        <DialogTitle id="confirm-payment-title">Confirm payment</DialogTitle>
        <DialogContent>
          <MDTypography variant="caption" color="text" display="block" mb={1.5}>
            {paying?.term} {paying?.academic_year} &middot;{" "}
            {formatMoney(paying?.amount, paying?.currency)}. This issues a receipt number and makes
            the receipt printable.
          </MDTypography>
          <MDInput
            select
            label="Method"
            fullWidth
            size="small"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            SelectProps={{ native: true }}
            sx={{ mb: 1.5 }}
          >
            <option value="M-Pesa">M-Pesa</option>
            <option value="Bank transfer">Bank transfer</option>
            <option value="Cheque">Cheque</option>
            <option value="Cash">Cash</option>
          </MDInput>
          <MDInput
            label="Reference"
            fullWidth
            size="small"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            sx={{ mb: 1.5 }}
          />
          <MDBox display="flex" gap={1} justifyContent="flex-end">
            <MDButton size="small" variant="text" onClick={() => setPaying(null)}>
              Cancel
            </MDButton>
            <MDButton
              size="small"
              color="success"
              variant="contained"
              disabled={busy}
              onClick={confirmPayment}
            >
              Confirm payment
            </MDButton>
          </MDBox>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

SchoolCustodyModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  school: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    name: PropTypes.string,
    code: PropTypes.string,
    is_active: PropTypes.bool,
    suspension_reason: PropTypes.string,
    invoice_rate_per_learner: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  onSchoolChanged: PropTypes.func,
};

SchoolCustodyModal.defaultProps = { school: null, onSchoolChanged: undefined };

export default SchoolCustodyModal;
