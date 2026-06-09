function requireSchoolScope(req, res, next) {
  if (!req.user || !req.user.schoolId) {
    return res.status(403).json({ error: 'School scope required' });
  }

  // Attach school ID to request for use in controllers/services
  req.schoolId = req.user.schoolId;
  next();
}

function checkSchoolAccess(req, res, next) {
  const { schoolId } = req.params;
  
  if (req.user.role === 'system_admin') {
    // System admins can access any school
    return next();
  }
  
  if (req.user.role === 'school_admin' && req.user.schoolId === parseInt(schoolId)) {
    // School admins can only access their own school
    return next();
  }
  
  return res.status(403).json({ error: 'Access denied to this school' });
}

module.exports = { requireSchoolScope, checkSchoolAccess };
