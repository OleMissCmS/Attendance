"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireCourseOwner, requireFaculty, requireWritableFaculty } from "@/lib/auth"
import {
  encryptOptionalPii,
  encryptPii,
  hashEmail,
  usernameFromEmail,
} from "@/lib/pii"
import { parseBlackboardRoster, parseRosterFile } from "@/lib/blackboard-roster"
import {
  collapseWhitespace,
  isPlaceholderValue,
} from "@/lib/student-identity"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function setSessionAttendance(input: {
  sessionId: string
  emailHash: string
  present: boolean
}): Promise<{ error?: string }> {
  await requireWritableFaculty()
  const sessionId = input.sessionId.trim()
  const emailHash = input.emailHash.trim()
  if (!sessionId || emailHash.length < 32) {
    return { error: "Invalid attendance update." }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc("set_session_attendance", {
    p_session_id: sessionId,
    p_email_hash: emailHash,
    p_present: input.present,
  })
  if (error) return { error: error.message }
  return {}
}

export async function createCourse(formData: FormData) {
  const profile = await requireCourseOwner()
  const supabase = await createClient()
  const code = collapseWhitespace(String(formData.get("code") ?? ""))
  const name = collapseWhitespace(String(formData.get("name") ?? ""))
  if (!code || !name) redirect("/faculty/manage?error=missing")
  if (isPlaceholderValue(code) || isPlaceholderValue(name)) {
    redirect("/faculty/manage?error=placeholder")
  }

  const { data: existing } = await supabase
    .from("courses")
    .select("id")
    .eq("faculty_id", profile.id)
    .is("deleted_at", null)
    .ilike("code", code)
  if (existing?.length) redirect("/faculty/manage?error=duplicate")

  const { error } = await supabase.from("courses").insert({
    faculty_id: profile.id,
    code,
    name,
  })
  if (error) redirect("/faculty/manage?error=course")
  redirect("/faculty/manage")
}

export async function updateCourse(formData: FormData) {
  const profile = await requireCourseOwner()
  const supabase = await createClient()
  const courseId = Number(formData.get("course_id"))
  const code = collapseWhitespace(String(formData.get("code") ?? ""))
  const name = collapseWhitespace(String(formData.get("name") ?? ""))
  if (!courseId) redirect("/faculty/manage?error=course")
  if (!code || !name) redirect("/faculty/manage?error=missing")
  if (isPlaceholderValue(code) || isPlaceholderValue(name)) {
    redirect("/faculty/manage?error=placeholder")
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, faculty_id")
    .eq("id", courseId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!course || course.faculty_id !== profile.id) {
    redirect("/faculty/manage?error=owner")
  }

  const { data: existing } = await supabase
    .from("courses")
    .select("id")
    .eq("faculty_id", profile.id)
    .is("deleted_at", null)
    .ilike("code", code)
    .neq("id", courseId)
  if (existing?.length) redirect("/faculty/manage?error=duplicate")

  const { error } = await supabase
    .from("courses")
    .update({ code, name })
    .eq("id", courseId)
  if (error) redirect("/faculty/manage?error=course")
  redirect("/faculty/manage")
}

export async function createSection(formData: FormData) {
  await requireCourseOwner()
  const supabase = await createClient()
  const courseId = Number(formData.get("course_id"))
  const term = collapseWhitespace(String(formData.get("term") ?? ""))
  const sectionNumber = collapseWhitespace(
    String(formData.get("section_number") ?? ""),
  )
  if (!courseId || !term || !sectionNumber) {
    redirect("/faculty/manage?error=section-missing")
  }
  if (isPlaceholderValue(term) || isPlaceholderValue(sectionNumber)) {
    redirect("/faculty/manage?error=placeholder")
  }

  const { data: existing } = await supabase
    .from("sections")
    .select("id")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .ilike("term", term)
    .ilike("section_number", sectionNumber)
  if (existing?.length) redirect("/faculty/manage?error=section-duplicate")

  const { error } = await supabase.from("sections").insert({
    course_id: courseId,
    term,
    section_number: sectionNumber,
    label: `${term} · ${sectionNumber}`,
  })
  if (error) redirect("/faculty/manage?error=section")
  redirect("/faculty/manage")
}

export async function updateSection(formData: FormData) {
  const profile = await requireCourseOwner()
  const supabase = await createClient()
  const sectionId = Number(formData.get("section_id"))
  const term = collapseWhitespace(String(formData.get("term") ?? ""))
  const sectionNumber = collapseWhitespace(
    String(formData.get("section_number") ?? ""),
  )
  if (!sectionId) redirect("/faculty/manage?error=section")
  if (!term || !sectionNumber) {
    redirect("/faculty/manage?error=section-missing")
  }
  if (isPlaceholderValue(term) || isPlaceholderValue(sectionNumber)) {
    redirect("/faculty/manage?error=placeholder")
  }

  const { data: section } = await supabase
    .from("sections")
    .select("id, course_id, courses(faculty_id)")
    .eq("id", sectionId)
    .is("deleted_at", null)
    .maybeSingle()
  const course = section?.courses
  const facultyId =
    course && !Array.isArray(course) ? course.faculty_id : null
  if (!section || facultyId !== profile.id) {
    redirect("/faculty/manage?error=owner")
  }

  const { data: existing } = await supabase
    .from("sections")
    .select("id")
    .eq("course_id", section.course_id)
    .is("deleted_at", null)
    .ilike("term", term)
    .ilike("section_number", sectionNumber)
    .neq("id", sectionId)
  if (existing?.length) redirect("/faculty/manage?error=section-duplicate")

  const { error } = await supabase
    .from("sections")
    .update({
      term,
      section_number: sectionNumber,
      label: `${term} · ${sectionNumber}`,
    })
    .eq("id", sectionId)
  if (error) redirect("/faculty/manage?error=section")
  redirect("/faculty/manage")
}

export async function addRoster(formData: FormData) {
  await requireWritableFaculty()
  const supabase = await createClient()
  const sectionId = Number(formData.get("section_id"))
  if (!sectionId) redirect("/faculty")

  const file = formData.get("roster_file")
  let people = [] as Awaited<ReturnType<typeof parseRosterFile>>

  if (file instanceof File && file.size > 0) {
    people = await parseRosterFile(file)
  } else {
    const raw = String(formData.get("roster") ?? "")
    people = parseBlackboardRoster(raw)
  }

  const uniqueByHash = new Map<string, (typeof people)[number]>()
  for (const person of people) {
    const emailHash = hashEmail(person.email)
    if (uniqueByHash.has(emailHash)) continue
    uniqueByHash.set(emailHash, person)
  }

  const hashes = [...uniqueByHash.keys()]
  const existingHashes = new Set<string>()
  if (hashes.length) {
    const { data: existing } = await supabase
      .from("enrollments")
      .select("email_hash")
      .eq("section_id", sectionId)
      .in("email_hash", hashes)
    for (const row of existing ?? []) {
      existingHashes.add(row.email_hash)
    }
  }

  const rows = [...uniqueByHash.entries()]
    .filter(([emailHash]) => !existingHashes.has(emailHash))
    .map(([emailHash, person]) => ({
      section_id: sectionId,
      email_hash: emailHash,
      email_cipher: encryptPii(person.email),
      name_cipher: encryptOptionalPii(person.name),
      last_name_cipher: encryptOptionalPii(person.lastName),
      first_name_cipher: encryptOptionalPii(person.firstName),
      username_cipher: encryptPii(
        usernameFromEmail(person.email) || person.username,
      ),
      student_id_cipher: encryptOptionalPii(person.studentId),
    }))

  if (rows.length) {
    await supabase.from("enrollments").insert(rows)
  }
  redirect(`/faculty/sections/${sectionId}`)
}

export async function removeEnrollment(formData: FormData) {
  await requireWritableFaculty()
  const supabase = await createClient()
  const sectionId = Number(formData.get("section_id"))
  const enrollmentId = Number(formData.get("enrollment_id"))
  await supabase.from("enrollments").delete().eq("id", enrollmentId)
  redirect(`/faculty/sections/${sectionId}`)
}

export async function startSession(formData: FormData) {
  await requireWritableFaculty()
  const supabase = await createClient()
  const sectionId = Number(formData.get("section_id"))
  const { data, error } = await supabase.rpc("start_session", {
    p_section_id: sectionId,
  })
  if (error || !data) redirect(`/faculty/sections/${sectionId}?error=session`)
  redirect(`/faculty/sessions/${data}/display`)
}

export async function startCheckInSessions(formData: FormData) {
  await requireWritableFaculty()
  const supabase = await createClient()
  const sectionIds = [
    ...new Set(
      formData
        .getAll("section_id")
        .map((value) => Number(value))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ]
  if (!sectionIds.length) redirect("/faculty?error=session")

  const { data: sections } = await supabase
    .from("sections")
    .select("id, deleted_at, courses(deleted_at)")
    .in("id", sectionIds)
    .is("deleted_at", null)

  const allowedIds = (sections ?? [])
    .filter((section) => {
      const course = section.courses
      const deleted =
        course && !Array.isArray(course) ? course.deleted_at : null
      return !section.deleted_at && !deleted
    })
    .map((section) => section.id)

  if (!allowedIds.length) redirect("/faculty?error=session")

  const { data: live } = await supabase
    .from("attendance_sessions")
    .select("id, section_id")
    .in("section_id", allowedIds)
    .is("ended_at", null)

  const liveBySection = new Map(
    (live ?? []).map((session) => [session.section_id, session.id]),
  )
  const createdIds: string[] = []
  const reusedIds: string[] = []

  for (const sectionId of allowedIds) {
    const existing = liveBySection.get(sectionId)
    if (existing) {
      reusedIds.push(existing)
      continue
    }
    const { data, error } = await supabase.rpc("start_session", {
      p_section_id: sectionId,
    })
    if (!error && data) createdIds.push(data)
  }

  const allIds = [...createdIds, ...reusedIds]
  if (allIds.length === 1) {
    redirect(`/faculty/sessions/${allIds[0]}/display`)
  }
  const params = new URLSearchParams()
  if (createdIds.length) params.set("started", createdIds.join(","))
  if (reusedIds.length) params.set("reused", reusedIds.join(","))
  if (allIds.length) {
    redirect(`/faculty?${params.toString()}`)
  }
  redirect("/faculty?error=session")
}

export async function endSession(formData: FormData) {
  await requireWritableFaculty()
  const supabase = await createClient()
  const sessionId = String(formData.get("session_id") ?? "")
  const sectionId = String(formData.get("section_id") ?? "")
  const { error } = await supabase.rpc("end_session", { p_session_id: sessionId })
  if (error) redirect(`/faculty/sessions/${sessionId}/display?error=end`)
  redirect(sectionId ? `/faculty/sections/${sectionId}` : "/faculty")
}

export async function inviteGuests(formData: FormData) {
  await requireCourseOwner()
  const supabase = await createClient()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const sectionIds = formData
    .getAll("section_id")
    .map((value) => Number(value))
    .filter((id) => Number.isFinite(id) && id > 0)
  if (!email.includes("@") || !sectionIds.length) {
    redirect("/faculty/manage?error=invite")
  }
  const { error } = await supabase.rpc("invite_section_guests", {
    p_email: email,
    p_section_ids: sectionIds,
  })
  if (error) redirect("/faculty/manage?error=invite")
  redirect("/faculty/manage")
}

export async function archiveSection(formData: FormData) {
  const profile = await requireCourseOwner()
  const supabase = await createClient()
  const sectionId = Number(formData.get("section_id"))
  if (!sectionId) redirect("/faculty/manage?error=section")

  const { data: section } = await supabase
    .from("sections")
    .select("id, course_id, courses(faculty_id)")
    .eq("id", sectionId)
    .maybeSingle()
  const course = section?.courses
  if (!section || !course || course.faculty_id !== profile.id) {
    redirect("/faculty/manage?error=owner")
  }

  const now = new Date().toISOString()
  await supabase.from("sections").update({ deleted_at: now }).eq("id", sectionId)
  redirect("/faculty/manage")
}

export async function archiveCourse(formData: FormData) {
  const profile = await requireCourseOwner()
  const supabase = await createClient()
  const courseId = Number(formData.get("course_id"))
  if (!courseId) redirect("/faculty/manage?error=course")

  const { data: course } = await supabase
    .from("courses")
    .select("id, faculty_id")
    .eq("id", courseId)
    .maybeSingle()
  if (!course || course.faculty_id !== profile.id) {
    redirect("/faculty/manage?error=owner")
  }

  const now = new Date().toISOString()
  await supabase.from("sections").update({ deleted_at: now }).eq("course_id", courseId).is("deleted_at", null)
  await supabase.from("courses").update({ deleted_at: now }).eq("id", courseId)
  redirect("/faculty/manage")
}

export async function resolveRosterAddRequest(formData: FormData) {
  await requireWritableFaculty()
  const supabase = await createClient()
  const sectionId = Number(formData.get("section_id"))
  const requestId = Number(formData.get("request_id"))
  const accept = String(formData.get("accept") ?? "") === "1"
  if (!sectionId || !requestId) redirect("/faculty")
  const { error } = await supabase.rpc("resolve_roster_add_request", {
    p_request_id: requestId,
    p_accept: accept,
  })
  if (error) redirect(`/faculty/sections/${sectionId}?error=request`)
  redirect(`/faculty/sections/${sectionId}`)
}
