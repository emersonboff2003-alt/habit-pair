"use client";

import { useEffect } from "react";

/**
 * Mantém o tema aplicado no <html data-theme="..."> sincronizado com o perfil
 * ativo. Roda ao montar e sempre que a prop mudar (ex.: troca de perfil via
 * navegação sem recarregamento completo), garantindo que cada perfil sempre
 * exiba o SEU tema, independente do que ficou salvo antes no navegador.
 */
export function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return null;
}
