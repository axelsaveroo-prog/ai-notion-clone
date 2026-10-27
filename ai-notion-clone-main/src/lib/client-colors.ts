export interface ClientPalette {
  key: string;
  label: string;
  bg: string;
  border: string;
  text: string;
  badge: string;
  dot: string;
}

// 30 Pilihan Palet Warna Elegan, Soft & Non-Neon (Linear/Notion Luxury Style)
export const SOFT_CLIENT_PALETTES: Record<string, ClientPalette> = {
  sky: {
    key: "sky",
    label: "Sky Blue",
    bg: "bg-[#1c2227]",
    border: "border-[#2b3945]",
    text: "text-[#7dd3fc]/90",
    badge: "bg-[#1c2227] text-[#7dd3fc]/90 border-[#2b3945] hover:bg-[#232c34]",
    dot: "#38bdf8",
  },
  cyan: {
    key: "cyan",
    label: "Pastel Cyan",
    bg: "bg-[#192327]",
    border: "border-[#253942]",
    text: "text-[#67e8f9]/90",
    badge: "bg-[#192327] text-[#67e8f9]/90 border-[#253942] hover:bg-[#1f2e34]",
    dot: "#22d3ee",
  },
  teal: {
    key: "teal",
    label: "Mineral Teal",
    bg: "bg-[#1a2323]",
    border: "border-[#293a3a]",
    text: "text-[#5eead4]/90",
    badge: "bg-[#1a2323] text-[#5eead4]/90 border-[#293a3a] hover:bg-[#222d2d]",
    dot: "#2dd4bf",
  },
  mint: {
    key: "mint",
    label: "Soft Mint",
    bg: "bg-[#192420]",
    border: "border-[#263c33]",
    text: "text-[#a7f3d0]/90",
    badge: "bg-[#192420] text-[#a7f3d0]/90 border-[#263c33] hover:bg-[#1f3029]",
    dot: "#6ee7b7",
  },
  emerald: {
    key: "emerald",
    label: "Muted Emerald",
    bg: "bg-[#18231c]",
    border: "border-[#263c2c]",
    text: "text-[#6ee7b7]/90",
    badge: "bg-[#18231c] text-[#6ee7b7]/90 border-[#263c2c] hover:bg-[#1f2f25]",
    dot: "#34d399",
  },
  sage: {
    key: "sage",
    label: "Sage Green",
    bg: "bg-[#1b221d]",
    border: "border-[#2e3d32]",
    text: "text-[#86efac]/90",
    badge: "bg-[#1b221d] text-[#86efac]/90 border-[#2e3d32] hover:bg-[#222c24]",
    dot: "#4ade80",
  },
  basil: {
    key: "basil",
    label: "Forest Moss",
    bg: "bg-[#1e2319]",
    border: "border-[#313c26]",
    text: "text-[#bbf7d0]/90",
    badge: "bg-[#1e2319] text-[#bbf7d0]/90 border-[#313c26] hover:bg-[#272e20]",
    dot: "#86efac",
  },
  olive: {
    key: "olive",
    label: "Warm Olive",
    bg: "bg-[#212319]",
    border: "border-[#373c26]",
    text: "text-[#bef264]/90",
    badge: "bg-[#212319] text-[#bef264]/90 border-[#373c26] hover:bg-[#2b2e20]",
    dot: "#a3e635",
  },
  lime: {
    key: "lime",
    label: "Pale Lime",
    bg: "bg-[#222419]",
    border: "border-[#3a3e26]",
    text: "text-[#d9f99d]/90",
    badge: "bg-[#222419] text-[#d9f99d]/90 border-[#3a3e26] hover:bg-[#2c2f20]",
    dot: "#bef264",
  },
  sand: {
    key: "sand",
    label: "Warm Sand",
    bg: "bg-[#25221b]",
    border: "border-[#3d3725]",
    text: "text-[#fde047]/85",
    badge: "bg-[#25221b] text-[#fde047]/85 border-[#3d3725] hover:bg-[#2e2920]",
    dot: "#eab308",
  },
  amber: {
    key: "amber",
    label: "Amber Gold",
    bg: "bg-[#252019]",
    border: "border-[#3f3424]",
    text: "text-[#fde68a]/90",
    badge: "bg-[#252019] text-[#fde68a]/90 border-[#3f3424] hover:bg-[#2e271e]",
    dot: "#fbbf24",
  },
  apricot: {
    key: "apricot",
    label: "Warm Apricot",
    bg: "bg-[#261f18]",
    border: "border-[#423324]",
    text: "text-[#fed7aa]/90",
    badge: "bg-[#261f18] text-[#fed7aa]/90 border-[#423324] hover:bg-[#30261d]",
    dot: "#f59e0b",
  },
  peach: {
    key: "peach",
    label: "Soft Peach",
    bg: "bg-[#24201c]",
    border: "border-[#3d3326]",
    text: "text-[#fdba74]/90",
    badge: "bg-[#24201c] text-[#fdba74]/90 border-[#3d3326] hover:bg-[#2e2820]",
    dot: "#fb923c",
  },
  orange: {
    key: "orange",
    label: "Burnt Tangerine",
    bg: "bg-[#261d19]",
    border: "border-[#432e27]",
    text: "text-[#ffedd5]/90",
    badge: "bg-[#261d19] text-[#ffedd5]/90 border-[#432e27] hover:bg-[#30241f]",
    dot: "#ea580c",
  },
  coral: {
    key: "coral",
    label: "Muted Coral",
    bg: "bg-[#261e1e]",
    border: "border-[#422e2e]",
    text: "text-[#fca5a5]/90",
    badge: "bg-[#261e1e] text-[#fca5a5]/90 border-[#422e2e] hover:bg-[#302525]",
    dot: "#f87171",
  },
  terracotta: {
    key: "terracotta",
    label: "Terracotta",
    bg: "bg-[#251e1e]",
    border: "border-[#3f2e30]",
    text: "text-[#fca5a5]/90",
    badge: "bg-[#251e1e] text-[#fca5a5]/90 border-[#3f2e30] hover:bg-[#2e2526]",
    dot: "#ef4444",
  },
  crimson: {
    key: "crimson",
    label: "Dusty Crimson",
    bg: "bg-[#251c20]",
    border: "border-[#422a32]",
    text: "text-[#fda4af]/90",
    badge: "bg-[#251c20] text-[#fda4af]/90 border-[#422a32] hover:bg-[#2f2228]",
    dot: "#e11d48",
  },
  rose: {
    key: "rose",
    label: "Blush Rose",
    bg: "bg-[#241c20]",
    border: "border-[#402934]",
    text: "text-[#f472b6]/90",
    badge: "bg-[#241c20] text-[#f472b6]/90 border-[#402934] hover:bg-[#2e2329]",
    dot: "#f472b6",
  },
  pink: {
    key: "pink",
    label: "Flamingo Pink",
    bg: "bg-[#261c22]",
    border: "border-[#432a39]",
    text: "text-[#fbcfe8]/90",
    badge: "bg-[#261c22] text-[#fbcfe8]/90 border-[#432a39] hover:bg-[#30232b]",
    dot: "#fb7185",
  },
  magenta: {
    key: "magenta",
    label: "Soft Magenta",
    bg: "bg-[#251c24]",
    border: "border-[#41283c]",
    text: "text-[#f5d0fe]/90",
    badge: "bg-[#251c24] text-[#f5d0fe]/90 border-[#41283c] hover:bg-[#2f222d]",
    dot: "#f43f5e",
  },
  fuchsia: {
    key: "fuchsia",
    label: "Pale Fuchsia",
    bg: "bg-[#241c25]",
    border: "border-[#402842]",
    text: "text-[#f0abfc]/90",
    badge: "bg-[#241c25] text-[#f0abfc]/90 border-[#402842] hover:bg-[#2e2230]",
    dot: "#e879f9",
  },
  orchid: {
    key: "orchid",
    label: "Dusty Orchid",
    bg: "bg-[#231d27]",
    border: "border-[#3d2945]",
    text: "text-[#e879f9]/90",
    badge: "bg-[#231d27] text-[#e879f9]/90 border-[#3d2945] hover:bg-[#2c2332]",
    dot: "#d946ef",
  },
  mauve: {
    key: "mauve",
    label: "Dusty Mauve",
    bg: "bg-[#231e26]",
    border: "border-[#382d3e]",
    text: "text-[#d8b4fe]/90",
    badge: "bg-[#231e26] text-[#d8b4fe]/90 border-[#382d3e] hover:bg-[#2a2430]",
    dot: "#c084fc",
  },
  purple: {
    key: "purple",
    label: "Royal Iris",
    bg: "bg-[#211e28]",
    border: "border-[#352c46]",
    text: "text-[#c084fc]/90",
    badge: "bg-[#211e28] text-[#c084fc]/90 border-[#352c46] hover:bg-[#292434]",
    dot: "#a855f7",
  },
  violet: {
    key: "violet",
    label: "Deep Violet",
    bg: "bg-[#1f1e29]",
    border: "border-[#322c4a]",
    text: "text-[#a78bfa]/90",
    badge: "bg-[#1f1e29] text-[#a78bfa]/90 border-[#322c4a] hover:bg-[#272435]",
    dot: "#8b5cf6",
  },
  indigo: {
    key: "indigo",
    label: "Steel Indigo",
    bg: "bg-[#1d2029]",
    border: "border-[#2c3349]",
    text: "text-[#a5b4fc]/90",
    badge: "bg-[#1d2029] text-[#a5b4fc]/90 border-[#2c3349] hover:bg-[#242935]",
    dot: "#6366f1",
  },
  cobalt: {
    key: "cobalt",
    label: "Ocean Blue",
    bg: "bg-[#1b2029]",
    border: "border-[#283348]",
    text: "text-[#93c5fd]/90",
    badge: "bg-[#1b2029] text-[#93c5fd]/90 border-[#283348] hover:bg-[#222935]",
    dot: "#3b82f6",
  },
  slate: {
    key: "slate",
    label: "Slate Navy",
    bg: "bg-[#1c1f24]",
    border: "border-[#2c333e]",
    text: "text-[#94a3b8]/90",
    badge: "bg-[#1c1f24] text-[#94a3b8]/90 border-[#2c333e] hover:bg-[#23272e]",
    dot: "#94a3b8",
  },
  zinc: {
    key: "zinc",
    label: "Cool Zinc",
    bg: "bg-[#1c1c1f]",
    border: "border-[#2e2e32]",
    text: "text-[#d4d4d8]",
    badge: "bg-[#1c1c1f] text-[#d4d4d8] border-[#2e2e32] hover:bg-[#242428]",
    dot: "#a1a1aa",
  },
  stone: {
    key: "stone",
    label: "Warm Stone",
    bg: "bg-[#1f1e1d]",
    border: "border-[#33312f]",
    text: "text-[#d6d3d1]",
    badge: "bg-[#1f1e1d] text-[#d6d3d1] border-[#33312f] hover:bg-[#282725]",
    dot: "#a8a29e",
  },
};

export const COLOR_OPTIONS_LIST = Object.values(SOFT_CLIENT_PALETTES);

export function getClientColor(colorKey?: string | null): ClientPalette {
  if (colorKey && SOFT_CLIENT_PALETTES[colorKey]) {
    return SOFT_CLIENT_PALETTES[colorKey];
  }
  return SOFT_CLIENT_PALETTES.slate;
}

// Fallback deterministik jika client belum memiliki warna khusus tersimpan
export function getClientThemeByName(
  clientName: string, 
  clientList?: { name: string; color: string }[]
): ClientPalette {
  if (!clientName) return SOFT_CLIENT_PALETTES.slate;

  // 1. Cek dari daftar client database jika tersedia
  if (clientList && clientList.length > 0) {
    const match = clientList.find(
      (c) => c.name.toLowerCase() === clientName.toLowerCase()
    );
    if (match && SOFT_CLIENT_PALETTES[match.color]) {
      return SOFT_CLIENT_PALETTES[match.color];
    }
  }

  // 2. Default presets berdasarkan nama umum
  const lower = clientName.toLowerCase();
  if (lower.includes("akasa")) return SOFT_CLIENT_PALETTES.sky;
  if (lower.includes("aperio")) return SOFT_CLIENT_PALETTES.indigo;
  if (lower.includes("bali")) return SOFT_CLIENT_PALETTES.teal;
  if (lower.includes("wearluca")) return SOFT_CLIENT_PALETTES.sage;
  if (lower.includes("baba")) return SOFT_CLIENT_PALETTES.peach;

  // 3. Hash deterministik agar warna tetap konsisten dan berbeda antar client
  let hash = 0;
  for (let i = 0; i < clientName.length; i++) {
    hash = clientName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const keys = Object.keys(SOFT_CLIENT_PALETTES);
  const pickedKey = keys[Math.abs(hash) % keys.length];
  return SOFT_CLIENT_PALETTES[pickedKey] || SOFT_CLIENT_PALETTES.slate;
}
