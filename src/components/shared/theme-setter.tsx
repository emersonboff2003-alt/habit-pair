import { DEFAULT_THEME } from "@/lib/themes";

interface ThemeSetterProps {
  theme?: string;
}

/**
 * Aplica o tema no <html data-theme="..."> via script inline, executado
 * durante a renderização do HTML (antes do navegador pintar a tela), para
 * evitar o "flash" do tema errado. O dashboard passa o tema do perfil ativo.
 */
export function ThemeSetter({ theme = DEFAULT_THEME }: ThemeSetterProps) {
  const script = `document.documentElement.setAttribute("data-theme", ${JSON.stringify(theme)});`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
