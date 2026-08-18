import { COLOR_THEMES, type ColorTheme } from "../../shared/state/colorThemes";

interface ColorThemeSwatchProps {
  theme: ColorTheme;
  selected: boolean;
  onSelect: (id: string) => void;
}

function ColorThemeSwatch({ theme, selected, onSelect }: ColorThemeSwatchProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Color theme ${theme.name}`}
      onClick={() => onSelect(theme.id)}
      className="min-w-0 rounded-md border p-1.5 text-left text-[11px] transition hover:opacity-90 focus:outline-none focus:ring-2"
      style={{
        borderColor: selected ? "var(--theme-primary)" : "var(--theme-border)",
        backgroundColor: "var(--theme-card)",
        color: "var(--theme-text)",
        boxShadow: selected ? "0 0 0 2px var(--theme-primary)" : undefined,
      }}
    >
      <span className="mb-1 flex h-4 w-full overflow-hidden rounded-sm">
        <span className="flex-1" style={{ backgroundColor: theme.primary }} />
        <span className="flex-1" style={{ backgroundColor: theme.accent }} />
        <span className="flex-1" style={{ backgroundColor: theme.bgSoft }} />
      </span>
      <span className="block truncate font-medium">{theme.name}</span>
    </button>
  );
}

interface ColorThemePickerProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function ColorThemePicker({ selected, onSelect }: ColorThemePickerProps) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sr-only">Color theme</span>
        <select
          aria-label="Color theme"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          className="block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1"
          style={{
            borderColor: "var(--theme-border)",
            backgroundColor: "var(--theme-input)",
            color: "var(--theme-text)",
          }}
        >
          {COLOR_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5" role="radiogroup" aria-label="Color theme swatches">
        {COLOR_THEMES.map((theme) => (
          <ColorThemeSwatch key={theme.id} theme={theme} selected={theme.id === selected} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
