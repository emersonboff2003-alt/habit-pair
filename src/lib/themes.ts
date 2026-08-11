// Catálogo de temas disponíveis no app.
// Cada perfil escolhe um tema; a escolha fica salva em profiles.theme.

export const THEME_COLORS = [
  { id: "pink", label: "Rosa" },
  { id: "gold", label: "Dourado" },
  { id: "blue", label: "Azul" },
  { id: "cyan", label: "Ciano" },
  { id: "red", label: "Vermelho" },
  { id: "green", label: "Verde" },
] as const;

export const THEME_MODES = [
  { id: "dark", label: "Escuro" },
  { id: "light", label: "Claro" },
] as const;

export const CLASSIC_THEME = "classic-dark";

/** Todos os temas: `<cor>-<modo>` (ex.: "pink-dark", "blue-light") + o clássico. */
export const ALL_THEMES: string[] = [
  CLASSIC_THEME,
  ...THEME_COLORS.flatMap((color) =>
    THEME_MODES.map((mode) => `${color.id}-${mode.id}`),
  ),
];

export const DEFAULT_THEME = CLASSIC_THEME;

export function isThemeValid(theme: string): boolean {
  return ALL_THEMES.includes(theme);
}
