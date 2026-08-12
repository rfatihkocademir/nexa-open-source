import { useCallback, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AppDialogContext, type ConfirmOptions, type PromptOptions } from "@/components/ui/app-dialog-context";

type ConfirmState = ConfirmOptions & { resolve: (value: boolean) => void };
type PromptState = PromptOptions & { resolve: (value: string | null) => void };

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setConfirmState({ ...options, resolve });
  }), []);

  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => {
    setPromptValue(options.defaultValue || "");
    setPromptState({ ...options, resolve });
  }), []);

  const closeConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  const closePrompt = (value: string | null) => {
    promptState?.resolve(value);
    setPromptState(null);
  };

  return (
    <AppDialogContext.Provider value={{ confirm, prompt }}>
      {children}

      <AlertDialog open={Boolean(confirmState)} onOpenChange={(open) => { if (!open) closeConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn("flex items-center gap-2", confirmState?.destructive && "text-destructive")}>
              <AlertTriangle className="h-5 w-5" />
              {confirmState?.title || t("common.are_you_sure")}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => closeConfirm(false)}>
              {confirmState?.cancelLabel || t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeConfirm(true)}
              className={cn(confirmState?.destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            >
              {confirmState?.confirmLabel || (confirmState?.destructive ? t("common.delete") : t("common.update"))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(promptState)} onOpenChange={(open) => { if (!open) closePrompt(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{promptState?.title}</DialogTitle>
            {promptState?.description && <DialogDescription>{promptState.description}</DialogDescription>}
          </DialogHeader>
          <Input
            autoFocus
            value={promptValue}
            placeholder={promptState?.placeholder}
            onChange={(event) => setPromptValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && promptValue.trim()) closePrompt(promptValue.trim());
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => closePrompt(null)}>{promptState?.cancelLabel || t("common.cancel")}</Button>
            <Button disabled={!promptValue.trim()} onClick={() => closePrompt(promptValue.trim())}>
              {promptState?.confirmLabel || t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppDialogContext.Provider>
  );
}
