import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { fetchUsersFromDocument } from "@/actions/actions";
import { UsersToDocument } from "@/db/schema/users-to-documents";

type UserInDocType = {
    userId: string;
    role: UsersToDocument["role"];
    userEmail: string | null;
};

export default function useUsersInDocument(documentId: string) {
    const { isSignedIn } = useUser();
    const { data, isFetching } = useQuery({
        queryKey: ["users_in_doc"],
        queryFn: async () => {
            const data = await fetchUsersFromDocument(documentId);
            if (data.error !== undefined || !isSignedIn) {
                throw new Error(data.error);
            }
            return data.docs satisfies UserInDocType[];
        },
    });

    return { usersInDoc: data, isFetching };
}
