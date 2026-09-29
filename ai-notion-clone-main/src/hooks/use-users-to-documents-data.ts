import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { fetchDocumentsFromUser } from "@/actions/actions";
import { SplitUsersToDocument } from "@/db/schema/users-to-documents";

interface GroupedData {
    editor: SplitUsersToDocument<"editor">[];
    owner: SplitUsersToDocument<"owner">[];
}

export default function useDocumentsFromUser() {
    const { isSignedIn } = useUser();

    const { data, error, isLoading } = useQuery({
        queryKey: ["documents_from_user"],
        queryFn: async () => {
            const docsData = await fetchDocumentsFromUser();
            if (docsData.error !== undefined || !isSignedIn) {
                throw new Error("error fetching data");
            }

            const data: GroupedData = {
                editor: [],
                owner: [],
            };
            docsData.docs.forEach((doc) => {
                if (doc.role === "editor") {
                    data.editor.push({
                        documentId: doc.documentId,
                        createdAt: doc.createdAt,
                        role: doc.role,
                        documentTitle: doc.documentTitle ?? "",
                    });
                } else {
                    data.owner.push({
                        documentId: doc.documentId,
                        createdAt: doc.createdAt,
                        role: doc.role,
                        documentTitle: doc.documentTitle ?? "",
                    });
                }
            });
            return data;
        },
    });

    return { groupedData: data, isLoading, error };
}
