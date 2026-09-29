import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">SIKA CREATIVE</h1>
        <p className="text-xs text-zinc-400 mt-1">Internal Team Workspace</p>
      </div>

      <SignIn
        appearance={{
          baseTheme: dark,
          elements: {
            rootBox: "mx-auto shadow-2xl rounded-2xl overflow-hidden",
            card: "bg-[#141414] border border-zinc-800 shadow-none",
          },
        }}
      />
    </div>
  );
}