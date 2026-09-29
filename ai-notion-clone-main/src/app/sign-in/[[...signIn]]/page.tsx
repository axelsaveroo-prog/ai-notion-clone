import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">SIKA Studio</h1>
        <p className="text-xs text-zinc-400 mt-1">Internal Team Workspace</p>
      </div>

      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto w-full max-w-md",
            card: "bg-[#141416] border border-zinc-800 rounded-3xl shadow-2xl p-6",
            headerTitle: "text-white text-lg font-bold",
            headerSubtitle: "text-zinc-400 text-xs",
            socialButtonsBlockButton: "bg-[#1c1c1f] border border-zinc-800 text-white hover:bg-zinc-800 text-xs",
            formButtonPrimary: "bg-white text-black hover:bg-zinc-200 text-xs font-bold py-2.5 rounded-xl transition",
            formFieldLabel: "text-zinc-400 text-xs font-medium",
            formFieldInput: "bg-[#1c1c1f] border border-zinc-800 text-white text-xs rounded-xl focus:border-zinc-600",
            footerActionLink: "text-white hover:underline text-xs",
            dividerLine: "bg-zinc-800",
            dividerText: "text-zinc-500 text-[10px]",
          },
        }}
      />
    </div>
  );
}