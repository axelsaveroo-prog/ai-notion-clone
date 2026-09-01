import { TasksManager } from "@/components/TasksManager";
import { MobileContainer } from "@/components/MobileContainer";

export default function TasksPage() {
  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-6 pb-24">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">Task Operations</h2>
          <p className="text-sm text-gray-400">Manage client deliverables, track deadlines, and sync with Google Calendar.</p>
        </div>

        <TasksManager />
      </div>
    </MobileContainer>
  );
}
