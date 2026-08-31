"use client";

export function MobileContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex justify-center items-start sm:py-8">
      {/* Mobile Frame Container: Full width on mobile, sleek phone frame on desktop */}
      <div className="w-full max-w-md min-h-screen sm:min-h-[844px] sm:max-h-[90vh] bg-[#0b0b0c] sm:rounded-[40px] sm:border-[8px] sm:border-[#27272a] shadow-2xl flex flex-col overflow-y-auto relative">
        {/* Fake iOS Notch/Dynamic Island for preview aesthetic */}
        <div className="hidden sm:flex justify-center pt-2 pb-1 sticky top-0 bg-[#0b0b0c]/80 backdrop-blur-md z-20">
          <div className="w-24 h-4 bg-black rounded-full"></div>
        </div>
        
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
