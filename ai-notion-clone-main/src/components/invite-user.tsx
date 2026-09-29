"use client";

import { useState, useTransition } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { inviteUserToDocumentAction } from "@/actions/actions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function InviteUser({ documentId }: { documentId: string }) {
    const [open, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [email, setEmail] = useState("");
    const tanstackClient = useQueryClient();

    const handleInvite = async () => {
        startTransition(async () => {
            const { success } = await inviteUserToDocumentAction({
                documentId: documentId,
                userEmail: email,
            });
            if (success) {
                setIsOpen(false);
                setEmail("");
                toast.success("User Added to Room successfully!");
                tanstackClient.invalidateQueries({
                    queryKey: ["users_in_doc"],
                });
            } else {
                toast.error("Failed to add user to room!");
            }
        });
    };
    return (
        <Dialog open={open} onOpenChange={setIsOpen}>
            <Button asChild variant={"outline"}>
                <DialogTrigger>Invite</DialogTrigger>
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite a User to collaborate!</DialogTitle>
                    <DialogDescription>
                        Enter the email of the user you want to invite.
                    </DialogDescription>
                </DialogHeader>
                <Input
                    type="email"
                    placeholder="Email"
                    className="w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <DialogFooter>
                    <Button
                        type="button"
                        variant={"default"}
                        disabled={isPending || !email}
                        onClick={handleInvite}
                    >
                        {isPending ? "Inviting..." : "Invite"}
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
