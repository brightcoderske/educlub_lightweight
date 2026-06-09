/**
 * User Roles and Permissions
 */

const ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  SCHOOL_ADMIN: 'school_admin',
  LEARNER: 'learner',
};

const ROLE_LABELS = {
  [ROLES.SYSTEM_ADMIN]: 'System Admin',
  [ROLES.SCHOOL_ADMIN]: 'School Admin',
  [ROLES.LEARNER]: 'Learner',
};

const ROLE_PERMISSIONS = {
  [ROLES.SYSTEM_ADMIN]: [
    // School Management
    'schools:create',
    'schools:read',
    'schools:update',
    'schools:delete',
    'schools:archive',
    
    // User Management
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'school_admins:create',
    'school_admins:read',
    'school_admins:update',
    'school_admins:delete',
    'learners:create',
    'learners:read',
    'learners:update',
    'learners:delete',
    
    // Course Management
    'courses:create',
    'courses:read',
    'courses:update',
    'courses:delete',
    'courses:publish',
    
    // Academic Management
    'academic_years:create',
    'academic_years:read',
    'academic_years:update',
    'academic_years:delete',
    'terms:create',
    'terms:read',
    'terms:update',
    'terms:delete',
    
    // Reports
    'reports:create',
    'reports:read',
    'reports:delete',
    
    // Certificates
    'certificates:approve',
    'certificates:read',
    
    // Native LMS authoring
    'modules:create',
    'modules:update',
    'activities:create',
    'activities:update',
    'activities:grade',
  ],
  
  [ROLES.SCHOOL_ADMIN]: [
    // School Management (own school only)
    'schools:read',
    
    // User Management (own school only)
    'learners:create',
    'learners:read',
    'learners:update',
    'learners:delete',
    
    // Course Management (own school only)
    'courses:read',
    
    // Course Allocation
    'allocations:create',
    'allocations:read',
    'allocations:update',
    'allocations:delete',
    
    // Reports (own school only)
    'reports:create',
    'reports:read',
    
    // Certificates (own school only)
    'certificates:read',
    'certificates:approve',
    
    // Native LMS authoring
    'modules:create',
    'modules:update',
    'activities:create',
    'activities:update',
    'activities:grade',
  ],
  
  [ROLES.LEARNER]: [
    // Own profile
    'learners:read:own',
    
    // Own courses
    'courses:read:own',
    'allocations:read:own',
    
    // Own reports
    'reports:read:own',
    
    // Own certificates
    'certificates:read:own',
  ],
};

function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function getAllRoles() {
  return Object.values(ROLES);
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  hasPermission,
  getRoleLabel,
  getAllRoles,
};
