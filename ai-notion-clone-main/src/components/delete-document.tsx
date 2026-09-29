"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deleteDocumentAction } from "@/actions/actions";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Button } from "./ui/button";

export default function DeleteDocument() {
    const [open, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();
    const router = useRouter();
    const tanstackClient = useQueryClient();

    const handleDelete = async () => {
        const roomId = pathname.split("/").pop();
        if (!roomId) return;

        startTransition(async () => {
            const { success } = await deleteDocumentAction(roomId);
            if (success) {
                setIsOpen(false);
                router.replace("/");
                toast.success("Room deleted successfully!");
                tanstackClient.invalidateQueries({
                    queryKey: ["documents_from_user"],
                });
            } else {
                toast.error("Failed to delete the room!");
            }
        });
    };
    return (
        <AlertDialog open={open} onOpenChange={setIsOpen}>
            <Button asChild variant={"destructive"}>
                <AlertDialogTrigger>Delete</AlertDialogTrigger>
            </Button>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Are you sure you want to Delete?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This will delete the document and all it&apos;s content,
                        removing all users from the document.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <Button
                        type="button"
                        variant={"destructive"}
                        disabled={isPending}
                        onClick={handleDelete}
                    >
                        {isPending ? "Deleting..." : "Delete"}
                    </Button>
                    <Button
                        onClick={() => setIsOpen(false)}
                        variant={"secondary"}
                    >
                        Close
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
