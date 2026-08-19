export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          checked_in_at: string
          email_cipher: string
          email_hash: string
          flagged_late_device: boolean
          id: number
          is_incognito: boolean
          is_new_device: boolean
          session_id: string
        }
        Insert: {
          checked_in_at?: string
          email_cipher: string
          email_hash: string
          flagged_late_device?: boolean
          id?: never
          is_incognito?: boolean
          is_new_device?: boolean
          session_id: string
        }
        Update: {
          checked_in_at?: string
          email_cipher?: string
          email_hash?: string
          flagged_late_device?: boolean
          id?: never
          is_incognito?: boolean
          is_new_device?: boolean
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          ended_at: string | null
          id: string
          section_id: number
          started_at: string
          started_by: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          section_id: number
          started_at?: string
          started_by: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          section_id?: number
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          faculty_id: string
          id: number
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          faculty_id: string
          id?: never
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          faculty_id?: string
          id?: never
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          email_cipher: string
          email_hash: string
          first_name_cipher: string | null
          id: number
          last_name_cipher: string | null
          name_cipher: string | null
          section_id: number
          student_id_cipher: string | null
          username_cipher: string | null
        }
        Insert: {
          created_at?: string
          email_cipher: string
          email_hash: string
          first_name_cipher?: string | null
          id?: never
          last_name_cipher?: string | null
          name_cipher?: string | null
          section_id: number
          student_id_cipher?: string | null
          username_cipher?: string | null
        }
        Update: {
          created_at?: string
          email_cipher?: string
          email_hash?: string
          first_name_cipher?: string | null
          id?: never
          last_name_cipher?: string | null
          name_cipher?: string | null
          section_id?: number
          student_id_cipher?: string | null
          username_cipher?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      section_members: {
        Row: {
          created_at: string
          email: string
          id: number
          role: string
          section_id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
          role?: string
          section_id: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
          role?: string
          section_id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "section_members_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_add_requests: {
        Row: {
          created_at: string
          email_cipher: string
          email_hash: string
          first_name_cipher: string | null
          id: number
          last_name_cipher: string | null
          name_cipher: string | null
          resolved_at: string | null
          section_id: number
          session_id: string
          status: string
          student_id_cipher: string | null
          username_cipher: string | null
        }
        Insert: {
          created_at?: string
          email_cipher: string
          email_hash: string
          first_name_cipher?: string | null
          id?: never
          last_name_cipher?: string | null
          name_cipher?: string | null
          resolved_at?: string | null
          section_id: number
          session_id: string
          status?: string
          student_id_cipher?: string | null
          username_cipher?: string | null
        }
        Update: {
          created_at?: string
          email_cipher?: string
          email_hash?: string
          first_name_cipher?: string | null
          id?: never
          last_name_cipher?: string | null
          name_cipher?: string | null
          resolved_at?: string | null
          section_id?: number
          session_id?: string
          status?: string
          student_id_cipher?: string | null
          username_cipher?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_add_requests_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_add_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          course_id: number
          created_at: string
          deleted_at: string | null
          id: number
          label: string
          section_number: string
          term: string
        }
        Insert: {
          course_id: number
          created_at?: string
          deleted_at?: string | null
          id?: never
          label?: string
          section_number: string
          term: string
        }
        Update: {
          course_id?: number
          created_at?: string
          deleted_at?: string | null
          id?: never
          label?: string
          section_number?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_own_login_failures: { Args: never; Returns: undefined }
      login_is_locked: { Args: { p_email: string }; Returns: boolean }
      record_failed_login: { Args: { p_email: string }; Returns: boolean }
      check_in: {
        Args: {
          p_device_id: string
          p_email_cipher: string
          p_email_hash: string
          p_is_incognito?: boolean
          p_is_test?: boolean
          p_session_id: string
          p_token: string
        }
        Returns: Json
      }
      end_session: { Args: { p_session_id: string }; Returns: undefined }
      invite_faculty: { Args: { p_email: string }; Returns: undefined }
      invite_section_guests: {
        Args: { p_email: string; p_section_ids: number[] }
        Returns: undefined
      }
      is_faculty: { Args: never; Returns: boolean }
      live_session_info: { Args: { p_session_id: string }; Returns: Json }
      has_course_access: { Args: { p_course_id: number }; Returns: boolean }
      has_section_access: { Args: { p_section_id: number }; Returns: boolean }
      owns_course: { Args: { p_course_id: number }; Returns: boolean }
      owns_section: { Args: { p_section_id: number }; Returns: boolean }
      request_roster_addition: {
        Args: {
          p_email_cipher: string
          p_email_hash: string
          p_first_name_cipher: string
          p_last_name_cipher: string
          p_name_cipher: string
          p_session_id: string
          p_student_id_cipher: string
          p_username_cipher: string
        }
        Returns: undefined
      }
      resolve_roster_add_request: {
        Args: { p_accept: boolean; p_request_id: number }
        Returns: undefined
      }
      session_display_code: { Args: { p_session_id: string }; Returns: Json }
      start_session: { Args: { p_section_id: number }; Returns: string }
      student_live_classes: {
        Args: { p_email_hash: string; p_is_test?: boolean }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Course = Database["public"]["Tables"]["courses"]["Row"]
export type Section = Database["public"]["Tables"]["sections"]["Row"]
export type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"]
export type AttendanceSession =
  Database["public"]["Tables"]["attendance_sessions"]["Row"]
export type AttendanceRecord =
  Database["public"]["Tables"]["attendance_records"]["Row"]
