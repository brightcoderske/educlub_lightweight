/**
=========================================================
* eduClub LMS - Dashboard Routes
=========================================================

* Copyright 2024 eduClub
*/

// eduClub layouts
import SystemAdminDashboard from "layouts/system-admin";
import SystemAdminSchools from "layouts/system-admin/schools";
import SystemAdminLearners from "layouts/system-admin/learners";
import SystemAdminSchoolAdmins from "layouts/system-admin/school-admins";
import SystemAdminCourses from "layouts/system-admin/courses";
import CourseBuilder from "layouts/course-builder";
import CourseReviews from "layouts/course-reviews";
import SystemAdminAcademic from "layouts/system-admin/academic";
import SystemAdminCompetitions from "layouts/system-admin/competitions";
import SystemAdminReports from "layouts/system-admin/reports";
import SystemAdminCertificates from "layouts/system-admin/certificates";
import SchoolAdminDashboard from "layouts/school-admin";
import SchoolAdminLearners from "layouts/school-admin/learners";
import SchoolAdminAllocations from "layouts/school-admin/allocations";
import SchoolAdminCertificates from "layouts/school-admin/certificates";
import SchoolSettings from "layouts/school-admin/settings";
import SchoolAdminCompetitions from "layouts/school-admin/competitions";
import SchoolAdminProgress from "layouts/school-admin/progress";
import LearnerDashboard from "layouts/learner";
import LearnerCertificates from "layouts/learner/certificates";
import LearnerCompetitions from "layouts/learner/competitions";
import CourseOverview from "layouts/learner/course-overview";
import ModuleLearn from "layouts/learner/module-learn";
import LearnerProgress from "layouts/learner/progress";
import LearnerProfile from "layouts/learner/profile";
import WeeklyLearning from "layouts/weekly-learning";
import SignIn from "layouts/authentication/sign-in";
import ResetPassword from "layouts/authentication/reset-password";
import ForgotPassword from "layouts/authentication/forgot-password";
import SetPassword from "layouts/authentication/set-password";
import PrivacyConsent from "layouts/authentication/privacy-consent";
import RegistrationLanding from "layouts/landing";
import Reports from "layouts/school-admin/reports";
import Leaderboard from "layouts/school-admin/leaderboard";
import Courses from "layouts/school-admin/courses";
import TeacherDashboard from "layouts/teacher";
import Teachers from "layouts/school-admin/teachers";

// @mui icons
import Icon from "@mui/material/Icon";

const routes = [
  {
    type: "collapse",
    name: "eduClub",
    key: "landing",
    icon: <Icon fontSize="small">home</Icon>,
    route: "/",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Register",
    key: "register",
    icon: <Icon fontSize="small">how_to_reg</Icon>,
    route: "/register",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Why Choose eduClub",
    key: "why-choose-us",
    icon: <Icon fontSize="small">verified_user</Icon>,
    route: "/why-choose-us",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Why Choose eduClub",
    key: "why-chose-us",
    icon: <Icon fontSize="small">verified_user</Icon>,
    route: "/why-chose-us",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Why Choose eduClub",
    key: "why_chose_us",
    icon: <Icon fontSize="small">verified_user</Icon>,
    route: "/why_chose_us",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Talk To Us",
    key: "talk-to-us",
    icon: <Icon fontSize="small">call</Icon>,
    route: "/talk-to-us",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Contact eduClub",
    key: "contact",
    icon: <Icon fontSize="small">chat</Icon>,
    route: "/contact",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Partners",
    key: "partners",
    icon: <Icon fontSize="small">handshake</Icon>,
    route: "/partners",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Digital Skills",
    key: "digital-skills",
    icon: <Icon fontSize="small">devices</Icon>,
    route: "/digital-skills",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Competitions",
    key: "public-competitions",
    icon: <Icon fontSize="small">emoji_events</Icon>,
    route: "/competitions",
    component: <RegistrationLanding />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Sign In",
    key: "sign-in",
    icon: <Icon fontSize="small">login</Icon>,
    route: "/authentication/sign-in",
    component: <SignIn />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "System Admin",
    key: "system-admin",
    icon: <Icon fontSize="small">admin_panel_settings</Icon>,
    route: "/system-admin",
    component: <SystemAdminDashboard />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "Typing / Quizzes",
    key: "system-admin-weekly-learning",
    icon: <Icon fontSize="small">keyboard</Icon>,
    route: "/system-admin/typing-quizzes",
    component: <WeeklyLearning />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "Schools",
    key: "system-admin-schools",
    icon: <Icon fontSize="small">business</Icon>,
    route: "/system-admin/schools",
    component: <SystemAdminSchools />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "Learners",
    key: "system-admin-learners",
    icon: <Icon fontSize="small">groups</Icon>,
    route: "/system-admin/learners",
    component: <SystemAdminLearners />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "School Staff",
    key: "system-admin-school-admins",
    icon: <Icon fontSize="small">manage_accounts</Icon>,
    route: "/system-admin/school-admins",
    component: <SystemAdminSchoolAdmins />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "Courses",
    key: "system-admin-courses",
    icon: <Icon fontSize="small">menu_book</Icon>,
    route: "/system-admin/courses",
    component: <SystemAdminCourses />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "Course Builder",
    key: "system-admin-course-builder",
    icon: <Icon fontSize="small">construction</Icon>,
    route: "/system-admin/courses/:templateId/builder",
    component: <CourseBuilder />,
    roles: ["system_admin"],
    hidden: true,
  },
  {
    type: "collapse",
    name: "Course Preview",
    key: "school-admin-course-preview",
    icon: <Icon fontSize="small">visibility</Icon>,
    route: "/school-admin/courses/:courseId/preview",
    component: <CourseOverview />,
    roles: ["school_admin", "teacher"],
    hidden: true,
  },
  {
    type: "collapse",
    name: "Module Preview",
    key: "school-admin-module-preview",
    icon: <Icon fontSize="small">play_circle</Icon>,
    route: "/school-admin/courses/:courseId/preview/modules/:moduleId/learn",
    component: <ModuleLearn />,
    roles: ["school_admin", "teacher"],
    hidden: true,
  },
  {
    type: "collapse",
    name: "Course Reviews",
    key: "system-admin-course-reviews",
    icon: <Icon fontSize="small">reviews</Icon>,
    route: "/system-admin/courses/:templateId/reviews",
    component: <CourseReviews />,
    roles: ["system_admin"],
    hidden: true,
  },
  {
    type: "collapse",
    name: "Academic",
    key: "system-admin-academic",
    icon: <Icon fontSize="small">calendar_month</Icon>,
    route: "/system-admin/academic",
    component: <SystemAdminAcademic />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "Competitions",
    key: "system-admin-competitions",
    icon: <Icon fontSize="small">emoji_events</Icon>,
    route: "/system-admin/competitions",
    component: <SystemAdminCompetitions />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "Reports",
    key: "system-admin-reports",
    icon: <Icon fontSize="small">assessment</Icon>,
    route: "/system-admin/reports",
    component: <SystemAdminReports />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "Certificates",
    key: "system-admin-certificates",
    icon: <Icon fontSize="small">workspace_premium</Icon>,
    route: "/system-admin/certificates",
    component: <SystemAdminCertificates />,
    roles: ["system_admin"],
  },
  {
    type: "collapse",
    name: "School Admin",
    key: "school-admin",
    icon: <Icon fontSize="small">school</Icon>,
    route: "/school-admin",
    component: <SchoolAdminDashboard />,
    roles: ["school_admin"],
  },
  {
    type: "collapse",
    name: "Teacher Dashboard",
    key: "teacher-dashboard",
    icon: <Icon fontSize="small">space_dashboard</Icon>,
    route: "/teacher",
    component: <TeacherDashboard />,
    roles: ["teacher"],
  },
  {
    type: "collapse",
    name: "Teachers",
    key: "school-admin-teachers",
    icon: <Icon fontSize="small">co_present</Icon>,
    route: "/school-admin/teachers",
    component: <Teachers />,
    roles: ["school_admin"],
  },
  {
    type: "collapse",
    name: "Learners",
    key: "school-admin-learners",
    icon: <Icon fontSize="small">groups</Icon>,
    route: "/school-admin/learners",
    component: <SchoolAdminLearners />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "Allocations",
    key: "school-admin-allocations",
    icon: <Icon fontSize="small">assignment_ind</Icon>,
    route: "/school-admin/allocations",
    component: <SchoolAdminAllocations />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "Learner Progress",
    key: "school-admin-progress",
    icon: <Icon fontSize="small">insights</Icon>,
    route: "/school-admin/progress",
    component: <SchoolAdminProgress />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "My Dashboard",
    key: "learner",
    icon: <Icon fontSize="small">person</Icon>,
    route: "/learner",
    component: <LearnerDashboard />,
    roles: ["learner"],
  },
  {
    type: "collapse",
    name: "Typing / Quizzes",
    key: "learner-weekly-learning",
    icon: <Icon fontSize="small">keyboard</Icon>,
    route: "/learner/typing-quizzes",
    component: <WeeklyLearning />,
    roles: ["learner"],
  },
  {
    type: "collapse",
    name: "My Courses",
    key: "learner-courses",
    icon: <Icon fontSize="small">menu_book</Icon>,
    route: "/learner/courses",
    component: <LearnerDashboard />,
    roles: ["learner"],
  },
  {
    type: "collapse",
    name: "Course Overview",
    key: "learner-course-overview",
    icon: <Icon fontSize="small">menu_book</Icon>,
    route: "/learner/courses/:courseId",
    component: <CourseOverview />,
    roles: ["learner"],
    hidden: true,
  },
  {
    type: "collapse",
    name: "Module Learning",
    key: "learner-module-learn",
    icon: <Icon fontSize="small">play_circle</Icon>,
    route: "/learner/courses/:courseId/modules/:moduleId/learn",
    component: <ModuleLearn />,
    roles: ["learner"],
    hidden: true,
  },
  {
    type: "collapse",
    name: "My Progress",
    key: "learner-progress",
    icon: <Icon fontSize="small">trending_up</Icon>,
    route: "/learner/progress",
    component: <LearnerProgress />,
    roles: ["learner"],
  },
  {
    type: "collapse",
    name: "Competitions",
    key: "learner-competitions",
    icon: <Icon fontSize="small">emoji_events</Icon>,
    route: "/learner/competitions",
    component: <LearnerCompetitions />,
    roles: ["learner"],
  },
  {
    type: "collapse",
    name: "My Certificates",
    key: "learner-certificates",
    icon: <Icon fontSize="small">workspace_premium</Icon>,
    route: "/learner/certificates",
    component: <LearnerCertificates />,
    roles: ["learner"],
  },
  {
    type: "collapse",
    name: "My Profile",
    key: "learner-profile",
    icon: <Icon fontSize="small">account_circle</Icon>,
    route: "/learner/profile",
    component: <LearnerProfile />,
    roles: ["learner"],
  },
  {
    type: "collapse",
    name: "Reset Password",
    key: "reset-password",
    icon: <Icon fontSize="small">vpn_key</Icon>,
    route: "/authentication/reset-password",
    component: <ResetPassword />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Forgot Password",
    key: "forgot-password",
    icon: <Icon fontSize="small">lock_reset</Icon>,
    route: "/authentication/forgot-password",
    component: <ForgotPassword />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Set Password",
    key: "set-password",
    icon: <Icon fontSize="small">password</Icon>,
    route: "/authentication/set-password",
    component: <SetPassword />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Privacy Consent",
    key: "privacy-consent",
    icon: <Icon fontSize="small">privacy_tip</Icon>,
    route: "/privacy-consent",
    component: <PrivacyConsent />,
    hidden: true,
  },
  {
    type: "collapse",
    name: "Reports",
    key: "reports",
    icon: <Icon fontSize="small">assessment</Icon>,
    route: "/school-admin/reports",
    component: <Reports />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "Typing / Quizzes",
    key: "school-admin-weekly-learning",
    icon: <Icon fontSize="small">keyboard</Icon>,
    route: "/school-admin/typing-quizzes",
    component: <WeeklyLearning />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "Leaderboard",
    key: "leaderboard",
    icon: <Icon fontSize="small">emoji_events</Icon>,
    route: "/school-admin/leaderboard",
    component: <Leaderboard />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "Competitions",
    key: "school-admin-competitions",
    icon: <Icon fontSize="small">emoji_events</Icon>,
    route: "/school-admin/competitions",
    component: <SchoolAdminCompetitions />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "Courses",
    key: "courses",
    icon: <Icon fontSize="small">school</Icon>,
    route: "/school-admin/courses",
    component: <Courses />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "Course Builder",
    key: "school-admin-course-builder",
    icon: <Icon fontSize="small">construction</Icon>,
    route: "/school-admin/courses/:courseId/builder",
    component: <CourseBuilder />,
    roles: ["school_admin", "teacher"],
    hidden: true,
  },
  {
    type: "collapse",
    name: "Course Reviews",
    key: "school-admin-course-reviews",
    icon: <Icon fontSize="small">reviews</Icon>,
    route: "/school-admin/courses/:courseId/reviews",
    component: <CourseReviews />,
    roles: ["school_admin", "teacher"],
    hidden: true,
  },
  {
    type: "collapse",
    name: "Certificates",
    key: "school-admin-certificates",
    icon: <Icon fontSize="small">workspace_premium</Icon>,
    route: "/school-admin/certificates",
    component: <SchoolAdminCertificates />,
    roles: ["school_admin", "teacher"],
  },
  {
    type: "collapse",
    name: "School Settings",
    key: "school-admin-settings",
    icon: <Icon fontSize="small">tune</Icon>,
    route: "/school-admin/settings",
    component: <SchoolSettings />,
    roles: ["school_admin"],
  },
];

export default routes;
