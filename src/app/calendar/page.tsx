import { NotionCalendar } from "@/components/NotionCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function CalendarPage() {
  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-6 pb-24">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">Calendars & Schedule</h2>
          <p className="text-sm text-gray-400">Manage team events in Notion-style tables or toggle to live Google Calendar sync.</p>
        </div>

        <NotionCalendar />
      </div>
    </MobileContainer>
  );
}
