import PropTypes from "prop-types";

import PageLayout from "examples/LayoutContainers/PageLayout";
import MDBox from "components/MDBox";

function CoverLayout({ image, children }) {
  return (
    <PageLayout>
      <MDBox
        width="100%"
        minHeight="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={2}
        sx={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <MDBox width="100%" maxWidth="24rem">
          {children}
        </MDBox>
      </MDBox>
    </PageLayout>
  );
}

CoverLayout.propTypes = {
  image: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

export default CoverLayout;
