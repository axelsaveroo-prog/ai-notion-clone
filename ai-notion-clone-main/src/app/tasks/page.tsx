import { TasksManager } from "@/components/TasksManager";
import { MobileContainer } from "@/components/MobileContainer";
import Link from "next/link";

export default function TasksPage() {
  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-6 pb-24">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Task Operations</h2>
        </div>

        <TasksManager />
      </div>
    </MobileContainer>
  );
}
