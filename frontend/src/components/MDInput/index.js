/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { forwardRef } from "react";

// prop-types is a library for typechecking of props
import PropTypes from "prop-types";

// Custom styles for MDInput
import MDInputRoot from "components/MDInput/MDInputRoot";

// Fields that always show something in the box: a dropdown shows its chosen
// option (even an empty one like "All streams"), and the browser draws a date or
// time field's "dd/mm/yyyy" itself. Their label has to sit above the box, or it is
// drawn on top of that text.
const ALWAYS_FILLED_TYPES = ["date", "time", "datetime-local", "month", "week"];

// `disabled` is also handed to the input itself. It used to reach only the styling
// (ownerState), so a field marked disabled looked it and could still be typed into.
const MDInput = forwardRef(({ error, success, disabled, InputLabelProps, ...rest }, ref) => {
  const alwaysFilled = rest.select || ALWAYS_FILLED_TYPES.includes(rest.type);
  return (
    <MDInputRoot
      {...rest}
      InputLabelProps={alwaysFilled ? { shrink: true, ...InputLabelProps } : InputLabelProps}
      disabled={disabled}
      ref={ref}
      ownerState={{ error, success, disabled }}
    />
  );
});

// Setting default values for the props of MDInput
MDInput.defaultProps = {
  error: false,
  success: false,
  disabled: false,
  InputLabelProps: undefined,
};

// Typechecking props for the MDInput
MDInput.propTypes = {
  error: PropTypes.bool,
  success: PropTypes.bool,
  disabled: PropTypes.bool,
  InputLabelProps: PropTypes.objectOf(PropTypes.any),
};

export default MDInput;
