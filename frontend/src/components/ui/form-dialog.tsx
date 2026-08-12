import { useState, useEffect } from "react"
import { useForm, type UseFormReturn, type FieldValues, type DefaultValues, type SubmitHandler, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { logger } from "@/utils/logger";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"

interface FormDialogProps<T extends FieldValues> {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
    title: string
    description?: string
    icon?: LucideIcon
    schema: z.ZodType<T>
    defaultValues: DefaultValues<T>
    onSubmit: (values: T) => Promise<void>
    renderFields: (form: UseFormReturn<T>) => React.ReactNode
    submitText?: string
}

export function FormDialog<T extends FieldValues>({
    open: controlledOpen,
    onOpenChange,
    trigger,
    title,
    description,
    icon: Icon,
    schema,
    defaultValues,
    onSubmit,
    renderFields,
    submitText,
}: FormDialogProps<T>) {
    const { t } = useTranslation()
    const isControlled = controlledOpen !== undefined
    const [internalOpen, setInternalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const open = isControlled ? controlledOpen : internalOpen

    const handleOpenChange = (newOpen: boolean) => {
        if (!isControlled) {
            setInternalOpen(newOpen)
        }
        onOpenChange?.(newOpen)
    }

    const resolver = zodResolver(schema as never) as unknown as Resolver<T>

    const form = useForm<T>({
        resolver,
        defaultValues,
    })

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (open) {
            form.reset(defaultValues)
        }
    }, [open, defaultValues, form])

    const handleSubmit: SubmitHandler<T> = async (data) => {
        setIsLoading(true)
        try {
            await onSubmit(data)
            handleOpenChange(false)
        } catch (error) {
            logger.error(error)
            // Error handling is expected to be done in onSubmit (e.g. toast)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent
                className="sm:max-w-[425px] !bg-background !backdrop-blur-none"
                onInteractOutside={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <DialogHeader className="flex flex-row items-center gap-4 pb-2">
                    {Icon && (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                            {title}
                        </DialogTitle>
                        {description && (
                            <DialogDescription className="text-xs font-medium text-muted-foreground/80">
                                {description}
                            </DialogDescription>
                        )}
                    </div>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 mt-2">
                        {renderFields(form)}
                        <DialogFooter className="pt-2">
                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {submitText || t('common.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
