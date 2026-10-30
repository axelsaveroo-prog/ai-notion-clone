import { TasksManager } from "@/components/TasksManager";
import { MobileContainer } from "@/components/MobileContainer";

export default function TasksPage() {
  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col py-1 pb-24">
        <TasksManager />
      </div>
    </MobileContainer>
  );
}
