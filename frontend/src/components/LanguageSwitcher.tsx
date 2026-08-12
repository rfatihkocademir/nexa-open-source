import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { useEffect } from 'react';

export function LanguageSwitcher() {
    const { i18n, t } = useTranslation();
    useEffect(() => {
        const syncLanguage = (language: string) => { document.documentElement.lang = language.split('-')[0]; };
        syncLanguage(i18n.language);
        i18n.on('languageChanged', syncLanguage);
        return () => i18n.off('languageChanged', syncLanguage);
    }, [i18n]);

    const changeLanguage = (lng: string) => {
        void i18n.changeLanguage(lng);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('common.language')} title={t('common.language')}>
                    <Globe className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">{t('common.language')}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                    🇺🇸 {t('common.english')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('tr')}>
                    🇹🇷 {t('common.turkish')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
