const assignmentsService = require("../services/teacherAssignments.service");

function sendError(res, error) {
  const status = /not found/i.test(error.message)
    ? 404
    : /cannot|outside|choose|assigned/i.test(error.message)
      ? 403
      : 400;
  return res.status(status).json({ error: error.message });
}

async function list(req, res) {
  try {
    const assignments = await assignmentsService.listTeacherAssignments(
      req.query,
      req.user,
    );
    res.json(assignments);
  } catch (error) {
    console.error("List teacher assignments error:", error);
    sendError(res, error);
  }
}

async function assign(req, res) {
  try {
    const assignment = await assignmentsService.assignTeacher(
      req.body,
      req.user,
    );
    res.status(201).json(assignment);
  } catch (error) {
    console.error("Assign teacher error:", error);
    sendError(res, error);
  }
}

async function deallocate(req, res) {
  try {
    const assignment = await assignmentsService.deallocateTeacher(
      req.params.assignmentId,
      req.user,
    );
    if (!assignment) {
      return res.status(404).json({ error: "Teacher assignment not found" });
    }
    res.json(assignment);
  } catch (error) {
    console.error("Deallocate teacher error:", error);
    sendError(res, error);
  }
}

async function requestTemplateUpdate(req, res) {
  try {
    const request = await assignmentsService.requestTemplateUpdate(
      req.params.courseId,
      req.user,
    );
    res.status(201).json(request);
  } catch (error) {
    console.error("Request template update error:", error);
    sendError(res, error);
  }
}

module.exports = { list, assign, deallocate, requestTemplateUpdate };
