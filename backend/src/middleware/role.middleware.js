function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Role required: ${roles.join(' or ')}` });
    }

    next();
  };
}

function isSystemAdmin(req, res, next) {
  return requireRole('system_admin')(req, res, next);
}

function isSchoolAdmin(req, res, next) {
  return requireRole('school_admin', 'teacher')(req, res, next);
}

function isLearner(req, res, next) {
  return requireRole('learner')(req, res, next);
}

module.exports = { requireRole, isSystemAdmin, isSchoolAdmin, isLearner };
