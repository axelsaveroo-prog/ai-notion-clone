"use client";

import { use } from "react";

import Document from "@/components/document";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

interface PageType {
    params: Promise<{
        id: string;
    }>;
    searchParams: SearchParams;
}

function handleTitle(title: string | string[] | undefined): string {
    if (title === undefined) return "undefined";
    if (typeof title === "string") return title;
    return title.length > 0 ? title[0] : "";
}

export default function DocumentPage(props: PageType) {
    const searchParams = use(props.searchParams);
    const { title } = searchParams;
    const { id } = use(props.params);

    return (
        <div className="flex min-h-screen flex-1 flex-col">
            <Document title={handleTitle(title)} id={id} />
        </div>
    );
}
