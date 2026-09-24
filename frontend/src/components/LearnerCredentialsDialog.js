import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import { printCredentialCard } from "lib/printCredentialCard";

/**
 * What to show once a learner has been created, from the create call's result.
 * The default password is only at hand at this moment - afterwards the learner
 * changes it - so this is where it is handed over, on screen or on paper.
 */
export function credentialsFromCreatedLearner(result, schoolName) {
  return {
    fullName: result.learner.full_name,
    schoolName: schoolName || "",
    grade: result.learner.grade || "",
    stream: result.learner.stream || "",
    username: result.username,
    password: result.plainPassword,
    signInUrl: `${window.location.origin}/authentication/sign-in`,
  };
}

function Detail({ label, value }) {
  return (
    <MDBox mb={1.5}>
      <MDTypography variant="caption" color="text" display="block">
        {label}
      </MDTypography>
      <MDTypography variant="h6" fontWeight="bold" sx={{ overflowWrap: "anywhere" }}>
        {value}
      </MDTypography>
    </MDBox>
  );
}

Detail.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string.isRequired };

function LearnerCredentialsDialog({ credentials, onClose }) {
  if (!credentials) return null;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Learner created</DialogTitle>
      <DialogContent dividers>
        <MDTypography variant="body2" mb={2}>
          {credentials.fullName} can sign in with these details. They will be asked to choose a new
          password the first time.
        </MDTypography>
        <MDBox p={2} sx={{ border: "1px dashed", borderColor: "grey.400", borderRadius: 1 }}>
          <Detail label="Username" value={credentials.username} />
          <Detail label="Temporary password" value={credentials.password} />
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton variant="text" color="secondary" onClick={onClose}>
          Done
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={() => printCredentialCard(credentials)}>
          <Icon>print</Icon>&nbsp;Print card
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

LearnerCredentialsDialog.propTypes = {
  credentials: PropTypes.shape({
    fullName: PropTypes.string.isRequired,
    schoolName: PropTypes.string,
    grade: PropTypes.string,
    stream: PropTypes.string,
    username: PropTypes.string.isRequired,
    password: PropTypes.string.isRequired,
    signInUrl: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
};

LearnerCredentialsDialog.defaultProps = { credentials: null };

export default LearnerCredentialsDialog;
