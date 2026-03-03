import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { supportedLanguages, getLanguageDir } from "~/lib/i18n";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  function handleLanguageChange(langCode: string) {
    i18n.changeLanguage(langCode);
    // Persist in cookie
    document.cookie = `i18n_lang=${langCode};path=/;max-age=31536000;SameSite=Lax`;
    // Update HTML dir attribute for RTL support
    const dir = getLanguageDir(langCode);
    document.documentElement.dir = dir;
    document.documentElement.lang = langCode;
  }

  const currentLang =
    supportedLanguages.find((l) => l.code === i18n.language) ?? supportedLanguages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <Languages className="size-4" />
          <span className="sr-only">{currentLang.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={i18n.language === lang.code ? "bg-accent" : ""}
          >
            <span className="mr-2 text-sm">{lang.code.toUpperCase()}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
