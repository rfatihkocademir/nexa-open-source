import { motion, useReducedMotion } from "framer-motion"
import type { Variants } from "framer-motion"
import type { ReactNode } from "react"

interface PageTransitionProps {
    children: ReactNode
    className?: string
}

const pageVariants: Variants = {
    initial: {
        opacity: 0,
        y: 10,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.24,
            ease: [0.22, 1, 0.36, 1],
        },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: {
            duration: 0.16,
            ease: [0.22, 1, 0.36, 1],
        },
    },
}

export function PageTransition({ children, className }: PageTransitionProps) {
    const reduceMotion = useReducedMotion()
    return (
        <motion.div
            variants={reduceMotion ? undefined : pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={className ? `${className} w-full` : "w-full"}
        >
            {children}
        </motion.div>
    )
}
