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
      className={`flex w-full cursor-pointer flex-col items-stretch gap-1 rounded-md border p-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
        selected
          ? "border-gray-900 shadow-sm ring-2 ring-gray-900 dark:border-gray-100 dark:ring-gray-100"
          : "border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
      }`}
    >
      <span className="flex h-6 w-full overflow-hidden rounded">
        <span className="flex-1" style={{ backgroundColor: theme.primary }} />
        <span className="flex-1" style={{ backgroundColor: theme.accent }} />
      </span>
      <span className="flex h-3 w-full overflow-hidden rounded">
        <span className="flex-1" style={{ backgroundColor: theme.bgSoft, borderTop: `1px solid ${theme.border}` }} />
      </span>
      <span className="truncate font-medium text-gray-900 dark:text-gray-100">{theme.name}</span>
    </button>
  );
}

interface ColorThemePickerProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function ColorThemePicker({ selected, onSelect }: ColorThemePickerProps) {
  return (
    <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-label="Color theme">
      {COLOR_THEMES.map((theme) => (
        <ColorThemeSwatch
          key={theme.id}
          theme={theme}
          selected={theme.id === selected}
          onSelect={onSelect}
        />
      ))}
    </fieldset>
  );
}