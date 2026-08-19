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

// Material Dashboard 2 React base styles
import borders from "assets/theme/base/borders";
import boxShadows from "assets/theme/base/boxShadows";

// Material Dashboard 2 React helper functions
import pxToRem from "assets/theme/functions/pxToRem";

const { borderRadius } = borders;
const { xxl } = boxShadows;

const dialog = {
  styleOverrides: {
    paper: {
      borderRadius: borderRadius.lg,
      boxShadow: xxl,

      // Below the sm breakpoint (576px) a centred modal is mostly margin, which
      // leaves forms and detail panes squeezed into a narrow column. Every
      // dialog claims almost the whole screen there instead.
      "@media (max-width: 575.98px)": {
        margin: pxToRem(8),
        width: "calc(100% - 16px)",
        maxWidth: "calc(100% - 16px)",
        maxHeight: "calc(100% - 16px)",
      },
    },

    paperFullScreen: {
      borderRadius: 0,
    },
  },
};

export default dialog;
