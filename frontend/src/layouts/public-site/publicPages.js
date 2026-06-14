export const SITE_ORIGIN = "https://www.educlub.co.ke";
export const BRAND_LOGO_URL = `${SITE_ORIGIN}/educlub-logo.png`;

export const SITE_CONTACT = {
  email: "support@educlub.co.ke",
  emailHref: "mailto:support@educlub.co.ke",
  phoneDisplay: "0740 073 575",
  phoneInternational: "+254 740 073 575",
  phoneHref: "tel:+254740073575",
  whatsappHref: "https://wa.me/254740073575",
};

export const PUBLIC_NAV = {
  primary: [
    { label: "Courses", path: "/courses" },
    { label: "Typing", path: "/typing" },
    { label: "Quizzes", path: "/quizzes" },
    { label: "Competitions", path: "/competitions" },
    { label: "Bootcamps", path: "/holiday-bootcamps" },
    { label: "For Schools", path: "/for-schools" },
  ],
  utility: [
    { label: "Log In", path: "/login" },
    { label: "Register", path: "/register" },
  ],
};

const registerCta = { label: "Register a Learner", path: "/register" };
const coursesCta = { label: "Explore Courses", path: "/courses" };
const schoolsCta = { label: "Bring eduClub to Your School", path: "/for-schools" };

function section(title, body, points = []) {
  return { title, body, points };
}

function coursePage({
  title,
  description,
  h1,
  intro,
  keywords,
  outcomes,
  projects,
  related,
}) {
  return {
    type: "course",
    title,
    description,
    h1,
    eyebrow: "Future skills learning pathway",
    intro,
    keywords,
    primaryCta: registerCta,
    secondaryCta: coursesCta,
    sections: [
      section(
        "What learners build",
        "Learners move from guided practice to independent projects. Activities combine explanation, experimentation, discussion, quizzes, reflection and practical challenges.",
        outcomes,
      ),
      section(
        "Project-based, progressive learning",
        "Each module builds on earlier skills while leaving room for personal ideas. Learners can revisit examples, try extension challenges and explain the choices they made.",
        projects,
      ),
    ],
    related,
    faqs: [
      {
        question: "Can a beginner join?",
        answer:
          "Yes. eduClub pathways begin with foundations and progress in manageable steps. Schools decide course allocation, while self-learning and extra practice are encouraged.",
      },
      {
        question: "Is the course only theory?",
        answer:
          "No. Learners create projects, solve challenges, discuss ideas, answer quizzes and reflect on how their work can improve.",
      },
    ],
  };
}

export const PUBLIC_PAGES = {
  "/": {
    type: "home",
    title: "eduClub Kenya | Online Courses, STEM Skills and Learning Tools for Kids",
    description:
      "eduClub is a Kenyan learning platform where children build digital skills through progressive courses, practical projects, typing, quizzes, competitions and school-supported learning.",
    h1: "Practical digital skills, STEM learning and online challenges for curious kids",
    eyebrow: "Learn. Build. Practise. Compete.",
    intro:
      "eduClub gives learners a clear place to build computer confidence and future-ready skills. Children can explore progressive courses, create real projects, practise typing, answer quizzes and join engaging challenges through one focused learning platform.",
    keywords: [
      "online courses for kids Kenya",
      "STEM courses for kids Kenya",
      "digital skills for children Kenya",
      "online learning platform Kenya",
      "future skills for children",
    ],
    primaryCta: coursesCta,
    secondaryCta: registerCta,
    tertiaryCta: schoolsCta,
    sections: [
      section(
        "Future skills children can use",
        "Pathways cover creative coding, programming, digital literacy, AI knowledge, data thinking, communication and independent learning.",
        [
          "Scratch, Python, web and mobile app development",
          "Artificial intelligence and responsible prompt engineering",
          "Typing, computer literacy, online safety and productivity",
          "Data analysis, computational thinking and learning-to-learn",
        ],
      ),
      section(
        "Designed for active learning",
        "Learners do more than watch. Modules combine projects, discussions, quizzes, challenges, reflection and optional Try More activities.",
        [
          "Progressive pathways for beginners and growing creators",
          "Project-based STEM and STEAM learning",
          "School visibility, learner progress and competitions",
        ],
      ),
    ],
    related: ["/courses", "/typing", "/competitions", "/holiday-bootcamps", "/for-schools"],
    faqs: [
      {
        question: "Who can use eduClub?",
        answer:
          "eduClub supports learners, parents, schools and academies. Learners can register directly, while schools control access to their allocated courses.",
      },
      {
        question: "What can children learn?",
        answer:
          "Learning pathways include Scratch, Python, web development, mobile apps, data analysis, AI literacy, prompt engineering, typing, digital literacy and learning-to-learn.",
      },
    ],
  },
  "/courses": {
    type: "catalogue",
    title: "Computer and STEM Courses for Kids in Kenya | eduClub",
    description:
      "Explore eduClub computer and STEM courses for children in Kenya, including Scratch, Python, web development, mobile apps, data analysis, AI and digital literacy.",
    h1: "Progressive computer and STEM courses that turn learners into confident creators",
    eyebrow: "eduClub course pathways",
    intro:
      "Our learning pathways are designed for different ages and experience levels. Learners begin with clear foundations, practise through guided examples and finish modules by building, explaining and improving meaningful projects.",
    keywords: [
      "computer courses for children Kenya",
      "coding classes for kids Kenya",
      "programming courses for kids Kenya",
      "STEM learning courses Kenya",
      "project based learning for kids",
    ],
    primaryCta: registerCta,
    secondaryCta: schoolsCta,
    sections: [
      section(
        "Choose a learning pathway",
        "Children can start visually with Scratch, grow into text programming, explore AI and data, or strengthen essential computer and study skills.",
        [
          "Creative coding and software development",
          "AI literacy, data thinking and responsible technology",
          "Digital foundations, typing and independent learning",
        ],
      ),
      section(
        "More than a collection of videos",
        "Every pathway is structured around outcomes, practical activities, discussion, assessment and personal extension work.",
        [
          "Real projects and challenges",
          "Quizzes with explanations",
          "Reflection and learner choice",
        ],
      ),
    ],
    related: [
      "/courses/scratch-coding",
      "/courses/python-programming",
      "/courses/artificial-intelligence",
      "/courses/digital-literacy",
    ],
    faqs: [],
  },
  "/courses/scratch-coding": coursePage({
    title: "Scratch Coding for Kids in Kenya | Progressive Courses | eduClub",
    description:
      "Children learn Scratch coding through progressive, project-based modules with games, stories, animations, STEM challenges, quizzes and creative extension projects.",
    h1: "Scratch coding courses where children learn by creating games, stories and solutions",
    intro:
      "The eduClub Scratch pathway welcomes beginners and keeps growing creators challenged. Learners explore blocks, events, movement, animation, variables, decisions, loops, debugging, teamwork and responsible AI ideas through complete projects.",
    keywords: [
      "Scratch coding for kids Kenya",
      "Scratch programming classes Kenya",
      "coding games for children",
      "project based Scratch course",
    ],
    outcomes: ["Sequence instructions", "Debug projects", "Use variables and decisions", "Design interactive stories and games"],
    projects: ["Animated stories", "STEM simulations", "Educational games", "Community problem-solving projects"],
    related: ["/courses/python-programming", "/holiday-bootcamps", "/competitions"],
  }),
  "/courses/python-programming": coursePage({
    title: "Python Programming for Kids and Teens in Kenya | eduClub",
    description:
      "Learn Python programming through age-appropriate explanations, coding practice, problem-solving challenges and projects that build confidence from beginner foundations.",
    h1: "Python programming that helps young learners move from ideas to working code",
    intro:
      "Learners develop text-based programming confidence step by step. They practise variables, input, decisions, loops, functions, collections, debugging and project planning while learning to explain how their programs work.",
    keywords: [
      "Python programming for kids Kenya",
      "Python classes for teens Kenya",
      "learn coding online Kenya",
      "beginner programming course students",
    ],
    outcomes: ["Read and write Python", "Break problems into steps", "Test and debug code", "Create reusable functions"],
    projects: ["Quiz programs", "Number games", "Useful calculators", "Data and automation mini-projects"],
    related: ["/courses/scratch-coding", "/courses/data-analysis", "/courses/artificial-intelligence"],
  }),
  "/courses/web-development": coursePage({
    title: "Web Development Classes for Kids and Teens in Kenya | eduClub",
    description:
      "Young learners build websites with HTML, CSS and JavaScript while practising design thinking, accessibility, online safety, testing and project presentation.",
    h1: "Web development classes where learners design and publish purposeful websites",
    intro:
      "The web development pathway turns internet users into thoughtful creators. Learners structure pages with HTML, style responsive layouts with CSS and add safe interaction with JavaScript through progressively larger projects.",
    keywords: [
      "web development classes for kids Kenya",
      "HTML CSS JavaScript students Kenya",
      "website design course for teens",
      "coding projects for learners",
    ],
    outcomes: ["Structure accessible pages", "Create responsive styles", "Add JavaScript interaction", "Test across screen sizes"],
    projects: ["Personal portfolio", "School information site", "Interactive quiz", "Community campaign website"],
    related: ["/courses/mobile-app-development", "/courses/python-programming", "/holiday-bootcamps"],
  }),
  "/courses/mobile-app-development": coursePage({
    title: "Mobile App Development for Young Learners in Kenya | eduClub",
    description:
      "Students learn mobile app development through interface design, user journeys, logic, testing and practical apps that respond to real learner and community needs.",
    h1: "Mobile app development that begins with people, problems and purposeful design",
    intro:
      "Learners explore how mobile apps are planned and improved before rushing into code. They create screens, map user journeys, add interaction, test with others and refine projects using feedback and responsible design principles.",
    keywords: [
      "mobile app development for students Kenya",
      "app design classes for kids",
      "mobile coding course teens",
      "young app developers Kenya",
    ],
    outcomes: ["Plan user journeys", "Design clear interfaces", "Build app logic", "Test and improve prototypes"],
    projects: ["Study planner", "Healthy habits app", "Local guide", "School or community helper"],
    related: ["/courses/web-development", "/courses/artificial-intelligence", "/courses/data-analysis"],
  }),
  "/courses/data-analysis": coursePage({
    title: "Data Analysis and Spreadsheet Skills for Students in Kenya | eduClub",
    description:
      "Learners build data analysis skills with spreadsheets, questions, cleaning, charts, interpretation and responsible communication using child-friendly projects.",
    h1: "Data analysis skills that help learners ask better questions and explain evidence",
    intro:
      "The pathway introduces data as a tool for understanding the world. Learners collect and organise information, use spreadsheets, spot errors, calculate summaries, choose useful charts and communicate what the evidence does and does not show.",
    keywords: [
      "data analysis course for students Kenya",
      "spreadsheet skills for children",
      "data literacy for kids",
      "Excel learning for students Kenya",
    ],
    outcomes: ["Organise clean data", "Use spreadsheet formulas", "Choose suitable charts", "Explain findings responsibly"],
    projects: ["Class survey", "Weather patterns", "Reading or activity tracker", "Community data story"],
    related: ["/courses/python-programming", "/courses/artificial-intelligence", "/courses/digital-literacy"],
  }),
  "/courses/artificial-intelligence": coursePage({
    title: "Artificial Intelligence Course for Kids in Kenya | Safe AI Literacy | eduClub",
    description:
      "Age-appropriate AI literacy for children covering how AI works, useful applications, limitations, bias, privacy, verification and responsible creative projects.",
    h1: "Artificial intelligence knowledge that teaches children to think, verify and create responsibly",
    intro:
      "Learners explore what AI can and cannot do without treating it as magic or an unquestionable answer machine. Activities cover patterns, training data, generated content, mistakes, bias, privacy, human judgement and safe use.",
    keywords: [
      "artificial intelligence course for kids Kenya",
      "AI literacy for students",
      "safe AI learning children",
      "future technology skills Kenya",
    ],
    outcomes: ["Explain basic AI ideas", "Recognise limitations and bias", "Protect personal information", "Verify AI-assisted work"],
    projects: ["AI decision audit", "Responsible use guide", "Human-versus-AI comparison", "AI-assisted creative plan"],
    related: ["/courses/prompt-engineering", "/courses/data-analysis", "/courses/learning-to-learn"],
  }),
  "/courses/prompt-engineering": coursePage({
    title: "Prompt Engineering for Students in Kenya | Responsible AI Skills | eduClub",
    description:
      "Students learn prompt engineering through clear instructions, context, examples, iteration, fact-checking, privacy and responsible use of generative AI tools.",
    h1: "Prompt engineering that develops clear communication, critical thinking and verification",
    intro:
      "Prompting is taught as a thinking and communication skill rather than a shortcut around learning. Learners define goals, add useful context, set constraints, compare outputs, improve instructions and verify important claims.",
    keywords: [
      "prompt engineering for students Kenya",
      "AI prompting course for kids",
      "generative AI skills learners",
      "responsible AI use schools",
    ],
    outcomes: ["Write clear prompts", "Use context and constraints", "Compare and improve outputs", "Check facts and protect privacy"],
    projects: ["Study-support prompt", "Creative brief", "Output quality checklist", "Responsible classroom prompt guide"],
    related: ["/courses/artificial-intelligence", "/courses/learning-to-learn", "/courses/digital-literacy"],
  }),
  "/courses/digital-literacy": coursePage({
    title: "Digital Literacy and Computer Skills for Kids in Kenya | eduClub",
    description:
      "Practical digital literacy for children covering computer basics, files, typing, productivity tools, online research, communication, privacy, safety and digital citizenship.",
    h1: "Digital literacy that helps children use computers safely, confidently and productively",
    intro:
      "Learners build the everyday computer skills needed for school and future work. They practise organising files, creating documents and presentations, researching carefully, communicating respectfully and making safer decisions online.",
    keywords: [
      "digital literacy for kids Kenya",
      "computer skills for children Kenya",
      "computer literacy classes Kenya",
      "online safety course children",
    ],
    outcomes: ["Manage files and devices", "Create useful documents", "Research and communicate online", "Protect accounts and privacy"],
    projects: ["Digital safety poster", "Research presentation", "Organised project folder", "Responsible communication guide"],
    related: ["/typing", "/courses/learning-to-learn", "/courses/web-development"],
  }),
  "/courses/learning-to-learn": coursePage({
    title: "Learning to Learn and Study Skills for Students in Kenya | eduClub",
    description:
      "Learners develop study skills, self-directed learning, goal setting, research, reflection, problem solving, feedback habits and strategies for learning difficult skills.",
    h1: "Learning-to-learn skills that help children become more independent and resilient",
    intro:
      "This pathway helps learners understand that strong learning is planned, practised and reflected upon. Children set realistic goals, break down difficult tasks, choose strategies, ask for feedback and adjust when the first attempt does not work.",
    keywords: [
      "learning to learn course for students",
      "study skills for children Kenya",
      "self directed learning kids",
      "problem solving skills students",
    ],
    outcomes: ["Set practical goals", "Choose study strategies", "Use feedback well", "Reflect and adapt"],
    projects: ["Personal learning plan", "Study experiment", "Research challenge", "Progress reflection portfolio"],
    related: ["/courses/digital-literacy", "/courses/artificial-intelligence", "/quizzes"],
  }),
  "/typing": {
    type: "service",
    title: "Typing Practice and Touch Typing for Kids in Kenya | eduClub",
    description:
      "Children improve typing speed, accuracy and keyboard confidence through structured practice, quizzes, progress tracking and engaging typing competitions.",
    h1: "Typing practice that builds speed, accuracy and confidence for schoolwork",
    eyebrow: "Keyboard skills for modern learning",
    intro:
      "Typing is a foundation for digital learning, coding and communication. eduClub gives learners regular opportunities to practise correct technique, measure progress and apply keyboard skills in friendly challenges.",
    keywords: ["typing practice for kids Kenya", "touch typing lessons students", "typing competition Kenya", "keyboard skills children"],
    primaryCta: registerCta,
    secondaryCta: { label: "See Competitions", path: "/competitions" },
    sections: [
      section("Build dependable keyboard habits", "Learners focus on accuracy before speed and improve through consistent, age-appropriate practice.", ["Home-row awareness", "Accuracy and rhythm", "Speed goals", "Progress reflection"]),
      section("Useful for learners and schools", "Typing supports assignments, research, coding and computer-based assessment.", ["Individual practice", "School challenges", "Friendly competitions"]),
    ],
    related: ["/competitions", "/quizzes", "/courses/digital-literacy"],
    faqs: [],
  },
  "/quizzes": {
    type: "service",
    title: "Educational Quizzes and Revision Challenges for Kids | eduClub Kenya",
    description:
      "eduClub quizzes help learners practise recall, receive explanations, identify gaps and build confidence across digital skills, STEM and school-friendly learning topics.",
    h1: "Educational quizzes that turn mistakes into useful next steps",
    eyebrow: "Practise, check and improve",
    intro:
      "Quizzes should support learning, not merely produce a score. eduClub activities use questions, hints and explanations to help learners notice what they understand and what deserves another attempt.",
    keywords: ["educational quizzes for children Kenya", "online quizzes for students", "revision challenges kids", "STEM quiz Kenya"],
    primaryCta: registerCta,
    secondaryCta: coursesCta,
    sections: [
      section("Assessment for learning", "Learners answer, review explanations and retry where mastery matters.", ["Immediate feedback", "Hints and explanations", "Progressive challenge"]),
      section("Varied question formats", "Activities can check recall, reasoning, ordering, matching and practical understanding.", ["Multiple choice", "Short answers", "Ordering and matching"]),
    ],
    related: ["/courses", "/competitions", "/typing"],
    faqs: [],
  },
  "/competitions": {
    type: "service",
    title: "Typing, Coding and STEM Competitions for Students in Kenya | eduClub",
    description:
      "Engaging learner competitions in typing, coding, maths, science and STEM give Kenyan students clear goals, practice opportunities and positive recognition.",
    h1: "Learner competitions that make practice purposeful, visible and exciting",
    eyebrow: "Challenge skills, celebrate progress",
    intro:
      "eduClub competitions give learners a reason to practise and apply skills. Events can support typing, coding, maths, science and STEM while keeping rules, eligibility and results clear for participants and schools.",
    keywords: ["school competitions Kenya", "typing competition students Kenya", "coding competitions for students", "STEM competition Kenya"],
    primaryCta: registerCta,
    secondaryCta: schoolsCta,
    sections: [
      section("Skills worth practising", "Competition themes connect to useful learning rather than random clicks.", ["Typing speed and accuracy", "Coding and problem solving", "Maths, science and STEM"]),
      section("Participation with clarity", "Open competitions display their requirements, timing and results inside the learner platform.", ["Learner dashboard", "Progress and position", "School participation"]),
    ],
    related: ["/typing", "/quizzes", "/holiday-bootcamps"],
    faqs: [],
  },
  "/holiday-bootcamps": {
    type: "programme",
    title: "Holiday Coding and STEM Bootcamps for Kids in Kenya | eduClub",
    description:
      "Ask about eduClub holiday coding and STEM bootcamps for children in Kenya, featuring practical projects in Scratch, Python, web, AI, digital skills and problem solving.",
    h1: "Holiday coding and STEM bootcamps where children build something meaningful",
    eyebrow: "School-break learning",
    intro:
      "Holiday programmes create focused time for children to explore technology, collaborate and complete practical projects. Themes may include Scratch, Python, websites, AI literacy, digital creativity and STEM problem solving.",
    keywords: ["holiday coding bootcamp Kenya", "holiday tech bootcamp Nairobi", "STEM holiday camp kids Kenya", "school holiday computer classes"],
    primaryCta: { label: "Ask About the Next Bootcamp", path: "/contact" },
    secondaryCta: coursesCta,
    sections: [
      section("Built around projects", "Bootcamp learners work toward visible outcomes they can demonstrate and explain.", ["Coding projects", "Creative technology", "Team challenges", "Project showcase"]),
      section("Dates confirmed before enrolment", "Contact eduClub for the next available programme, venue, age group and delivery format.", ["Online or supported delivery", "Age-appropriate groups", "Clear programme details"]),
    ],
    related: ["/courses/scratch-coding", "/courses/python-programming", "/contact"],
    faqs: [],
  },
  "/for-schools": {
    type: "schools",
    title: "LMS and Digital Skills Programmes for Schools in Kenya | eduClub",
    description:
      "eduClub helps Kenyan schools deliver digital-skills courses, learner tracking, typing and STEM challenges, competitions and progressive project-based learning.",
    h1: "A practical LMS and future-skills programme for Kenyan schools and academies",
    eyebrow: "For schools, clubs and learning organisations",
    intro:
      "Schools can use eduClub to organise progressive learning, allocate courses, monitor learner activity and add competitions to digital-skills programmes. The platform supports school control while giving learners a focused experience.",
    keywords: ["LMS for schools in Kenya", "learning management system Kenya", "coding curriculum schools Kenya", "online learning tools Kenyan schools"],
    primaryCta: { label: "Talk to eduClub for Schools", path: "/contact" },
    secondaryCta: coursesCta,
    sections: [
      section("One place for delivery and visibility", "School teams can manage learners, course access, activities, progress and reporting.", ["Course allocation", "Learner progress", "Teacher oversight", "Competitions and reports"]),
      section("Progressive future-skills content", "Use ready course templates or support school-specific learning plans.", ["Scratch and coding", "Digital literacy", "AI and data", "Typing and quizzes"]),
    ],
    related: ["/courses", "/competitions", "/contact"],
    faqs: [],
  },
  "/about": {
    type: "about",
    title: "About eduClub | Future Skills and Online Learning for Kenyan Kids",
    description:
      "Learn how eduClub supports Kenyan children, schools and academies with practical digital skills, progressive courses, project-based learning and engaging competitions.",
    h1: "eduClub helps young people become confident creators, thinkers and lifelong learners",
    eyebrow: "About eduClub",
    intro:
      "eduClub is a learning platform built around practical participation. We believe children learn technology best when they create, test, discuss, reflect and improve rather than simply consuming information.",
    keywords: ["eduClub Kenya", "future skills education Kenya", "project based learning children", "digital education organisation Kenya"],
    primaryCta: coursesCta,
    secondaryCta: { label: "Contact eduClub", path: "/contact" },
    sections: [
      section("Our learning approach", "Content combines progressive instruction with learner choice and real projects.", ["STEM and STEAM thinking", "Projects and challenges", "Reflection and feedback"]),
      section("Responsible technology learning", "Safety, privacy, verification and thoughtful technology use are part of future readiness.", ["Parent consent", "AI literacy", "Digital citizenship"]),
    ],
    related: ["/courses", "/for-schools", "/contact"],
    faqs: [],
  },
  "/contact": {
    type: "contact",
    title: "Contact eduClub Kenya | Courses, Schools and Bootcamp Enquiries",
    description:
      "Contact eduClub about learner registration, school LMS programmes, coding and STEM courses, competitions or future holiday bootcamps by email, phone or WhatsApp.",
    h1: "Talk to eduClub about learners, schools, courses or upcoming programmes",
    eyebrow: "We are ready to help",
    intro:
      "Choose the contact method that works for you. Tell us whether you are asking as a learner, parent, school, academy or programme partner so we can respond with the most useful next step.",
    keywords: ["contact eduClub Kenya", "coding courses enquiry Kenya", "school LMS enquiry", "STEM programme contact Kenya"],
    primaryCta: { label: "Email Support", path: SITE_CONTACT.emailHref },
    secondaryCta: { label: "WhatsApp eduClub", path: SITE_CONTACT.whatsappHref },
    sections: [
      section("Learners and parents", "Ask about registration, course access, competitions, typing or future holiday programmes.", [SITE_CONTACT.email, SITE_CONTACT.phoneInternational]),
      section("Schools and academies", "Ask about LMS setup, curriculum pathways, learner tracking, competitions and partnership delivery.", ["School demonstrations", "Programme planning", "Platform support"]),
    ],
    related: ["/register", "/for-schools", "/holiday-bootcamps"],
    faqs: [],
  },
  "/privacy": {
    type: "legal",
    title: "eduClub Privacy Notice | Learner and Parent Data",
    description:
      "Read how eduClub handles learner, parent, school and platform information, including registration data, consent, learning records, security and support requests.",
    h1: "Privacy information for eduClub learners, parents, schools and platform users",
    eyebrow: "Privacy and child data",
    intro:
      "eduClub handles information needed to provide accounts, learning, course access, competitions, progress and support. Child-focused services require particular care, clear guardian involvement and appropriate school controls.",
    keywords: ["eduClub privacy", "learner data privacy Kenya", "child online learning privacy", "school LMS data protection"],
    primaryCta: { label: "Contact Privacy Support", path: SITE_CONTACT.emailHref },
    secondaryCta: { label: "Read User Agreement", path: "/user-agreement" },
    sections: [
      section("Information and purpose", "Registration, guardian, school, learning and technical information is used to operate and protect the service.", ["Account creation", "Learning progress", "Competitions", "Security and support"]),
      section("Choices and questions", "Users and guardians may contact eduClub about access, correction, consent or appropriate account handling.", ["Guardian consent", "School administration", "Support requests"]),
    ],
    related: ["/user-agreement", "/contact", "/register"],
    faqs: [],
  },
  "/user-agreement": {
    type: "legal",
    title: "eduClub User Agreement | Safe and Responsible Platform Use",
    description:
      "The eduClub user agreement explains account responsibility, respectful participation, acceptable use, learner safety, course content and platform availability.",
    h1: "User agreement for safe, respectful and responsible participation on eduClub",
    eyebrow: "Platform terms",
    intro:
      "Using eduClub means respecting other learners, protecting account details, submitting appropriate work and following course, school and competition rules. Guardians and schools support children in using the platform responsibly.",
    keywords: ["eduClub user agreement", "online learning acceptable use", "learner platform rules", "school LMS terms"],
    primaryCta: { label: "Register a Learner", path: "/register" },
    secondaryCta: { label: "Contact Support", path: "/contact" },
    sections: [
      section("Responsible participation", "Users must provide appropriate information, protect accounts and avoid harmful, dishonest or disruptive behaviour.", ["Respectful communication", "Original work", "Account security", "Competition fairness"]),
      section("Learning and availability", "Course allocation, schedules and programme availability may be controlled by schools or confirmed separately by eduClub.", ["No guaranteed placement", "Published programme details", "Reasonable platform changes"]),
    ],
    related: ["/privacy", "/contact", "/register"],
    faqs: [],
  },
};

export const PUBLIC_PAGE_PATHS = Object.keys(PUBLIC_PAGES);

export const PUBLIC_ALIASES = {
  "/authentication/sign-in": "/login",
  "/digital-skills": "/courses/digital-literacy",
  "/why-choose-us": "/about",
  "/why-chose-us": "/about",
  "/why_chose_us": "/about",
  "/talk-to-us": "/contact",
  "/partners": "/about",
};

export const COURSE_PATHS = PUBLIC_PAGE_PATHS.filter(
  (path) => PUBLIC_PAGES[path].type === "course",
);

export function getPublicPage(pathname) {
  const preferredPath = PUBLIC_ALIASES[pathname] || pathname;
  return {
    path: preferredPath,
    page: PUBLIC_PAGES[preferredPath] || null,
  };
}
