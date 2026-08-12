import { useState, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";

import { uploadMedia, getImageUrl } from "@/services/upload.service";
import { userService } from "@/services/user.service";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserGuide } from "./components/UserGuide";
import { authService } from "@/services/auth.service";
import { GlossaryTerm } from "@/components/help/GlossaryTerm";

export default function ProfilePage() {
    const user = useAuthStore((state) => state.user);
    const updateUser = useAuthStore((state) => state.updateUser);
    const { t } = useTranslation();

    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
    const [mfaCode, setMfaCode] = useState("");

    const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error(t("upload.invalid_type", "Invalid file type. Please select an image."));
            return;
        }

        try {
            setIsUploading(true);
            const uploadResult = await uploadMedia(file, { category: 'AVATAR' });
            
            // Save immediately to user profile
            const updatedUser = await userService.updateMe({
                avatarUrl: uploadResult.url
            });
            updateUser({ avatarUrl: updatedUser.avatarUrl });
            toast.success(t("profile.avatar_updated", "Avatar updated successfully!"));
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : t("common.error"));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSaveChanges = async () => {
        try {
            setIsSaving(true);
            const updatedUser = await userService.updateMe({
                firstName,
                lastName
            });
            updateUser({ firstName: updatedUser.firstName, lastName: updatedUser.lastName });
            toast.success(t("profile.saved", "Profile saved successfully!"));
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : t("common.error"));
        } finally {
            setIsSaving(false);
        }
    };

    const startMfa = async () => {
        try { setMfaSetup(await authService.beginMfa()); } catch { toast.error(t('profile.mfa_error', 'MFA kurulumu başlatılamadı.')); }
    };
    const confirmMfa = async () => {
        try { await authService.confirmMfa(mfaCode); updateUser({ mfaEnabled: true }); setMfaSetup(null); setMfaCode(''); toast.success(t('profile.mfa_enabled', 'MFA etkinleştirildi. Lütfen tekrar giriş yapın.')); }
        catch { toast.error(t('profile.mfa_invalid', 'Doğrulama kodu geçersiz.')); }
    };
    const disableMfa = async () => {
        try { await authService.disableMfa(mfaCode); updateUser({ mfaEnabled: false }); setMfaCode(''); toast.success(t('profile.mfa_disabled', 'MFA devre dışı bırakıldı.')); }
        catch { toast.error(t('profile.mfa_invalid', 'Doğrulama kodu geçersiz.')); }
    };

    return (
        <div className="page-shell page-stack">
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                    {t("profile.account_label")}
                </p>
                <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {t("profile.title")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("profile.description")}</p>
            </section>

            <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <Card className="rounded-2xl border-border/70 shadow-sm">
                    <CardContent className="flex flex-col items-center space-y-4 p-6 text-center">
                        <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                            <Avatar className="h-24 w-24 border border-border/70 transition-opacity group-hover:opacity-75">
                                <AvatarImage src={user?.avatarUrl ? getImageUrl(user.avatarUrl) : ""} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/40">
                                {isUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept="image/*" 
                            />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">
                                {user?.firstName} {user?.lastName}
                            </h3>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                        <Badge variant="outline" className="border-border/70 bg-muted/20 px-2.5 py-1 text-xs uppercase tracking-[0.08em]">
                            {user?.role ? t(`common.roles.${user.role}`) : ""}
                        </Badge>
                    </CardContent>
                </Card>

                <div className="space-y-5">
                    <Card className="rounded-2xl border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle>{t("profile.personal_info")}</CardTitle>
                            <CardDescription>{t("profile.personal_info_desc")}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="firstName">{t("profile.first_name")}</Label>
                                    <Input 
                                        id="firstName" 
                                        value={firstName} 
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="border-border/70" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="lastName">{t("profile.last_name")}</Label>
                                    <Input 
                                        id="lastName" 
                                        value={lastName} 
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="border-border/70" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="email">{t("common.email")}</Label>
                                <Input id="email" defaultValue={user?.email} disabled className="border-border/70" />
                            </div>
                            <div className="flex justify-end">
                                <Button 
                                    variant="success" 
                                    className="rounded-md"
                                    onClick={handleSaveChanges}
                                    disabled={isSaving || !firstName.trim() || !lastName.trim()}
                                >
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t("profile.save_changes")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border/70 shadow-sm">
                        <CardHeader><CardTitle><GlossaryTerm term="MFA">{t('profile.mfa_title', 'Çok faktörlü doğrulama')}</GlossaryTerm></CardTitle><CardDescription>{t('profile.mfa_description', 'Authenticator uygulamasıyla hesabınıza ikinci bir güvenlik katmanı ekleyin.')}</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            {mfaSetup && <div className="space-y-2 rounded-lg border bg-muted/30 p-4"><p className="text-sm">{t('profile.mfa_secret_help', 'Bu anahtarı authenticator uygulamanıza ekleyin:')}</p><code className="block break-all rounded bg-background p-2 text-xs">{mfaSetup.secret}</code><a className="text-xs text-primary underline" href={mfaSetup.otpauthUrl}>{t('profile.mfa_open_app', 'Authenticator uygulamasında aç')}</a></div>}
                            {(mfaSetup || user?.mfaEnabled) && <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="000000" className="max-w-48 font-mono tracking-[0.35em]" />}
                            {!user?.mfaEnabled && !mfaSetup && <Button variant="outline" onClick={startMfa}>{t('profile.mfa_start', 'MFA kurulumunu başlat')}</Button>}
                            {mfaSetup && <Button onClick={confirmMfa} disabled={!/^\d{6}$/.test(mfaCode)}>{t('profile.mfa_confirm', 'Doğrula ve etkinleştir')}</Button>}
                            {user?.mfaEnabled && <Button variant="destructive" onClick={disableMfa} disabled={!/^\d{6}$/.test(mfaCode)}>{t('profile.mfa_disable', 'MFA’yı devre dışı bırak')}</Button>}
                        </CardContent>
                    </Card>

                    {user?.role && <UserGuide role={user.role} />}
                </div>
            </section>
        </div>
    );
}
