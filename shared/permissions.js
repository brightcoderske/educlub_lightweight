/**
 * Permission Definitions
 */

const PERMISSIONS = {
  // School Management
  'schools:create': 'Create new schools',
  'schools:read': 'View school information',
  'schools:update': 'Update school information',
  'schools:delete': 'Delete schools',
  'schools:archive': 'Archive schools',
  
  // User Management
  'users:create': 'Create users',
  'users:read': 'View user information',
  'users:update': 'Update user information',
  'users:delete': 'Delete users',
  'school_admins:create': 'Create school admins',
  'school_admins:read': 'View school admin information',
  'school_admins:update': 'Update school admin information',
  'school_admins:delete': 'Delete school admins',
  'learners:create': 'Create learners',
  'learners:read': 'View learner information',
  'learners:update': 'Update learner information',
  'learners:delete': 'Delete learners',
  'learners:read:own': 'View own learner information',
  
  // Course Management
  'courses:create': 'Create courses',
  'courses:read': 'View course information',
  'courses:update': 'Update course information',
  'courses:delete': 'Delete courses',
  'courses:publish': 'Publish courses to schools',
  'courses:read:own': 'View own assigned courses',
  
  // Course Allocation
  'allocations:create': 'Create course allocations',
  'allocations:read': 'View course allocations',
  'allocations:update': 'Update course allocations',
  'allocations:delete': 'Delete course allocations',
  'allocations:read:own': 'View own course allocations',
  
  // Academic Management
  'academic_years:create': 'Create academic years',
  'academic_years:read': 'View academic years',
  'academic_years:update': 'Update academic years',
  'academic_years:delete': 'Delete academic years',
  'terms:create': 'Create terms',
  'terms:read': 'View terms',
  'terms:update': 'Update terms',
  'terms:delete': 'Delete terms',
  
  // Reports
  'reports:create': 'Create reports',
  'reports:read': 'View reports',
  'reports:delete': 'Delete reports',
  'reports:read:own': 'View own reports',
  
  // Certificates
  'certificates:approve': 'Approve certificates',
  'certificates:read': 'View certificates',
  'certificates:read:own': 'View own certificates',
  
  // Native LMS authoring
  'modules:create': 'Create course modules',
  'modules:update': 'Update course modules',
  'activities:create': 'Create learning activities',
  'activities:update': 'Update learning activities',
  'activities:grade': 'Grade learner activities',
};

function getPermissionLabel(permission) {
  return PERMISSIONS[permission] || permission;
}

function getAllPermissions() {
  return Object.keys(PERMISSIONS);
}

module.exports = {
  PERMISSIONS,
  getPermissionLabel,
  getAllPermissions,
};
