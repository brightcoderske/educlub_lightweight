const coursesService = require("../services/courses.service");

async function getAllCourses(req, res) {
  try {
    const courses = await coursesService.getAllCourses({
      category: req.query.category,
      school_id: req.query.school_id,
      user: req.user,
    });
    res.json(courses);
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ error: "Failed to get courses" });
  }
}

async function createCourse(req, res) {
  try {
    const courseData = req.body;
    const course = await coursesService.createCourse(courseData);
    res.status(201).json(course);
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({ error: "Failed to create course" });
  }
}

async function getCourseById(req, res) {
  try {
    const course = await coursesService.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({ error: "Failed to get course" });
  }
}

async function updateCourse(req, res) {
  try {
    const course = await coursesService.updateCourse(req.params.id, req.body);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    console.error("Update course error:", error);
    res.status(500).json({ error: "Failed to update course" });
  }
}

async function deleteCourse(req, res) {
  try {
    await coursesService.deleteCourse(req.params.id);
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({ error: "Failed to delete course" });
  }
}

async function getLearningOverview(req, res) {
  try {
    const overview = await coursesService.getCourseLearningOverview(
      req.params.id,
      req.user,
    );
    if (!overview) {
      return res
        .status(404)
        .json({ error: "Course not found or not allocated to this learner" });
    }
    res.json(overview);
  } catch (error) {
    console.error("Get course learning overview error:", error);
    res.status(500).json({ error: "Failed to get course learning overview" });
  }
}

async function getModuleLearning(req, res) {
  try {
    const moduleLearning = await coursesService.getModuleLearning(
      req.params.courseId,
      req.params.moduleId,
      req.user,
    );
    if (!moduleLearning) {
      return res
        .status(404)
        .json({ error: "Module not found or not available" });
    }
    if (!moduleLearning.is_unlocked) {
      return res.status(403).json({ error: "This module is not open yet" });
    }
    res.json(moduleLearning);
  } catch (error) {
    console.error("Get module learning error:", error);
    res.status(500).json({ error: "Failed to get module learning view" });
  }
}

async function updateActivityProgress(req, res) {
  try {
    const progress = await coursesService.upsertActivityProgress(
      req.params.activityId,
      req.user,
      req.body,
    );
    res.json(progress);
  } catch (error) {
    console.error("Update activity progress error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to update activity progress" });
  }
}

async function createModule(req, res) {
  try {
    const module = await coursesService.createManagedModule(
      req.params.id,
      req.user,
      req.body,
    );
    res.status(201).json(module);
  } catch (error) {
    console.error("Create course module error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to create course module" });
  }
}

async function updateModule(req, res) {
  try {
    const module = await coursesService.updateModule(
      req.params.moduleId,
      req.user,
      req.body,
    );
    if (!module) return res.status(404).json({ error: "Module not found" });
    res.json(module);
  } catch (error) {
    console.error("Update course module error:", error);
    res.status(400).json({ error: error.message || "Failed to update module" });
  }
}

async function deleteModule(req, res) {
  try {
    await coursesService.deleteModule(req.params.moduleId, req.user);
    res.json({ message: "Module deleted" });
  } catch (error) {
    console.error("Delete course module error:", error);
    res.status(400).json({ error: error.message || "Failed to delete module" });
  }
}

async function createActivity(req, res) {
  try {
    const activity = await coursesService.createManagedActivity(
      req.params.moduleId,
      req.user,
      req.body,
    );
    res.status(201).json(activity);
  } catch (error) {
    console.error("Create learning activity error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to create learning activity" });
  }
}

async function updateActivity(req, res) {
  try {
    const activity = await coursesService.updateActivity(
      req.params.activityId,
      req.user,
      req.body,
    );
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    res.json(activity);
  } catch (error) {
    console.error("Update learning activity error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to update activity" });
  }
}

async function deleteActivity(req, res) {
  try {
    await coursesService.deleteActivity(req.params.activityId, req.user);
    res.json({ message: "Activity deleted" });
  } catch (error) {
    console.error("Delete learning activity error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to delete activity" });
  }
}

async function syncSchoolCourse(req, res) {
  try {
    const course = await coursesService.syncSchoolCourse(
      req.params.id,
      req.user,
    );
    res.json(course);
  } catch (error) {
    console.error("Sync school course error:", error);
    res.status(400).json({ error: error.message || "Failed to sync course" });
  }
}

async function rollbackSchoolCourse(req, res) {
  try {
    const course = await coursesService.rollbackSchoolCourse(
      req.params.id,
      req.user,
    );
    res.json(course);
  } catch (error) {
    console.error("Rollback school course error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to rollback course" });
  }
}

module.exports = {
  getAllCourses,
  createCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
  getLearningOverview,
  getModuleLearning,
  updateActivityProgress,
  createModule,
  updateModule,
  deleteModule,
  createActivity,
  updateActivity,
  deleteActivity,
  syncSchoolCourse,
  rollbackSchoolCourse,
};
