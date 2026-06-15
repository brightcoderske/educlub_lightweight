export function activityToStructuredForm(activity = {}) {
  const content = activity.content || {};
  const media = content.media || {};
  const supportsRichContent = !["quiz", "discussion"].includes(activity.activity_type);
  const existingRichContent =
    content.rich_html || content.body || content.text || content.instructions || "";
  const migrateLegacyDescription =
    supportsRichContent && !existingRichContent && Boolean(content.description);

  return {
    original_content: content,
    title: activity.title || "",
    activity_type: activity.activity_type || "lesson",
    points: activity.points || 0,
    position: activity.position || 1,
    is_required: activity.is_required !== false,
    availability_mode: activity.availability_mode || "required",
    completion_rule: activity.completion_rule || "manual",
    pass_score: activity.pass_score || "",
    is_published: activity.is_published !== false,
    purpose: content.purpose || "",
    description: migrateLegacyDescription ? "" : content.description || "",
    rich_html: existingRichContent || (migrateLegacyDescription ? content.description : ""),
    discussion_prompt: content.discussion_prompt || content.prompt || "",
    starter_code: content.starter_code || content.code || "",
    starter_html: content.starter_html || "",
    starter_css: content.starter_css || "",
    starter_js: content.starter_js || "",
    language: content.language || "html_css",
    challenge_mode: content.challenge_mode || "build",
    validation_checks_text: JSON.stringify(content.validation_checks || [], null, 2),
    submission_instructions: content.submission_instructions || "",
    reflection_prompt: content.reflection_prompt || "",
    project_brief: content.project_brief || "",
    image_url: media.image_url || "",
    image_alt: media.image_alt || "",
    video_url: media.video_url || "",
    video_title: media.video_title || "",
    transcript: media.transcript || "",
    friendly_hints_text: (content.friendly_hints || []).join("\n"),
    level_up: content.level_up || content.project_brief || "",
    teacher_notes: content.teacher_notes || "",
    badge_name: content.module_badge?.name || "",
    badge_image_url: content.module_badge?.image_url || "",
    milestone_key: content.milestone_key || "",
    questions: Array.isArray(content.questions) ? content.questions : [],
  };
}

export function structuredFormContent(form, questions) {
  return {
    ...(form.original_content || {}),
    purpose: form.purpose || "",
    description: form.description || "",
    rich_html: form.rich_html || "",
    discussion_prompt: form.discussion_prompt || "",
    starter_code: form.starter_code || "",
    starter_html: form.starter_html || "",
    starter_css: form.starter_css || "",
    starter_js: form.starter_js || "",
    language: form.language || "html_css",
    challenge_mode: form.challenge_mode || "build",
    validation_checks: (() => {
      try {
        const checks = JSON.parse(form.validation_checks_text || "[]");
        return Array.isArray(checks) ? checks : [];
      } catch {
        return [];
      }
    })(),
    submission_instructions: form.submission_instructions || "",
    reflection_prompt: form.reflection_prompt || "",
    project_brief: form.project_brief || "",
    media: {
      ...(form.original_content?.media || {}),
      image_url: form.image_url || "",
      image_alt: form.image_alt || "",
      video_url: form.video_url || "",
      video_title: form.video_title || "",
      transcript: form.transcript || "",
    },
    friendly_hints: String(form.friendly_hints_text || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
    level_up: form.level_up || "",
    teacher_notes: form.teacher_notes || "",
    module_badge: {
      ...(form.original_content?.module_badge || {}),
      name: form.badge_name || "",
      image_url: form.badge_image_url || "",
    },
    milestone_key: form.milestone_key || "",
    questions,
  };
}

export async function saveActivityWithFeedback(onSave, payload) {
  try {
    await onSave(payload);
    return { saved: true, error: "" };
  } catch (error) {
    return {
      saved: false,
      error: error?.message || "The activity could not be saved. Please try again.",
    };
  }
}

export function replaceActivityInBuilderData(data, updatedActivity) {
  if (!data || !updatedActivity) return data;

  const nextData = {
    ...data,
    modules: (data.modules || []).map((courseModule) => ({
      ...courseModule,
      activities: (courseModule.activities || []).map((activity) =>
        Number(activity.id) === Number(updatedActivity.id) ? updatedActivity : activity
      ),
    })),
  };

  if (nextData.template && Number.isFinite(Number(nextData.template.version))) {
    nextData.template = {
      ...nextData.template,
      version: Number(nextData.template.version) + 1,
    };
  }

  if (nextData.course && Number.isFinite(Number(nextData.course.school_version))) {
    nextData.course = {
      ...nextData.course,
      school_version: Number(nextData.course.school_version) + 1,
    };
  }

  return nextData;
}
