const coursesService = require("../services/courses.service");
const fs = require("fs");
const path = require("path");

function getPublicUploadUrl(req, relativePath) {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || process.env.API_PUBLIC_URL;
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}${relativePath}`;
  }
  return `${req.protocol}://${req.get("host")}${relativePath}`;
}

function saveDataUpload(req, folder, options = {}) {
  const { fileName, dataUrl } = req.body || {};
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) throw new Error(options.error || "Please upload a valid file.");

  const mimeType = match[1].toLowerCase();
  const allowedTypes = options.allowedTypes || [];
  if (allowedTypes.length && !allowedTypes.includes(mimeType)) {
    throw new Error(options.error || "This file type is not allowed.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > options.maxBytes) {
    throw new Error(options.sizeError || "This file is too large.");
  }

  const extension =
    path.extname(fileName || "").replace(".", "") ||
    mimeType.split("/")[1].replace("jpeg", "jpg");
  const safeName = `${Date.now()}-${(fileName || options.defaultName || "upload")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]/gi, "-")
    .toLowerCase()}.${extension}`;
  const uploadDir = path.join(__dirname, "../../uploads", folder);
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, safeName), buffer);
  return getPublicUploadUrl(req, `/uploads/${folder}/${safeName}`);
}

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

async function getActivityDiscussion(req, res) {
  try {
    const discussion = await coursesService.getActivityDiscussion(
      req.params.activityId,
      req.user,
    );
    res.json(discussion);
  } catch (error) {
    console.error("Get activity discussion error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to load discussion" });
  }
}

async function addDiscussionReply(req, res) {
  try {
    const reply = await coursesService.addDiscussionReply(
      req.params.activityId,
      req.user,
      req.body,
    );
    res.status(201).json(reply);
  } catch (error) {
    console.error("Add discussion reply error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to add reply" });
  }
}

async function submitQuiz(req, res) {
  try {
    const result = await coursesService.submitQuiz(
      req.params.activityId,
      req.user,
      req.body,
    );
    res.json(result);
  } catch (error) {
    console.error("Submit quiz error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to submit quiz" });
  }
}

async function submitActivityWork(req, res) {
  try {
    const submission = await coursesService.submitActivityWork(
      req.params.activityId,
      req.user,
      req.body,
    );
    res.status(201).json(submission);
  } catch (error) {
    console.error("Submit activity work error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to submit activity work" });
  }
}

async function getActivityReview(req, res) {
  try {
    const review = await coursesService.getActivityReview(
      req.params.activityId,
      req.user,
      req.query,
    );
    res.json(review);
  } catch (error) {
    console.error("Get activity review error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to load activity review" });
  }
}

async function gradeActivityForLearner(req, res) {
  try {
    const grade = await coursesService.gradeActivityForLearner(
      req.params.activityId,
      req.params.learnerId,
      req.user,
      req.body,
    );
    res.json(grade);
  } catch (error) {
    console.error("Grade activity learner error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to save activity grade" });
  }
}

async function uploadActivityImage(req, res) {
  try {
    const url = saveDataUpload(req, "activity-images", {
      allowedTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"],
      defaultName: "activity-image",
      error: "Please upload a PNG, JPG, GIF, or WebP image.",
      maxBytes: 2 * 1024 * 1024,
      sizeError: "Image uploads are capped at 2MB.",
    });
    res.status(201).json({ url });
  } catch (error) {
    console.error("Upload activity image error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to upload activity image" });
  }
}

async function uploadSubmissionFile(req, res) {
  try {
    const url = saveDataUpload(req, "activity-submissions", {
      allowedTypes: [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      defaultName: "activity-submission",
      error: "Upload an image, PDF, text file, or Word document.",
      maxBytes: 5 * 1024 * 1024,
      sizeError: "Submission uploads are capped at 5MB.",
    });
    res.status(201).json({ url });
  } catch (error) {
    console.error("Upload submission file error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to upload submission file" });
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
  getActivityDiscussion,
  addDiscussionReply,
  submitQuiz,
  submitActivityWork,
  getActivityReview,
  gradeActivityForLearner,
  uploadActivityImage,
  uploadSubmissionFile,
  createModule,
  updateModule,
  deleteModule,
  createActivity,
  updateActivity,
  deleteActivity,
  syncSchoolCourse,
  rollbackSchoolCourse,
};
