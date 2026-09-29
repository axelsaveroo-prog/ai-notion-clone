"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createNewDocumentAction } from "@/actions/actions";

import { Button } from "./ui/button";

export default function NewDocumentButton() {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const tanstackClient = useQueryClient();

    const handleCreateNewDocument = () => {
        startTransition(async () => {
            // create a new document
            const docId = await createNewDocumentAction();
            if (docId.docId !== undefined) {
                const params = new URLSearchParams();
                params.set("title", "New Doc");
                router.push(
                    `${window.location.origin}/doc/${docId.docId}?${params.toString()}`
                );
                tanstackClient.invalidateQueries({
                    queryKey: ["documents_from_user"],
                });
            } else {
                toast.info(
                    "You need to be logged in to be able to create a document"
                );
            }
        });
    };

    return (
        <Button disabled={isPending} onClick={handleCreateNewDocument}>
            {isPending ? "creating..." : "New Document"}
        </Button>
    );
}
