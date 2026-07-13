export interface ColorTheme {
  id: string;
  name: string;
  bg: string;
  card: string;
  input: string;
  textMuted: string;
  primaryFg: string;
  primary: string;
  accent: string;
  bgSoft: string;
  text: string;
  border: string;
}

export interface CustomColorTheme {
  bg: string;
  card: string;
  input: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryFg: string;
  accent: string;
  bgSoft: string;
}

export interface CustomColorPreset {
  id: string;
  name: string;
  colors: CustomColorTheme;
}

export const CUSTOM_THEME_ID = "custom";
export const DEFAULT_COLOR_THEME = "ocean-blue";
export const DEFAULT_CUSTOM_PRESET_ID = "custom-default";

export const COLOR_THEMES: ColorTheme[] = [
  { id: "light-mode", name: "Light mode", bg: "#f3f4f6", card: "#ffffff", input: "#ffffff", textMuted: "#4b5563", primaryFg: "#111827", primary: "#ffffff", accent: "#e5e7eb", bgSoft: "#f9fafb", text: "#111827", border: "#d1d5db" },
  { id: "dark-mode", name: "Dark mode", bg: "#030712", card: "#111827", input: "#0f172a", textMuted: "#cbd5e1", primaryFg: "#ffffff", primary: "#111827", accent: "#374151", bgSoft: "#1f2937", text: "#f9fafb", border: "#4b5563" },
  { id: "ocean-blue", name: "Ocean Blue", bg: "#eaf3ff", card: "#f4f7fe", input: "#f4f7fe", textMuted: "#505460", primaryFg: "#ffffff", primary: "#2563eb", accent: "#0ea5e9", bgSoft: "#eaf3ff", text: "#0b1d3a", border: "#c7d8ff" },
  { id: "sky-breeze", name: "Sky Breeze", bg: "#e6f6fb", card: "#f2f8fc", input: "#f2f8fc", textMuted: "#505c62", primaryFg: "#ffffff", primary: "#0284c7", accent: "#22d3ee", bgSoft: "#e6f6fb", text: "#0b2a3a", border: "#bde4ef" },
  { id: "indigo-dusk", name: "Indigo Dusk", bg: "#eef0ff", card: "#f6f5fd", input: "#f6f5fd", textMuted: "#545165", primaryFg: "#ffffff", primary: "#4f46e5", accent: "#a78bfa", bgSoft: "#eef0ff", text: "#1b1546", border: "#c9c7ff" },
  { id: "royal-violet", name: "Royal Violet", bg: "#f3eaff", card: "#f7f4fd", input: "#f7f4fd", textMuted: "#5a5068", primaryFg: "#ffffff", primary: "#6d28d9", accent: "#c084fc", bgSoft: "#f3eaff", text: "#2a0f4c", border: "#dcc6ff" },
  { id: "magenta-pop", name: "Magenta Pop", bg: "#fdeaf3", card: "#fdf4f8", input: "#fdf4f8", textMuted: "#68505b", primaryFg: "#ffffff", primary: "#db2777", accent: "#ec4899", bgSoft: "#fdeaf3", text: "#4a0a2a", border: "#f7c1d8" },
  { id: "rose-blush", name: "Rose Blush", bg: "#fdecee", card: "#fdf3f5", input: "#fdf3f5", textMuted: "#625052", primaryFg: "#ffffff", primary: "#e11d48", accent: "#fb7185", bgSoft: "#fdecee", text: "#3f0918", border: "#f6c2cb" },
  { id: "coral-reef", name: "Coral Reef", bg: "#fff1ee", card: "#fef5f6", input: "#fef5f6", textMuted: "#625050", primaryFg: "#ffffff", primary: "#f43f5e", accent: "#fb923c", bgSoft: "#fff1ee", text: "#3f0e0e", border: "#fbd0c5" },
  { id: "sunset-orange", name: "Sunset Orange", bg: "#fff3e6", card: "#fdf6f2", input: "#fdf6f2", textMuted: "#625550", primaryFg: "#ffffff", primary: "#ea580c", accent: "#fbbf24", bgSoft: "#fff3e6", text: "#3a1a05", border: "#fad4a8" },
  { id: "amber-warm", name: "Amber Warm", bg: "#fff7e0", card: "#fdf8f2", input: "#fdf8f2", textMuted: "#645a50", primaryFg: "#ffffff", primary: "#d97706", accent: "#facc15", bgSoft: "#fff7e0", text: "#3b2400", border: "#fbe193" },
  { id: "gold-leaf", name: "Gold Leaf", bg: "#fdf6d8", card: "#faf7f2", input: "#faf7f2", textMuted: "#5b5550", primaryFg: "#ffffff", primary: "#a16207", accent: "#eab308", bgSoft: "#fdf6d8", text: "#2c1d00", border: "#f1de8e" },
  { id: "lime-zest", name: "Lime Zest", bg: "#f3fae1", card: "#f7faf2", input: "#f7faf2", textMuted: "#585e50", primaryFg: "#ffffff", primary: "#65a30d", accent: "#a3e635", bgSoft: "#f3fae1", text: "#1f2e02", border: "#d3ec9a" },
  { id: "emerald-fresh", name: "Emerald Fresh", bg: "#e6fbf2", card: "#f2f9f7", input: "#f2f9f7", textMuted: "#505d56", primaryFg: "#ffffff", primary: "#059669", accent: "#34d399", bgSoft: "#e6fbf2", text: "#03301e", border: "#b6efd3" },
  { id: "forest-pine", name: "Forest Pine", bg: "#e6f5ec", card: "#f2f8f6", input: "#f2f8f6", textMuted: "#505a55", primaryFg: "#ffffff", primary: "#047857", accent: "#10b981", bgSoft: "#e6f5ec", text: "#022a1d", border: "#b6dccc" },
  { id: "teal-cyan", name: "Teal Cyan", bg: "#e6f8f6", card: "#f2f9f9", input: "#f2f9f9", textMuted: "#505e5c", primaryFg: "#ffffff", primary: "#0d9488", accent: "#2dd4bf", bgSoft: "#e6f8f6", text: "#06302c", border: "#b6e3df" },
  { id: "aqua-mint", name: "Aqua Mint", bg: "#e0f7f5", card: "#f2f9fb", input: "#f2f9fb", textMuted: "#505f65", primaryFg: "#ffffff", primary: "#0891b2", accent: "#5eead4", bgSoft: "#e0f7f5", text: "#053040", border: "#afe6e1" },
  { id: "turquoise", name: "Turquoise", bg: "#dff9fb", card: "#f2fbfc", input: "#f2fbfc", textMuted: "#506168", primaryFg: "#ffffff", primary: "#06b6d4", accent: "#22d3ee", bgSoft: "#dff9fb", text: "#063444", border: "#a8e0e9" },
  { id: "steel-blue", name: "Steel Blue", bg: "#e8eefb", card: "#f3f6fd", input: "#f3f6fd", textMuted: "#50505e", primaryFg: "#ffffff", primary: "#1d4ed8", accent: "#60a5fa", bgSoft: "#e8eefb", text: "#0a1638", border: "#b7c7ef" },
  { id: "slate-storm", name: "Slate Storm", bg: "#eef1f5", card: "#f4f5f6", input: "#f4f5f6", textMuted: "#505157", primaryFg: "#ffffff", primary: "#334155", accent: "#94a3b8", bgSoft: "#eef1f5", text: "#111827", border: "#c6cdd7" },
  { id: "graphite", name: "Graphite", bg: "#f1f3f7", card: "#f5f6f7", input: "#f5f6f7", textMuted: "#505058", primaryFg: "#ffffff", primary: "#475569", accent: "#64748b", bgSoft: "#f1f3f7", text: "#0f172a", border: "#cfd6e0" },
  { id: "charcoal", name: "Charcoal", bg: "#eef0f3", card: "#f3f4f5", input: "#f3f4f5", textMuted: "#505052", primaryFg: "#ffffff", primary: "#1f2937", accent: "#374151", bgSoft: "#eef0f3", text: "#0b1220", border: "#cbd2dc" },
  { id: "ruby-red", name: "Ruby Red", bg: "#fdeaea", card: "#fbf3f3", input: "#fbf3f3", textMuted: "#5e5050", primaryFg: "#ffffff", primary: "#b91c1c", accent: "#ef4444", bgSoft: "#fdeaea", text: "#3a0707", border: "#f3bcbc" },
  { id: "crimson", name: "Crimson", bg: "#fce6ec", card: "#faf3f5", input: "#faf3f5", textMuted: "#5b5050", primaryFg: "#ffffff", primary: "#9f1239", accent: "#f43f5e", bgSoft: "#fce6ec", text: "#330512", border: "#f1b9c6" },
  { id: "burgundy", name: "Burgundy", bg: "#fbe4ee", card: "#f8f3f5", input: "#f8f3f5", textMuted: "#565050", primaryFg: "#ffffff", primary: "#831843", accent: "#be185d", bgSoft: "#fbe4ee", text: "#280613", border: "#eeb1c9" },
  { id: "plum", name: "Plum", bg: "#f8e6f8", card: "#f7f3f8", input: "#f7f3f8", textMuted: "#545054", primaryFg: "#ffffff", primary: "#701a75", accent: "#a21caf", bgSoft: "#f8e6f8", text: "#240324", border: "#dcaddc" },
  { id: "violet", name: "Violet", bg: "#f0eaff", card: "#f8f5fe", input: "#f8f5fe", textMuted: "#545067", primaryFg: "#ffffff", primary: "#7c3aed", accent: "#8b5cf6", bgSoft: "#f0eaff", text: "#1f0a4f", border: "#cbb8f9" },
  { id: "lavender", name: "Lavender", bg: "#f3eeff", card: "#f9f6fe", input: "#f9f6fe", textMuted: "#595569", primaryFg: "#ffffff", primary: "#8b5cf6", accent: "#c4b5fd", bgSoft: "#f3eeff", text: "#241a4c", border: "#d6c8f3" },
  { id: "iris", name: "Iris", bg: "#ebeefe", card: "#f7f7fe", input: "#f7f7fe", textMuted: "#55566c", primaryFg: "#ffffff", primary: "#6366f1", accent: "#818cf8", bgSoft: "#ebeefe", text: "#1a1d52", border: "#c1c5f1" },
  { id: "azure", name: "Azure", bg: "#e8f1fe", card: "#f5f8fe", input: "#f5f8fe", textMuted: "#505664", primaryFg: "#ffffff", primary: "#3b82f6", accent: "#38bdf8", bgSoft: "#e8f1fe", text: "#0c1f44", border: "#b6cbf4" },
  { id: "cerulean", name: "Cerulean", bg: "#e0f3fc", card: "#f2fafd", input: "#f2fafd", textMuted: "#506066", primaryFg: "#ffffff", primary: "#0ea5e9", accent: "#7dd3fc", bgSoft: "#e0f3fc", text: "#063142", border: "#b1dcf2" },
  { id: "sapphire", name: "Sapphire", bg: "#e6ecfb", card: "#f3f5fb", input: "#f3f5fb", textMuted: "#50505e", primaryFg: "#ffffff", primary: "#1e40af", accent: "#3b82f6", bgSoft: "#e6ecfb", text: "#08143b", border: "#b8c4ee" },
  { id: "forest-dark", name: "Forest Dark", bg: "#e7f1ea", card: "#f3f6f4", input: "#f3f6f4", textMuted: "#505450", primaryFg: "#ffffff", primary: "#14532d", accent: "#22c55e", bgSoft: "#e7f1ea", text: "#082014", border: "#bcd6c5" },
  { id: "mossy", name: "Mossy", bg: "#f1f6e3", card: "#f5f7f3", input: "#f5f7f3", textMuted: "#505550", primaryFg: "#ffffff", primary: "#3f6212", accent: "#84cc16", bgSoft: "#f1f6e3", text: "#152002", border: "#d2e1a3" },
  { id: "olive", name: "Olive", bg: "#f4f6e0", card: "#f7f8f3", input: "#f7f8f3", textMuted: "#565950", primaryFg: "#ffffff", primary: "#65731e", accent: "#a3a72c", bgSoft: "#f4f6e0", text: "#1f2504", border: "#d6da9d" },
  { id: "khaki", name: "Khaki", bg: "#fbf3df", card: "#faf7f2", input: "#faf7f2", textMuted: "#5a5450", primaryFg: "#ffffff", primary: "#a16207", accent: "#d97706", bgSoft: "#fbf3df", text: "#2a1c03", border: "#ecd6a0" },
  { id: "sand", name: "Sand", bg: "#fbf2e1", card: "#faf7f4", input: "#faf7f4", textMuted: "#5b5550", primaryFg: "#ffffff", primary: "#a87129", accent: "#d6a85a", bgSoft: "#fbf2e1", text: "#2c1d07", border: "#ead3a8" },
  { id: "terracotta", name: "Terracotta", bg: "#fbeadd", card: "#f9f4f3", input: "#f9f4f3", textMuted: "#585050", primaryFg: "#ffffff", primary: "#9a3412", accent: "#ea580c", bgSoft: "#fbeadd", text: "#2c0d03", border: "#eec4a4" },
  { id: "bronze", name: "Bronze", bg: "#fbf2d9", card: "#f8f6f2", input: "#f8f6f2", textMuted: "#575150", primaryFg: "#ffffff", primary: "#854d0e", accent: "#ca8a04", bgSoft: "#fbf2d9", text: "#251603", border: "#e8d290" },
  { id: "copper", name: "Copper", bg: "#fae3d2", card: "#f8f4f3", input: "#f8f4f3", textMuted: "#515050", primaryFg: "#ffffff", primary: "#7c2d12", accent: "#ea580c", bgSoft: "#fae3d2", text: "#1f0a03", border: "#e8c1a1" },
  { id: "mocha", name: "Mocha", bg: "#f1e4d5", card: "#f7f5f4", input: "#f7f5f4", textMuted: "#535050", primaryFg: "#ffffff", primary: "#6f3f25", accent: "#a07248", bgSoft: "#f1e4d5", text: "#1f1109", border: "#d6bfa3" },
  { id: "espresso", name: "Espresso", bg: "#ecdfd4", card: "#f5f4f3", input: "#f5f4f3", textMuted: "#505050", primaryFg: "#ffffff", primary: "#3f2317", accent: "#8b5a3c", bgSoft: "#ecdfd4", text: "#180d07", border: "#c4ac97" },
  { id: "noir", name: "Noir", bg: "#eef0f3", card: "#f3f3f4", input: "#f3f3f4", textMuted: "#505050", primaryFg: "#ffffff", primary: "#111827", accent: "#6b7280", bgSoft: "#eef0f3", text: "#0a0f1c", border: "#cbd1da" },
  { id: "midnight", name: "Midnight", bg: "#eaeef5", card: "#f3f3f4", input: "#f3f3f4", textMuted: "#505050", primaryFg: "#ffffff", primary: "#0f172a", accent: "#475569", bgSoft: "#eaeef5", text: "#080d1c", border: "#c0c8d9" },
  { id: "abyss", name: "Abyss", bg: "#e6eaf1", card: "#f2f2f3", input: "#f2f2f3", textMuted: "#505050", primaryFg: "#ffffff", primary: "#020617", accent: "#1e293b", bgSoft: "#e6eaf1", text: "#06080f", border: "#b6bcc7" },
  { id: "ink-blue", name: "Ink Blue", bg: "#e1e7f3", card: "#f2f3f5", input: "#f2f3f5", textMuted: "#505056", primaryFg: "#ffffff", primary: "#0b1e3f", accent: "#1d4ed8", bgSoft: "#e1e7f3", text: "#06122a", border: "#aebedb" },
  { id: "denim", name: "Denim", bg: "#e3eaf8", card: "#f3f5f9", input: "#f3f5f9", textMuted: "#50505d", primaryFg: "#ffffff", primary: "#1e3a8a", accent: "#3b82f6", bgSoft: "#e3eaf8", text: "#0a1736", border: "#b3c2e5" },
  { id: "powder", name: "Powder", bg: "#eaf3fe", card: "#f9fcfe", input: "#f9fcfe", textMuted: "#5d6879", primaryFg: "#111827", primary: "#93c5fd", accent: "#bfdbfe", bgSoft: "#eaf3fe", text: "#1f3a64", border: "#cee1f8" },
  { id: "mint-cream", name: "Mint Cream", bg: "#e6fbf2", card: "#f4fcf9", input: "#f4fcf9", textMuted: "#52645c", primaryFg: "#111827", primary: "#34d399", accent: "#a7f3d0", bgSoft: "#e6fbf2", text: "#0d3a25", border: "#b6e9d4" },
  { id: "sage", name: "Sage", bg: "#f3fae2", card: "#f8fcf3", input: "#f8fcf3", textMuted: "#585e50", primaryFg: "#111827", primary: "#84cc16", accent: "#bef264", bgSoft: "#f3fae2", text: "#1f2e02", border: "#d3ec9a" },
  { id: "butter", name: "Butter", bg: "#fefce8", card: "#fefdf5", input: "#fefdf5", textMuted: "#696651", primaryFg: "#111827", primary: "#fde047", accent: "#facc15", bgSoft: "#fefce8", text: "#3f3703", border: "#f7eea3" },
  { id: "peach", name: "Peach", bg: "#fff4e6", card: "#fefbf8", input: "#fefbf8", textMuted: "#756355", primaryFg: "#111827", primary: "#fdba74", accent: "#fed7aa", bgSoft: "#fff4e6", text: "#5a2d0a", border: "#fbd9b3" },
];

export const CUSTOM_COLOR_FIELDS: Array<{ key: keyof CustomColorTheme; label: string; group: "Surface" | "Text" | "Action" }> = [
  { key: "bg", label: "App background", group: "Surface" },
  { key: "card", label: "Card background", group: "Surface" },
  { key: "input", label: "Input background", group: "Surface" },
  { key: "bgSoft", label: "Soft background", group: "Surface" },
  { key: "text", label: "Main text", group: "Text" },
  { key: "textMuted", label: "Muted text", group: "Text" },
  { key: "border", label: "Border", group: "Text" },
  { key: "primary", label: "Primary action", group: "Action" },
  { key: "primaryFg", label: "Primary text", group: "Action" },
  { key: "accent", label: "Accent", group: "Action" },
];

export const DEFAULT_CUSTOM_COLORS: CustomColorTheme = {
  bg: "#f3f4f6",
  card: "#ffffff",
  input: "#ffffff",
  text: "#111827",
  textMuted: "#4b5563",
  border: "#d1d5db",
  primary: "#2563eb",
  primaryFg: "#ffffff",
  accent: "#0ea5e9",
  bgSoft: "#eaf3ff",
};

export const DEFAULT_CUSTOM_PRESET: CustomColorPreset = {
  id: DEFAULT_CUSTOM_PRESET_ID,
  name: "Default Custom",
  colors: DEFAULT_CUSTOM_COLORS,
};

export function isColorThemeId(value: string): value is string {
  return COLOR_THEMES.some((theme) => theme.id === value);
}

export function getColorTheme(id: string | null | undefined): ColorTheme {
  if (!id) return COLOR_THEMES[2];
  return COLOR_THEMES.find((theme) => theme.id === id) ?? COLOR_THEMES[2];
}

export function themeToCustomColors(theme: ColorTheme): CustomColorTheme {
  return {
    bg: theme.bg,
    card: theme.card,
    input: theme.input,
    text: theme.text,
    textMuted: theme.textMuted,
    border: theme.border,
    primary: theme.primary,
    primaryFg: theme.primaryFg,
    accent: theme.accent,
    bgSoft: theme.bgSoft,
  };
}

export function getThemeVariables(colors: CustomColorTheme): Record<string, string> {
  return {
    "--theme-bg": colors.bg,
    "--theme-card": colors.card,
    "--theme-input": colors.input,
    "--theme-text": colors.text,
    "--theme-text-muted": colors.textMuted,
    "--theme-border": colors.border,
    "--theme-primary": colors.primary,
    "--theme-primary-fg": colors.primaryFg,
    "--theme-accent": colors.accent,
    "--theme-bg-soft": colors.bgSoft,
  };
}

export function applyThemeVariables(colors: CustomColorTheme): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(getThemeVariables(colors))) {
    root.style.setProperty(name, value);
  }
}

export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);
}

export function normalizeCustomColors(value: Partial<CustomColorTheme> | null | undefined): CustomColorTheme {
  const result: CustomColorTheme = { ...DEFAULT_CUSTOM_COLORS };
  if (value) {
    for (const { key } of CUSTOM_COLOR_FIELDS) {
      const v = value[key];
      if (typeof v === "string" && isHexColor(v)) {
        result[key] = v;
      }
    }
  }
  return result;
}

export function normalizeCustomPresets(value: Partial<CustomColorPreset>[] | null | undefined): CustomColorPreset[] {
  const presets = (value ?? [])
    .filter((preset) => typeof preset?.id === "string" && typeof preset?.name === "string")
    .map((preset) => ({
      id: preset.id!,
      name: preset.name!,
      colors: normalizeCustomColors(preset.colors),
    }));
  return presets.length > 0
    ? presets
    : [{ ...DEFAULT_CUSTOM_PRESET, colors: { ...DEFAULT_CUSTOM_PRESET.colors } }];
}

export function makeCustomPreset(name: string, colors: CustomColorTheme, existing: CustomColorPreset[]): CustomColorPreset {
  const cleanName = name.trim() || "Custom preset";
  const baseId = `custom-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "preset"}`;
  let id = baseId;
  let counter = 2;
  while (existing.some((preset) => preset.id === id)) {
    id = `${baseId}-${counter}`;
    counter += 1;
  }
  return { id, name: cleanName, colors: normalizeCustomColors(colors) };
}

export function getCustomPreset(presets: CustomColorPreset[], id: string | null | undefined): CustomColorPreset | null {
  if (!id) return null;
  return presets.find((preset) => preset.id === id) ?? null;
}
