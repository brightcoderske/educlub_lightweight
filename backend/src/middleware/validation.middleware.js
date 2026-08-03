function formatIssues(issues) {
  return issues.reduce((errors, issue) => {
    const field = issue.path.length ? issue.path.join(".") : "request";
    errors[field] ||= [];
    errors[field].push(issue.message);
    return errors;
  }, {});
}

function validate(schemas) {
  return (req, res, next) => {
    for (const source of ["params", "query", "body"]) {
      if (!schemas[source]) continue;
      const result = schemas[source].safeParse(req[source]);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "The request contains invalid data.",
          errors: formatIssues(result.error.issues),
          requestId: req.requestId,
        });
      }
      req[source] = result.data;
    }
    return next();
  };
}

module.exports = { validate, formatIssues };
