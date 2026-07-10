export interface ColorTheme {
  id: string;
  name: string;
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
  { id: "light-mode", name: "Light mode", primary: "#ffffff", accent: "#e5e7eb", bgSoft: "#f9fafb", text: "#111827", border: "#d1d5db" },
  { id: "dark-mode", name: "Dark mode", primary: "#111827", accent: "#374151", bgSoft: "#1f2937", text: "#f9fafb", border: "#4b5563" },
  { id: "ocean-blue", name: "Ocean Blue", primary: "#2563eb", accent: "#0ea5e9", bgSoft: "#eaf3ff", text: "#0b1d3a", border: "#c7d8ff" },
  { id: "sky-breeze", name: "Sky Breeze", primary: "#0284c7", accent: "#22d3ee", bgSoft: "#e6f6fb", text: "#0b2a3a", border: "#bde4ef" },
  { id: "indigo-dusk", name: "Indigo Dusk", primary: "#4f46e5", accent: "#a78bfa", bgSoft: "#eef0ff", text: "#1b1546", border: "#c9c7ff" },
  { id: "royal-violet", name: "Royal Violet", primary: "#6d28d9", accent: "#c084fc", bgSoft: "#f3eaff", text: "#2a0f4c", border: "#dcc6ff" },
  { id: "magenta-pop", name: "Magenta Pop", primary: "#db2777", accent: "#ec4899", bgSoft: "#fdeaf3", text: "#4a0a2a", border: "#f7c1d8" },
  { id: "rose-blush", name: "Rose Blush", primary: "#e11d48", accent: "#fb7185", bgSoft: "#fdecee", text: "#3f0918", border: "#f6c2cb" },
  { id: "coral-reef", name: "Coral Reef", primary: "#f43f5e", accent: "#fb923c", bgSoft: "#fff1ee", text: "#3f0e0e", border: "#fbd0c5" },
  { id: "sunset-orange", name: "Sunset Orange", primary: "#ea580c", accent: "#fbbf24", bgSoft: "#fff3e6", text: "#3a1a05", border: "#fad4a8" },
  { id: "amber-warm", name: "Amber Warm", primary: "#d97706", accent: "#facc15", bgSoft: "#fff7e0", text: "#3b2400", border: "#fbe193" },
  { id: "gold-leaf", name: "Gold Leaf", primary: "#a16207", accent: "#eab308", bgSoft: "#fdf6d8", text: "#2c1d00", border: "#f1de8e" },
  { id: "lime-zest", name: "Lime Zest", primary: "#65a30d", accent: "#a3e635", bgSoft: "#f3fae1", text: "#1f2e02", border: "#d3ec9a" },
  { id: "emerald-fresh", name: "Emerald Fresh", primary: "#059669", accent: "#34d399", bgSoft: "#e6fbf2", text: "#03301e", border: "#b6efd3" },
  { id: "forest-pine", name: "Forest Pine", primary: "#047857", accent: "#10b981", bgSoft: "#e6f5ec", text: "#022a1d", border: "#b6dccc" },
  { id: "teal-cyan", name: "Teal Cyan", primary: "#0d9488", accent: "#2dd4bf", bgSoft: "#e6f8f6", text: "#06302c", border: "#b6e3df" },
  { id: "aqua-mint", name: "Aqua Mint", primary: "#0891b2", accent: "#5eead4", bgSoft: "#e0f7f5", text: "#053040", border: "#afe6e1" },
  { id: "turquoise", name: "Turquoise", primary: "#06b6d4", accent: "#22d3ee", bgSoft: "#dff9fb", text: "#063444", border: "#a8e0e9" },
  { id: "steel-blue", name: "Steel Blue", primary: "#1d4ed8", accent: "#60a5fa", bgSoft: "#e8eefb", text: "#0a1638", border: "#b7c7ef" },
  { id: "slate-storm", name: "Slate Storm", primary: "#334155", accent: "#94a3b8", bgSoft: "#eef1f5", text: "#111827", border: "#c6cdd7" },
  { id: "graphite", name: "Graphite", primary: "#475569", accent: "#64748b", bgSoft: "#f1f3f7", text: "#0f172a", border: "#cfd6e0" },
  { id: "charcoal", name: "Charcoal", primary: "#1f2937", accent: "#374151", bgSoft: "#eef0f3", text: "#0b1220", border: "#cbd2dc" },
  { id: "ruby-red", name: "Ruby Red", primary: "#b91c1c", accent: "#ef4444", bgSoft: "#fdeaea", text: "#3a0707", border: "#f3bcbc" },
  { id: "crimson", name: "Crimson", primary: "#9f1239", accent: "#f43f5e", bgSoft: "#fce6ec", text: "#330512", border: "#f1b9c6" },
  { id: "burgundy", name: "Burgundy", primary: "#831843", accent: "#be185d", bgSoft: "#fbe4ee", text: "#280613", border: "#eeb1c9" },
  { id: "plum", name: "Plum", primary: "#701a75", accent: "#a21caf", bgSoft: "#f8e6f8", text: "#240324", border: "#dcaddc" },
  { id: "violet", name: "Violet", primary: "#7c3aed", accent: "#8b5cf6", bgSoft: "#f0eaff", text: "#1f0a4f", border: "#cbb8f9" },
  { id: "lavender", name: "Lavender", primary: "#8b5cf6", accent: "#c4b5fd", bgSoft: "#f3eeff", text: "#241a4c", border: "#d6c8f3" },
  { id: "iris", name: "Iris", primary: "#6366f1", accent: "#818cf8", bgSoft: "#ebeefe", text: "#1a1d52", border: "#c1c5f1" },
  { id: "azure", name: "Azure", primary: "#3b82f6", accent: "#38bdf8", bgSoft: "#e8f1fe", text: "#0c1f44", border: "#b6cbf4" },
  { id: "cerulean", name: "Cerulean", primary: "#0ea5e9", accent: "#7dd3fc", bgSoft: "#e0f3fc", text: "#063142", border: "#b1dcf2" },
  { id: "sapphire", name: "Sapphire", primary: "#1e40af", accent: "#3b82f6", bgSoft: "#e6ecfb", text: "#08143b", border: "#b8c4ee" },
  { id: "forest-dark", name: "Forest Dark", primary: "#14532d", accent: "#22c55e", bgSoft: "#e7f1ea", text: "#082014", border: "#bcd6c5" },
  { id: "mossy", name: "Mossy", primary: "#3f6212", accent: "#84cc16", bgSoft: "#f1f6e3", text: "#152002", border: "#d2e1a3" },
  { id: "olive", name: "Olive", primary: "#65731e", accent: "#a3a72c", bgSoft: "#f4f6e0", text: "#1f2504", border: "#d6da9d" },
  { id: "khaki", name: "Khaki", primary: "#a16207", accent: "#d97706", bgSoft: "#fbf3df", text: "#2a1c03", border: "#ecd6a0" },
  { id: "sand", name: "Sand", primary: "#a87129", accent: "#d6a85a", bgSoft: "#fbf2e1", text: "#2c1d07", border: "#ead3a8" },
  { id: "terracotta", name: "Terracotta", primary: "#9a3412", accent: "#ea580c", bgSoft: "#fbeadd", text: "#2c0d03", border: "#eec4a4" },
  { id: "bronze", name: "Bronze", primary: "#854d0e", accent: "#ca8a04", bgSoft: "#fbf2d9", text: "#251603", border: "#e8d290" },
  { id: "copper", name: "Copper", primary: "#7c2d12", accent: "#ea580c", bgSoft: "#fae3d2", text: "#1f0a03", border: "#e8c1a1" },
  { id: "mocha", name: "Mocha", primary: "#6f3f25", accent: "#a07248", bgSoft: "#f1e4d5", text: "#1f1109", border: "#d6bfa3" },
  { id: "espresso", name: "Espresso", primary: "#3f2317", accent: "#8b5a3c", bgSoft: "#ecdfd4", text: "#180d07", border: "#c4ac97" },
  { id: "noir", name: "Noir", primary: "#111827", accent: "#6b7280", bgSoft: "#eef0f3", text: "#0a0f1c", border: "#cbd1da" },
  { id: "midnight", name: "Midnight", primary: "#0f172a", accent: "#475569", bgSoft: "#eaeef5", text: "#080d1c", border: "#c0c8d9" },
  { id: "abyss", name: "Abyss", primary: "#020617", accent: "#1e293b", bgSoft: "#e6eaf1", text: "#06080f", border: "#b6bcc7" },
  { id: "ink-blue", name: "Ink Blue", primary: "#0b1e3f", accent: "#1d4ed8", bgSoft: "#e1e7f3", text: "#06122a", border: "#aebedb" },
  { id: "denim", name: "Denim", primary: "#1e3a8a", accent: "#3b82f6", bgSoft: "#e3eaf8", text: "#0a1736", border: "#b3c2e5" },
  { id: "powder", name: "Powder", primary: "#93c5fd", accent: "#bfdbfe", bgSoft: "#eaf3fe", text: "#1f3a64", border: "#cee1f8" },
  { id: "mint-cream", name: "Mint Cream", primary: "#34d399", accent: "#a7f3d0", bgSoft: "#e6fbf2", text: "#0d3a25", border: "#b6e9d4" },
  { id: "sage", name: "Sage", primary: "#84cc16", accent: "#bef264", bgSoft: "#f3fae2", text: "#1f2e02", border: "#d3ec9a" },
  { id: "butter", name: "Butter", primary: "#fde047", accent: "#facc15", bgSoft: "#fefce8", text: "#3f3703", border: "#f7eea3" },
  { id: "peach", name: "Peach", primary: "#fdba74", accent: "#fed7aa", bgSoft: "#fff4e6", text: "#5a2d0a", border: "#fbd9b3" },
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
  const isDark = theme.id === "dark-mode";
  const isLight = theme.id === "light-mode";
  const card = isDark ? "#111827" : isLight ? "#ffffff" : "#ffffff";
  const input = isDark ? "#0f172a" : "#ffffff";
  return {
    bg: isDark ? "#030712" : isLight ? "#f3f4f6" : theme.bgSoft,
    card,
    input,
    text: theme.text,
    textMuted: isDark ? "#cbd5e1" : "#4b5563",
    border: theme.border,
    primary: theme.primary,
    primaryFg: isLight ? "#111827" : "#ffffff",
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
