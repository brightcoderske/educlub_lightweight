import { useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MDInput from "components/MDInput";

function PasswordField({ label, value, onChange, ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <MDInput
      {...rest}
      type={visible ? "text" : "password"}
      label={label}
      value={value}
      onChange={onChange}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={visible ? "Hide password" : "Show password"}
              edge="end"
              onClick={() => setVisible((current) => !current)}
            >
              <Icon>{visible ? "visibility_off" : "visibility"}</Icon>
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}

PasswordField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default PasswordField;
