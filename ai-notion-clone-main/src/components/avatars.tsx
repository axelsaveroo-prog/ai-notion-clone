"use client";

import { useOthers, useSelf } from "@liveblocks/react/suspense";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export default function Avatars() {
    const others = useOthers();
    const self = useSelf();

    const all = [self, ...others];
    return (
        <div className="flex items-center gap-2">
            <p>Users currently editing this page</p>
            <div className="flex -space-x-5">
                {all.map((other) => (
                    <TooltipProvider key={other.id}>
                        <Tooltip>
                            <TooltipTrigger>
                                <Avatar className="border-2 hover:z-50">
                                    <AvatarImage src={other.info.avatar} />
                                    <AvatarFallback className="capitalize">
                                        {other.info.name.slice(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>
                                    {self.id == other.id
                                        ? "You"
                                        : other.info.name}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>
        </div>
    );
}
