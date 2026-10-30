import { Suspense } from "react";
import { TasksManager } from "@/components/TasksManager";
import { MobileContainer } from "@/components/MobileContainer";

export default function TasksPage() {
  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col py-1 pb-24">
        <Suspense fallback={<div className="p-12 text-center text-xs text-zinc-500">Memuat Task Operations...</div>}>
          <TasksManager />
        </Suspense>
      </div>
    </MobileContainer>
  );
}
