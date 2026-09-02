import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

const panelSx = {
  border: "1px solid #e4eaf2",
  borderRadius: "16px",
  boxShadow: "0 10px 28px rgba(52, 71, 103, 0.05)",
  overflow: "hidden",
};

function EmptyState({ icon, children }) {
  return (
    <MDBox py={4.5} px={2} textAlign="center" sx={{ bgcolor: "#fbfcfe" }}>
      <MDBox
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        mb={1}
        sx={{ width: 44, height: 44, borderRadius: "12px", bgcolor: "#eaf3ff" }}
      >
        <Icon sx={{ color: "#1A73E8" }}>{icon}</Icon>
      </MDBox>
      <MDTypography variant="body2" color="text">
        {children}
      </MDTypography>
    </MDBox>
  );
}

function SectionHeader({ icon, title, description, count, action }) {
  return (
    <MDBox
      display="flex"
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
      flexDirection={{ xs: "column", md: "row" }}
      gap={1.5}
      px={{ xs: 2, md: 2.5 }}
      py={2}
      sx={{ borderBottom: "1px solid #edf1f6", bgcolor: "#ffffff" }}
    >
      <MDBox display="flex" alignItems="flex-start" gap={1.25}>
        <MDBox
          display="flex"
          alignItems="center"
          justifyContent="center"
          sx={{
            width: 40,
            height: 40,
            flex: "0 0 auto",
            borderRadius: "11px",
            color: "#1A73E8",
            bgcolor: "#eaf3ff",
          }}
        >
          <Icon>{icon}</Icon>
        </MDBox>
        <MDBox>
          <MDBox display="flex" alignItems="center" gap={1}>
            <MDTypography variant="h6" color="dark" fontWeight="bold">
              {title}
            </MDTypography>
            <Chip label={count} size="small" sx={{ bgcolor: "#f0f4f9", fontWeight: 700 }} />
          </MDBox>
          <MDTypography variant="caption" color="text">
            {description}
          </MDTypography>
        </MDBox>
      </MDBox>
      {action}
    </MDBox>
  );
}

function StatusChip({ open }) {
  return (
    <Chip
      label={open ? "Open" : "Closed"}
      color={open ? "success" : "default"}
      size="small"
      variant={open ? "filled" : "outlined"}
    />
  );
}

export default function AssessmentLibrary({
  activeAcademicTerm,
  canCreate,
  loading,
  quizTests,
  typingTests,
  isLearner,
  canManageAssessment,
  onCreateQuiz,
  onCreateTyping,
  onOpenQuiz,
  onOpenQuizPerformance,
  onEditQuiz,
  onDuplicateQuiz,
  onDeleteQuiz,
  onOpenTyping,
  onEditTyping,
  onDuplicateTyping,
  onDeleteTyping,
  onShowQuizMatrix,
  onShowTypingMatrix,
}) {
  const termLabel = activeAcademicTerm
    ? `${activeAcademicTerm.name} · ${activeAcademicTerm.academic_year}`
    : "No current term";

  return (
    <MDBox display="flex" flexDirection="column" gap={2.5}>
      <Card sx={panelSx}>
        <SectionHeader
          icon="quiz"
          title="Quizzes"
          count={quizTests.length}
          description={
            isLearner
              ? `Quizzes available for ${termLabel}.`
              : "Click a quiz name to view learner performance and mark submissions."
          }
          action={
            <MDBox display="flex" flexWrap="wrap" gap={0.75}>
              {!isLearner && (
                <MDButton variant="text" color="info" size="small" onClick={onShowQuizMatrix}>
                  <Icon>insights</Icon>&nbsp; Performance matrix
                </MDButton>
              )}
              {!isLearner && canCreate && (
                <MDButton variant="outlined" color="info" size="small" onClick={onCreateQuiz}>
                  <Icon>add</Icon>&nbsp; New quiz
                </MDButton>
              )}
            </MDBox>
          }
        />
        {loading ? (
          <EmptyState icon="hourglass_top">Loading quizzes...</EmptyState>
        ) : quizTests.length === 0 ? (
          <EmptyState icon="quiz">No quizzes are available for this term.</EmptyState>
        ) : (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 760 }}>
              <TableHead sx={{ display: "table-header-group" }}>
                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                  <TableCell>Quiz</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Week</TableCell>
                  <TableCell>Term</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quizTests.map((test) => (
                  <TableRow key={test.id} hover>
                    <TableCell>
                      <MDButton
                        variant="text"
                        color="info"
                        size="small"
                        aria-label={
                          isLearner ? `Open ${test.name}` : `View performance for ${test.name}`
                        }
                        onClick={() => (isLearner ? onOpenQuiz(test) : onOpenQuizPerformance(test))}
                        sx={{
                          px: 0,
                          minWidth: 0,
                          justifyContent: "flex-start",
                          textTransform: "none",
                          fontSize: "0.875rem",
                        }}
                      >
                        {test.name}
                      </MDButton>
                      {!isLearner && (
                        <MDTypography variant="caption" color="text" display="block">
                          View performance
                        </MDTypography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={test.quiz_category || "quiz"}
                        color={test.quiz_type === "competition" ? "warning" : "info"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>Week {test.week_number || "-"}</TableCell>
                    <TableCell>
                      {test.term} · {test.academic_year}
                    </TableCell>
                    <TableCell>
                      <StatusChip open={test.effective_is_open} />
                    </TableCell>
                    <TableCell align="right">
                      {isLearner ? (
                        <MDButton
                          variant="gradient"
                          color="info"
                          size="small"
                          onClick={() => onOpenQuiz(test)}
                        >
                          Start
                        </MDButton>
                      ) : canManageAssessment(test) ? (
                        <MDBox display="flex" justifyContent="flex-end" flexWrap="wrap" gap={0.25}>
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => onEditQuiz(test)}
                          >
                            Edit
                          </MDButton>
                          <MDButton
                            variant="text"
                            color="success"
                            size="small"
                            onClick={() => onDuplicateQuiz(test)}
                          >
                            Duplicate
                          </MDButton>
                          <MDButton
                            variant="text"
                            color="error"
                            size="small"
                            onClick={() => onDeleteQuiz(test)}
                          >
                            Delete
                          </MDButton>
                        </MDBox>
                      ) : (
                        <MDButton
                          variant="text"
                          color="info"
                          size="small"
                          onClick={() => onOpenQuizPerformance(test)}
                        >
                          Review
                        </MDButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Card sx={panelSx}>
        <SectionHeader
          icon="keyboard"
          title="Typing tests"
          count={typingTests.length}
          description={`Typing assessments are kept separate and scoped to ${termLabel}.`}
          action={
            <MDBox display="flex" flexWrap="wrap" gap={0.75}>
              {!isLearner && (
                <MDButton variant="text" color="info" size="small" onClick={onShowTypingMatrix}>
                  <Icon>insights</Icon>&nbsp; Performance matrix
                </MDButton>
              )}
              {!isLearner && canCreate && (
                <MDButton variant="outlined" color="info" size="small" onClick={onCreateTyping}>
                  <Icon>add</Icon>&nbsp; New typing test
                </MDButton>
              )}
            </MDBox>
          }
        />
        {loading ? (
          <EmptyState icon="hourglass_top">Loading typing tests...</EmptyState>
        ) : typingTests.length === 0 ? (
          <EmptyState icon="keyboard">No typing tests are available for this term.</EmptyState>
        ) : (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 720 }}>
              <TableHead sx={{ display: "table-header-group" }}>
                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                  <TableCell>Typing test</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Week</TableCell>
                  <TableCell>Lessons</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {typingTests.map((test) => (
                  <TableRow key={test.id} hover>
                    <TableCell>
                      <MDTypography variant="button" color="dark" fontWeight="bold">
                        {test.name}
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block">
                        {test.term} · {test.academic_year}
                      </MDTypography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={test.test_type === "competition" ? "Competition" : "Weekly"}
                        color={test.test_type === "competition" ? "warning" : "info"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>Week {test.week_number || "-"}</TableCell>
                    <TableCell>{test.lesson_count || 0}</TableCell>
                    <TableCell>
                      <StatusChip open={test.effective_is_open} />
                    </TableCell>
                    <TableCell align="right">
                      {isLearner ? (
                        <MDButton
                          variant="gradient"
                          color="info"
                          size="small"
                          onClick={() => onOpenTyping(test)}
                        >
                          Start
                        </MDButton>
                      ) : canManageAssessment(test) ? (
                        <MDBox display="flex" justifyContent="flex-end" flexWrap="wrap" gap={0.25}>
                          <MDButton
                            variant="text"
                            color="info"
                            size="small"
                            onClick={() => onEditTyping(test)}
                          >
                            Edit
                          </MDButton>
                          <MDButton
                            variant="text"
                            color="success"
                            size="small"
                            onClick={() => onDuplicateTyping(test)}
                          >
                            Duplicate
                          </MDButton>
                          <MDButton
                            variant="text"
                            color="error"
                            size="small"
                            onClick={() => onDeleteTyping(test)}
                          >
                            Delete
                          </MDButton>
                        </MDBox>
                      ) : (
                        <MDTypography variant="caption" color="text">
                          Native
                        </MDTypography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </MDBox>
  );
}
