const PRIVACY_POLICY = {
  version: "2026-05-26",
  title: "eduClub LMS Privacy Notice and User Agreement",
  summary:
    "eduClub LMS collects the minimum account, school, learning, assessment, report, certificate, and security data needed to run the learning platform safely.",
  dataCollected: [
    "Account identifiers: name, email, username, role, school, active status, and password security metadata.",
    "Learner profile records: school, grade, stream or class, term, academic year, and linked login account.",
    "Self-registration and parental consent records: learner name, learner email, selected school and grade, parent or guardian name, phone, email where provided, consent choices, IP address, user agent, and timestamp.",
    "Learning records: course allocations, completion status, progress, weekly performance marks, leaderboards, certificates, and reports.",
    "Security and operations records: login tokens, MFA codes for administrators, audit logs, notifications, IP address, user agent, timestamps, and system error records.",
    "Uploaded or generated files: school logos, learner reports, certificates, and other files submitted through approved eduClub workflows.",
  ],
  uses: [
    "Create and manage school, administrator, teacher, and learner accounts.",
    "Deliver courses, allocate learners, track progress, prepare reports, issue certificates, and show dashboards.",
    "Protect accounts, enforce role-based access, investigate misuse, maintain audit trails, and keep the service reliable.",
    "Communicate essential account, security, notification, report, and learning updates.",
    "Send parents or learners information about upcoming competitions and open courses where consent is given.",
    "Meet legal, safeguarding, school administration, and record-keeping responsibilities.",
  ],
  agreement: [
    "Users must only access accounts and learner records they are authorized to use.",
    "Administrators and teachers must handle learner data confidentially and only for approved school purposes.",
    "Users must not share passwords, MFA codes, reports, certificates, or learner personal data with unauthorized people.",
    "eduClub may restrict access, audit activity, or disable accounts to protect learners and the platform.",
    "By continuing, the user confirms they have read this notice and agrees to the collection and use of data described here.",
    "For learner self-registration, the parent or guardian confirms they have authority to register the learner and consent to eduClub processing the learner details for platform access, competitions, open courses, safety, and school administration.",
  ],
  retention:
    "Records are kept only as long as needed for learning delivery, school administration, security, legal, audit, and backup purposes, then deleted or anonymized where appropriate.",
  contact:
    "For access, correction, deletion, consent withdrawal, or privacy questions, contact the eduClub administrator or the school data protection contact.",
};

module.exports = PRIVACY_POLICY;
