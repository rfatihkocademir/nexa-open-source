import { useTranslation } from 'react-i18next'
import { tr, enUS } from 'date-fns/locale'

export function useDateLocale() {
    const { i18n } = useTranslation()
    return i18n.language?.startsWith('tr') ? tr : enUS
}
