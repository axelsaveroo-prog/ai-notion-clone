import { AICommandBar } from "@/components/AICommandBar";
import { ArrowLeftCircle } from "lucide-react";

export default function Home() {
    return (
        <main className="flex flex-col">
            <div className="flex animate-pulse items-center space-x-2">
                <ArrowLeftCircle className="h-12 w-12" />
                <h1 className="font-bold">
                    Get started with creating a New Document
                </h1>
            </div>
            <p className="ml-2 mt-4 text-sm font-semibold text-gray-400">
                To be able to receive invites you need to first create a room!
            </p>
            <AICommandBar/>
        </main>
    );
}
