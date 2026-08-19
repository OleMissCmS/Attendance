# Attendance Tracker

Local QR attendance for multiple faculty, courses, and sections.

## Local setup

1. Copy `.env.example` to `.env.local` and add your Supabase URL and publishable key (already gitignored).
2. In the [Supabase Auth URL settings](https://supabase.com/dashboard/project/zpqambepgirxernwnjyc/auth/url-configuration):
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback` (optional; password login does not need a magic link)
3. For local faculty accounts, turn off **Confirm email** in Auth providers so password signup can sign in immediately.
4. Run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Faculty create an account at `/login` with email and password. The first person to sign up becomes faculty. Students do not create accounts.

## Classroom flow

- Faculty starts a session and projects the QR plus 6-character code.
- The QR/code changes every 10 seconds; a code stays valid for 30 seconds.
- Students open the QR or **My classes**, type their roster email (`username@go.olemiss.edu`) and the classroom code. No email verification.
- Each phone is locked to the first student email it uses, so the same phone cannot check in a second student.

## Blackboard roster

Upload a Grade Center download as CSV, XLS, or XLSX (including UTF-16 LE TSV `.xls` files). The parser keeps Last Name, First Name, Username, and Student ID and ignores changing assignment columns. Check-in email is `Username@go.olemiss.edu`. Those identity fields are stored encrypted so Reports can rebuild a Grade Center upload.

## Student data

Student emails, names, usernames, and student IDs are stored as HMAC hashes (for matching) plus AES-256-GCM ciphertext (for faculty display and Blackboard export). Encryption keys stay in `.env.local` and are not committed. Incognito check-ins and first-time phones after a section’s fourth class (`prior_count >= 4`) are flagged in Reports. This is a technical control, not legal advice about FERPA.

## Reports

Every filter on **Reports** is optional. With none selected, the page lists all courses and sections the faculty member owns or is a guest on. Rows include course and section (term · number), session date, start time, stop time, and duration. **No Show** shows attended and missed counts per student per section. **At Risk** flags consecutive absences within one section (default threshold 3). **Download for Blackboard** requires a single section.

## Guests

Owners use **Invite Guests (e.g., GAs)** / **Make Guest** and check specific sections. Guests only see those sections.

## Test mode

Set `NEXT_PUBLIC_TEST_MODE=true` and `ALLOW_TEST_STUDENT=true` in `.env.local` only. The projector QR becomes clickable, and `Test@test.com` can check in without being on the roster (classroom code still required; device lock is skipped). Turn both flags off for production. Also set `allow_test_student` to false in the database when going live.

