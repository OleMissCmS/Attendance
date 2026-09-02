import { EXPERIENCE_ROSTER_UNSUPPORTED_MESSAGE } from "@/lib/blackboard-roster"
import { cn } from "@/lib/utils"

export function RosterExperienceNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {EXPERIENCE_ROSTER_UNSUPPORTED_MESSAGE}
    </p>
  )
}
