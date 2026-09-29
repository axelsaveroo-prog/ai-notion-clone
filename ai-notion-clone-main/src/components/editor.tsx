"use client";

import { useEffect, useState } from "react";

import { BlockNoteEditor } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { useRoom, useSelf } from "@liveblocks/react/suspense";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { MoonIcon, SunIcon } from "lucide-react";
import * as Y from "yjs";

import { Button } from "@/components/ui/button";
import { stringToColor } from "@/lib/string-to-color";

import ChatToDocument from "./chat-to-document";
import TranslateDocument from "./translate-document";

export type YJSDoc = Y.Doc;

type EditorProps = {
    doc: Y.Doc;
    provider: LiveblocksYjsProvider;
    darkMode: boolean;
};

function BlockNote({ darkMode, doc, provider }: EditorProps) {
    const userInfo = useSelf((me) => me.info);

    const editor: BlockNoteEditor = useCreateBlockNote({
        collaboration: {
            provider,
            fragment: doc.getXmlFragment("document-store"),
            user: {
                name: userInfo.name,
                color: stringToColor(userInfo.email),
            },
        },
    });

    return (
        <div className="relative mx-auto max-w-6xl">
            <BlockNoteView
                className="min-h-screen"
                editor={editor}
                theme={darkMode ? "dark" : "light"}
            />
        </div>
    );
}

export default function Editor() {
    const room = useRoom();
    const [doc, setDoc] = useState<Y.Doc>();
    const [provider, setProvider] = useState<LiveblocksYjsProvider>();
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const yDoc = new Y.Doc();
        const yProvider = new LiveblocksYjsProvider(room, yDoc);
        setDoc(yDoc);
        setProvider(yProvider);

        return () => {
            yDoc.destroy();
            yProvider.destroy();
        };
    }, [room]);

    if (!doc || !provider) {
        return null;
    }
    const style = `hover:text-gray-700 ${
        darkMode
            ? "text-gray-300 bg-gray-700 hover:bg-gray-100 "
            : "text-gray-700 bg-gray-200 hover:bg-gray-300 "
    }`;
    return (
        <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex items-center justify-end gap-2">
                {/* Translate Document AI*/}
                <TranslateDocument doc={doc} />
                {/* Chat To Document AI */}
                <ChatToDocument doc={doc} />

                {/* Dark Mode */}
                <Button
                    className={style}
                    onClick={() => setDarkMode((prev) => !prev)}
                >
                    {darkMode ? <SunIcon /> : <MoonIcon />}
                </Button>
            </div>
            {/* Block Note */}
            <BlockNote doc={doc} provider={provider} darkMode={darkMode} />
        </div>
    );
}
