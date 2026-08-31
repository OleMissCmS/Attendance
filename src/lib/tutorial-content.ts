export type TutorialImage = {
  src: string
  alt: string
  caption: string
}

export type TutorialTopic = {
  id: string
  title: string
  summary: string
  paragraphs: string[]
  steps?: string[]
  callouts?: { title: string; body: string }[]
  links?: { href: string; label: string }[]
  images?: TutorialImage[]
}

/**
 * Body text may include markdown-style links: [Label](/path) or [email](mailto:…).
 */
export const TUTORIAL_TOPICS: TutorialTopic[] = [
  {
    id: "overview",
    title: "Overview",
    summary:
      "Attendance Tracker is for Ole Miss faculty to take classroom attendance with a QR code and short classroom code.",
    paragraphs: [
      "Faculty and invited guests (such as GAs) sign in with an email and password. Student advisors on the allowlist (for example emridout@olemiss.edu and mcclure@olemiss.edu) get a view-only advisor account: they can open Reports and Stats for every course, but cannot create courses, edit attendance, or change other users. Students do not create accounts. They save the email on your Blackboard roster at [Student check-in](/student), then check in with the code shown in class (via QR or check-in link).",
      "Use the header to move between [Courses](/faculty), [Reports](/faculty/reports), [Stats](/faculty/stats), [Manage Courses](/faculty/manage) (course owners only), [Account settings](/faculty/account), and this [Tutorial](/tutorial).",
    ],
    links: [
      { href: "/login", label: "Faculty sign in" },
      { href: "/faculty", label: "Courses (after sign-in)" },
      { href: "/student", label: "Student check-in" },
    ],
    images: [
      {
        src: "/tutorial/01-overview.png",
        alt: "Attendance Tracker header with faculty navigation",
        caption: "Faculty navigation after you sign in.",
      },
    ],
  },
  {
    id: "account",
    title: "Create your account",
    summary:
      "Create a faculty account with your @olemiss.edu email, then sign in.",
    paragraphs: [
      "Open [Faculty sign in](/login). Enter your school email and a password (at least 6 characters). Use Create faculty account the first time, then Sign in on later visits.",
      "Only @olemiss.edu addresses can register as faculty. Student go.olemiss.edu addresses cannot create faculty accounts. If the domain is wrong, the form shows “invalid email address” without explaining the rule.",
      "If your institution has email confirmation turned on in Supabase, confirm the email before signing in.",
    ],
    steps: [
      "Go to [Faculty sign in](/login).",
      "Enter you@olemiss.edu and a password of at least 6 characters.",
      "Choose Create faculty account, then Sign in.",
    ],
    callouts: [
      {
        title: "Domain rule",
        body: "Faculty signup requires @olemiss.edu — not @go.olemiss.edu.",
      },
    ],
    links: [{ href: "/login", label: "Open Faculty sign in" }],
    images: [
      {
        src: "/tutorial/02-login.png",
        alt: "Faculty sign in form with email and password",
        caption: "Sign in or create a faculty account on [Faculty sign in](/login).",
      },
    ],
  },
  {
    id: "manage-courses",
    title: "Manage Courses",
    summary:
      "Course owners create courses and sections under Manage Courses.",
    paragraphs: [
      "Open [Manage Courses](/faculty/manage) from the header (course owners only). Guests invited to sections do not see this link.",
      "Create a course with a course code and name (for example ACCY 201 and Introduction to Accounting). Then add sections with a term and section number. The app shows them as Term · Section Number.",
      "You can edit course or section labels later. Deleting a course or section is a soft archive: rosters, sessions, and attendance stay in the database.",
    ],
    steps: [
      "Open [Manage Courses](/faculty/manage).",
      "Enter Course Code and Name, then Create course.",
      "Choose the course, enter Term and Section number, then create the section.",
    ],
    links: [{ href: "/faculty/manage", label: "Manage Courses" }],
    images: [
      {
        src: "/tutorial/03-manage-courses.png",
        alt: "Manage Courses page with create course and section forms",
        caption: "Create courses and sections on [Manage Courses](/faculty/manage).",
      },
    ],
  },
  {
    id: "guests",
    title: "Invite guests (GAs)",
    summary:
      "Invite GAs or co-instructors by email to specific sections.",
    paragraphs: [
      "On [Manage Courses](/faculty/manage), use Invite Guests. Enter their email and check the sections they should access.",
      "Guests can open those courses on [Courses](/faculty) (with a Guest badge), start sessions, and use [Reports](/faculty/reports) and [Stats](/faculty/stats) for invited sections. They cannot create or archive courses under [Manage Courses](/faculty/manage).",
      "Guest emails can be go.olemiss.edu or other addresses. They still need to create a password account when they first sign in at [Faculty sign in](/login), after you invite them.",
    ],
    steps: [
      "On [Manage Courses](/faculty/manage), enter the guest email.",
      "Select one or more sections.",
      "Submit the invite, then tell the guest to sign in at [Faculty sign in](/login).",
    ],
    links: [{ href: "/faculty/manage", label: "Manage Courses — Invite Guests" }],
    images: [
      {
        src: "/tutorial/04-invite-guests.png",
        alt: "Invite Guests form with section checkboxes",
        caption: "Invite a guest on [Manage Courses](/faculty/manage) and choose which sections they can access.",
      },
    ],
  },
  {
    id: "roster",
    title: "Build a roster",
    summary:
      "Upload a Blackboard Grade Center or Experience Class List file, or paste roster text on the section page.",
    paragraphs: [
      "Open a section from [Courses](/faculty). Upload a Blackboard Grade Center or Experience Class List CSV, XLS, or XLSX, or paste roster text.",
      "Accepted formats: Blackboard (with Username, Student Email, or Student ID) and Experience (Class List Summary with Student Name and ID). Email stored for check-in is Username@go.olemiss.edu or StudentID@go.olemiss.edu. Students already on the section are skipped; duplicates inside the same file are skipped. You can remove someone from the roster list afterward.",
    ],
    steps: [
      "From [Courses](/faculty), open the section.",
      "Choose a Blackboard or Experience file or paste the roster text.",
      "Select Add to roster and confirm students appear in the list.",
    ],
    callouts: [
      {
        title: "Supported file formats",
        body: "Both Blackboard Grade Center (Username, First/Last Name, Student ID) and Experience Class List (Student Name 'Last, First', ID) exports in .xlsx, .xls, or .csv are supported.",
      },
    ],
    links: [{ href: "/faculty", label: "Courses — open a section" }],
    images: [
      {
        src: "/tutorial/05-roster.png",
        alt: "Section page roster upload and student list",
        caption: "Upload or paste a Blackboard or Experience roster from a section opened via [Courses](/faculty).",
      },
    ],
  },
  {
    id: "start-session",
    title: "Start a check-in session",
    summary:
      "Start attendance from Courses for one or many sections, or from the section page.",
    paragraphs: [
      "On [Courses](/faculty), use Start Check-In Session to select sections and start them together. The app opens the Check-In Session QR Code display for a single new session, or returns you to [Courses](/faculty) with links when several start at once.",
      "From a section page you can also Start session or reopen Start Session when a session is already live. If a live session already exists, the app reuses it instead of creating a duplicate.",
    ],
    steps: [
      "Go to [Courses](/faculty).",
      "Under Start Check-In Session, select the sections that are meeting.",
      "Start sessions and open the Check-In Session QR Code screen for the class.",
    ],
    links: [{ href: "/faculty", label: "Courses — Start Check-In" }],
    images: [
      {
        src: "/tutorial/06-start-check-in.png",
        alt: "Start Check-In Session card with section checkboxes",
        caption: "Select sections and start check-in from [Courses](/faculty).",
      },
    ],
  },
  {
    id: "projector",
    title: "Check-In Session QR Code",
    summary:
      "Show the fullscreen QR code and 6-character classroom code while students check in.",
    paragraphs: [
      "The Check-In Session QR Code page shows a large QR code and a short code. Enter fullscreen if helpful so students in the back can see it.",
      "A new code appears about every 15 seconds. Each code stays valid for about 30 seconds (the current code plus the previous window). If a student waits too long, they must use the newest code on the screen.",
      "Use End session when class attendance is finished. Start a session from [Courses](/faculty) when you need this screen.",
    ],
    callouts: [
      {
        title: "Code timing",
        body: "New code every 15 seconds; each code remains valid for about 30 seconds.",
      },
    ],
    links: [{ href: "/faculty", label: "Courses — start a session" }],
    images: [
      {
        src: "/tutorial/07-projector.png",
        alt: "Check-In Session QR Code display with QR code and classroom code",
        caption: "Check-In Session QR Code view with QR and rotating classroom code.",
      },
    ],
  },
  {
    id: "student-check-in",
    title: "How students check in",
    summary:
      "Students save their roster email on [Student check-in](/student), then check in with the live session QR or classroom code — no student accounts.",
    paragraphs: [
      "On [Student check-in](/student), students enter the email on your roster and save it on that phone. That page only stores the email; it does not list their courses.",
      "When a session is live, they scan the QR code from the Check-In Session QR Code screen (or open the check-in link). The check-in form can use the saved email and the classroom code from the screen (the QR can prefill the code).",
      "A phone is locked to the first email that successfully checks in. That phone cannot check in as a different student later.",
    ],
    steps: [
      "Student opens [Student check-in](/student) and saves their roster email (usually username@go.olemiss.edu).",
      "In class, they scan the QR code (or open the check-in link from the instructor).",
      "They type the code from the Check-In Session QR Code screen and check in.",
    ],
    links: [{ href: "/student", label: "Student check-in" }],
    images: [
      {
        src: "/tutorial/08-student-check-in.png",
        alt: "Student check-in form with email and classroom code",
        caption: "After saving email on [Student check-in](/student), students check in via QR or classroom code.",
      },
    ],
  },
  {
    id: "roster-requests",
    title: "Roster add requests",
    summary:
      "Students missing from the roster can request addition after entering a valid classroom code.",
    paragraphs: [
      "If check-in says the student is not on the roster, the student sees a form for Last Name, First Name, Network ID, Student ID, and Email. There is no rush — the student does not need a new classroom code to finish the request.",
      "[Courses](/faculty) shows a warning icon on sections with pending requests. Open the section to see Roster Add Requests. Add puts the student on the roster and marks the student present for the session the student requested from. Reject dismisses the request.",
    ],
    links: [{ href: "/faculty", label: "Courses — look for warning icons" }],
    images: [
      {
        src: "/tutorial/09-roster-requests.png",
        alt: "Roster Add Requests card with Add and Reject buttons",
        caption: "Review roster add requests on the section page from [Courses](/faculty).",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    summary:
      "Filter attendance, edit marks, run No Show and At Risk lists, review flags, and download files.",
    paragraphs: [
      "On [Reports](/faculty/reports), filter by course, section, session, dates, and student. The attendance grid shows 1 for present and 0 for absent. Click a 1 or 0 to flip the mark for that session.",
      "Alternative reports include No Show, At Risk (adjust the consecutive-absence threshold in the At Risk header; default is 3), Flags, and Session log. Flags explain private/incognito check-ins, a new phone after 4 or more earlier meetings, and a phone already used by another student (Linked phone email vs Attempted sign-in email).",
      "Download grid CSV anytime. Blackboard Grade Center CSV/XLSX downloads require exactly one section selected in Filters.",
    ],
    steps: [
      "Open [Reports](/faculty/reports) and set course or section filters.",
      "Optionally pick one session to focus the grid.",
      "Click 1/0 cells to correct attendance if needed.",
      "Use No Show, At Risk, Flags, and downloads as needed.",
    ],
    links: [{ href: "/faculty/reports", label: "Reports" }],
    images: [
      {
        src: "/tutorial/10-reports.png",
        alt: "Reports page with attendance grid and alternative reports",
        caption: "Attendance grid and alternative reports on [Reports](/faculty/reports).",
      },
    ],
  },
  {
    id: "stats",
    title: "Stats",
    summary:
      "See attendance rates and charts without opening individual student rows.",
    paragraphs: [
      "[Stats](/faculty/stats) summarizes attendance rates for courses and sections you own or are invited to. Charts and KPIs cover overall rate, sessions, no-shows, and at-risk counts. Student names are not listed on this page.",
      "Use the filters when you want a narrower date range or a single course.",
    ],
    links: [{ href: "/faculty/stats", label: "Stats" }],
    images: [
      {
        src: "/tutorial/11-stats.png",
        alt: "Stats page with charts and KPI cards",
        caption: "[Stats](/faculty/stats) shows rates and charts for your courses.",
      },
    ],
  },
  {
    id: "security",
    title: "Account and security",
    summary:
      "Change your password and know how lockouts, idle logout, and device flags work.",
    paragraphs: [
      "[Account settings](/faculty/account) lets you change your password (current password, new password, confirm; minimum 6 characters).",
      "After about 5 hours without mouse, keyboard, scroll, or touch activity, you are signed out automatically.",
      "Too many failed sign-in attempts in a row locks the account. Contact [ChadS@olemiss.edu](mailto:ChadS@olemiss.edu) for help resetting the password.",
      "[Reports](/faculty/reports) may flag private/incognito check-ins, a new phone when the section already has 4 or more earlier meetings, or a phone already used by another student (tied to a different email or already checked in for that session).",
    ],
    links: [{ href: "/faculty/account", label: "Account settings" }],
    images: [
      {
        src: "/tutorial/12-account.png",
        alt: "Account settings change password form",
        caption: "Change your password under [Account settings](/faculty/account).",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Quick troubleshooting",
    summary: "Common issues and what to try first.",
    paragraphs: [
      "Use this checklist before assuming something is broken.",
    ],
    steps: [
      "Create faculty account fails with “invalid email address” — use @olemiss.edu, not go.olemiss.edu. Try again at [Faculty sign in](/login).",
      "Code expired or incorrect — use the newest code on the Check-In Session QR Code screen (codes rotate about every 15 seconds).",
      "This phone is already used by another student — that device is locked to a different roster email; use another phone or fix the mark in [Reports](/faculty/reports).",
      "Check-in says not on roster — the email must match the roster (usually username@go.olemiss.edu). Students can save that address on [Student check-in](/student) before class.",
      "Blackboard download missing — select exactly one section in [Reports](/faculty/reports) filters.",
      "Signed out unexpectedly — idle logout after 5 hours without activity, or an account lock after many failed logins. Contact [ChadS@olemiss.edu](mailto:ChadS@olemiss.edu) if locked out.",
      "Pending roster requests — look for the warning icon on [Courses](/faculty), then open the section.",
    ],
    links: [
      { href: "/login", label: "Faculty sign in" },
      { href: "/faculty/reports", label: "Reports" },
    ],
  },
]
