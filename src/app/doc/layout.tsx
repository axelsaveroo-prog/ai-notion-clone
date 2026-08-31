export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white">
      {children}
    </div>
  );
}
