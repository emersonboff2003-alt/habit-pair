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

/** Todos os temas: `<cor>-<modo>` (ex.: "pink-dark", "blue-light"). */
export const ALL_THEMES: string[] = THEME_COLORS.flatMap((color) =>
  THEME_MODES.map((mode) => `${color.id}-${mode.id}`),
);

export const DEFAULT_THEME = "pink-dark";

export function isThemeValid(theme: string): boolean {
  return ALL_THEMES.includes(theme);
}
