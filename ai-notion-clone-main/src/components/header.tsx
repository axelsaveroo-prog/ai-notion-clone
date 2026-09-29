"use client";

import {
    SignInButton,
    SignedIn,
    SignedOut,
    UserButton,
    useUser,
} from "@clerk/nextjs";

import Breadcrumbs from "./breadcrumbs";

export default function Header() {
    const { user, isSignedIn, isLoaded } = useUser();
    return (
        <header className="flex items-center justify-between p-5 shadow-sm">
            {isLoaded && isSignedIn && (
                <h1 className="text-2xl font-medium">
                    {user.firstName}&apos;s Space
                </h1>
            )}

            {/* breadcrumbs */}
            <Breadcrumbs />
            <div>
                <SignedOut>
                    <SignInButton />
                </SignedOut>
                <SignedIn>
                    <UserButton />
                </SignedIn>
            </div>
        </header>
    );
}
