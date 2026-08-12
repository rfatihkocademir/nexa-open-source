import { useHotkeys } from "react-hotkeys-hook"
import { useNavigate } from "react-router-dom"

interface UseShortcutsProps {
    onSearchFocus?: () => void
    onOpenCreate?: () => void
}

export const useShortcuts = ({ onSearchFocus, onOpenCreate }: UseShortcutsProps = {}) => {
    const navigate = useNavigate()

    // Search focus: /
    useHotkeys("/", (e) => {
        if (onSearchFocus) {
            e.preventDefault()
            onSearchFocus()
        }
    }, { enableOnFormTags: false })

    // Create new project: n
    useHotkeys("n", (e) => {
        if (onOpenCreate) {
            e.preventDefault()
            onOpenCreate()
        }
    }, { enableOnFormTags: false })

    // Navigate to dashboard: g d
    useHotkeys("g d", () => {
        navigate("/")
    })

    // Navigate to projects: g p
    useHotkeys("g p", () => {
        navigate("/projects")
    })
    
    // Toggle theme: t
    useHotkeys("shift+t", () => {
        const html = document.documentElement
        const isDark = html.classList.contains("dark")
        if (isDark) {
            html.classList.remove("dark")
            localStorage.setItem("theme", "light")
        } else {
            html.classList.add("dark")
            localStorage.setItem("theme", "dark")
        }
    })
}
