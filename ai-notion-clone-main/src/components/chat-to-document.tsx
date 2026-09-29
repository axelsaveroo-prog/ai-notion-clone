import { useState, useTransition } from "react";

import { useAuth } from "@clerk/nextjs";
import { BotIcon, MessageCircleCode } from "lucide-react";
import Markdown from "react-markdown";
import { toast } from "sonner";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { env } from "@/env/client";
import { stripAllTags } from "@/lib/utils";

import { YJSDoc } from "./editor";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type ChatToDocumentProps = {
    doc: YJSDoc;
};

export default function ChatToDocument({ doc }: ChatToDocumentProps) {
    const [open, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [question, setQuestion] = useState("");
    const [inputQuestion, setInputQuestion] = useState("");
    const [summary, setSummary] = useState("");
    const { getToken } = useAuth();

    const handleAskQuestion = async () => {
        setQuestion(inputQuestion);
        startTransition(async () => {
            const documentData = doc.get("document-store").toJSON();
            const strippedData = stripAllTags(documentData);
            try {
                const res = await fetch(
                    `${env.NEXT_PUBLIC_BASE_URL}/chatToDocument`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${await getToken()}`,
                        },
                        body: JSON.stringify({
                            documentData,
                            question: strippedData,
                        }),
                    }
                );

                if (res.ok) {
                    const { message } = await res.json();
                    setInputQuestion("");
                    setSummary(message);
                } else {
                    toast.error("Error while asking the question!");
                }
            } catch (e) {
                console.error(e);
            }
        });
    };
    return (
        <Dialog open={open} onOpenChange={setIsOpen}>
            <Button asChild variant={"outline"}>
                <DialogTrigger>
                    <MessageCircleCode className="mr-2" />
                    Chat to Document
                </DialogTrigger>
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Chat to the Document!</DialogTitle>
                    <DialogDescription>
                        Ask a question and chat to the document with AI.
                    </DialogDescription>

                    <hr className="mt-5" />
                    {question && <p className="text-gray-500">Q: {question}</p>}
                </DialogHeader>
                {summary && (
                    <div className="flex max-h-96 flex-col items-start gap-2 overflow-y-scroll bg-gray-100 p-5">
                        <div className="flex">
                            <BotIcon className="w-10 flex-shrink-0" />
                            <div className="font-bold">
                                GPT{" "}
                                {isPending ? (
                                    "is Thinking..."
                                ) : (
                                    <Markdown>{summary}</Markdown>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <Input
                    type="text"
                    placeholder="i.e. what is this about?"
                    className="w-full"
                    value={inputQuestion}
                    disabled={isPending}
                    onChange={(e) => setInputQuestion(e.target.value)}
                />
                <DialogFooter>
                    <Button
                        type="button"
                        variant={"default"}
                        disabled={isPending || !inputQuestion}
                        onClick={handleAskQuestion}
                    >
                        {isPending ? "Asking..." : "Ask"}
                    </Button>
                    <Button
                        onClick={() => setIsOpen(false)}
                        variant={"secondary"}
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
