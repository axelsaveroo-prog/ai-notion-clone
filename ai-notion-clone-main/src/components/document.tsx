"use client";

import { FormEvent, useState, useTransition } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateDocumentTitleAction } from "@/actions/actions";
import { Input } from "@/components/ui/input";
import useOwner from "@/lib/use-owner";

import Avatars from "./avatars";
import DeleteDocument from "./delete-document";
import Editor from "./editor";
import InviteUser from "./invite-user";
import ManageUsers from "./manage-users";
import { Button } from "./ui/button";

type DocumentProps = {
    title: string;
    id: string;
};

export default function Document({ title, id }: DocumentProps) {
    const [input, setInput] = useState(title);
    const [isUpdating, startTransition] = useTransition();
    const isOwner = useOwner();
    const tanstackClient = useQueryClient();

    const updateTitle = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (input.trim()) {
            startTransition(async () => {
                const result = await updateDocumentTitleAction({
                    documentId: id,
                    newTitle: input,
                });

                if (result.success) {
                    toast.success("Title updated");
                    tanstackClient.invalidateQueries({
                        queryKey: ["documents_from_user"],
                    });
                }

                if (result.error) {
                    toast.error(result.error);
                }
            });
        }
    };
    return (
        <div className="h-full flex-1 bg-white p-5">
            <div className="mx-auto flex max-w-6xl justify-between pb-5">
                <form className="flex flex-1 space-x-2" onSubmit={updateTitle}>
                    {/* update title... */}
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        type="text"
                    />

                    <Button disabled={isUpdating} type="submit">
                        {isUpdating ? "Updating..." : "Update"}
                    </Button>

                    {/* If */}
                    {isOwner && (
                        <>
                            {/* Invite User */}
                            <InviteUser documentId={id} />
                            {/* Delete document */}
                            <DeleteDocument />
                        </>
                    )}
                </form>
            </div>

            <div className="max-w6xl mx-auto mb-5 flex items-center justify-between">
                {/* ManageUsers */}
                <ManageUsers />
                <Avatars />
            </div>
            <hr className="pb-10" />
            <Editor />
            {/* Collaborative Editor */}
        </div>
    );
}
