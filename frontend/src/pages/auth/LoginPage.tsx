import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Loader2, Shield, Zap, BarChart3, Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/store/authStore";
import { authService, loginSchema, type LoginCredentials } from "@/services/auth.service"

import { useTranslation } from "react-i18next"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { GlossaryTerm } from "@/components/help/GlossaryTerm"

export default function LoginPage() {
    const { t } = useTranslation()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const login = useAuthStore((state) => state.login)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (isAuthenticated) {
            const requestedPath = location.state && typeof location.state === "object" && "from" in location.state
                ? location.state.from
                : null
            const safePath = requestedPath && typeof requestedPath === "object" && "pathname" in requestedPath
                ? `${String(requestedPath.pathname || "")}${String(requestedPath.search || "")}${String(requestedPath.hash || "")}`
                : "/"
            navigate(safePath.startsWith("/") && !safePath.startsWith("//") ? safePath : "/", { replace: true })
        }
    }, [isAuthenticated, location.state, navigate])

    const form = useForm<LoginCredentials>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
            mfaCode: "",
            organizationSlug: "",
        },
    })

    async function onSubmit(data: LoginCredentials) {
        setIsLoading(true)
        try {
            const response = await authService.login(data)
            login(response)
            toast.success(t('auth.login_success'))
        } catch (error) {
            toast.error(t('auth.login_error'))
            logger.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    async function signInWithSso() {
        const email = form.getValues('email');
        const domain = email.includes('@') ? email.split('@')[1] : '';
        if (!domain) { toast.error(t('auth.sso_email_required', 'Önce kurumsal e-posta adresinizi girin.')); return; }
        try {
            const providers = await authService.getOidcProviders(domain);
            if (providers.length === 0) { toast.error(t('auth.sso_not_configured', 'Bu alan adı için SSO yapılandırılmamış.')); return; }
            window.location.assign(`${import.meta.env.VITE_API_URL || '/api/v1'}/auth/oidc/${providers[0].id}/start`);
        } catch { toast.error(t('auth.sso_error', 'SSO başlatılamadı.')); }
    }

    async function requestPasswordReset() {
        const email = form.getValues('email');
        if (!email || !email.includes('@')) { toast.error(t('auth.reset_email_required', 'Önce e-posta adresinizi girin.')); return; }
        try {
            await authService.requestPasswordReset(email);
            toast.success(t('auth.reset_sent', 'Hesap mevcutsa sıfırlama bağlantısı gönderildi.'));
        } catch { toast.error(t('auth.reset_error', 'Sıfırlama isteği gönderilemedi.')); }
    }

    return (
        <div className="flex min-h-screen overflow-hidden bg-background text-foreground">
            
            {/* Left: Branding / Hero */}
            <div className="hidden border-r border-slate-800 bg-slate-950 lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center">
                <div className="max-w-md px-8 text-center">
                    {/* Logo */}
                    <BrandLogo
                        className="mb-8 justify-center"
                        markClassName="h-14 w-14 rounded-xl bg-primary"
                        textClassName="text-4xl text-white font-bold"
                    />

                    <p className="mb-3 text-xs font-semibold tracking-wide text-blue-300">
                        {t('auth.brand_slogan')}
                    </p>

                    <h1 className="mb-3 text-3xl font-bold text-white tracking-tight">
                        {t('auth.hero_title')}
                    </h1>
                    <p className="mb-10 text-sm leading-relaxed text-slate-400">
                        {t('auth.hero_description')}
                    </p>

                    {/* Feature highlights */}
                    <div className="space-y-4 text-left">
                        {[
                            {
                                icon: Shield,
                                label: t('auth.features.quality_assurance.label'),
                                desc: t('auth.features.quality_assurance.desc')
                            },
                            {
                                icon: Zap,
                                label: t('auth.features.agile_management.label'),
                                desc: t('auth.features.agile_management.desc')
                            },
                            {
                                icon: BarChart3,
                                label: t('auth.features.insights_analytics.label'),
                                desc: t('auth.features.insights_analytics.desc')
                            },
                        ].map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-slate-700">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-400/10 text-blue-300">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-200">{label}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: Login Form */}
            <div className="flex flex-1 items-center justify-center bg-muted/20 p-6">
                <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-panel">

                    {/* Mobile Logo */}
                    <BrandLogo
                        className="mb-8 justify-center lg:hidden"
                        markClassName="h-12 w-12 rounded-xl bg-primary"
                        textClassName="text-3xl font-bold text-foreground"
                    />

                    <div className="mb-8 space-y-2 text-center">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                            {t('auth.sign_in')}
                        </h2>
                        <p className="text-sm text-slate-400">
                            {t('auth.login_description')}
                        </p>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel>{t('common.email')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                data-testid="login-email-input"
                                                placeholder={t('auth.email_placeholder')}
                                                className="h-11"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <FormLabel>{t('common.password')}</FormLabel>
                                            <button
                                                type="button"
                                                className="text-xs font-semibold text-primary hover:text-primary transition-colors"
                                                onClick={requestPasswordReset}
                                            >
                                                {t('auth.forgot_password')}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <FormControl>
                                                <Input
                                                    data-testid="login-password-input"
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder={t('auth.password_placeholder')}
                                                    className="h-11 pr-10"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:bg-transparent hover:text-foreground"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                    <span className="sr-only">
                                                        {showPassword ? t('auth.hide_password') : t('auth.show_password')}
                                                    </span>
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="mfaCode"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel>{t('auth.mfa_code', 'Doğrulama kodu')} <GlossaryTerm term="MFA">MFA</GlossaryTerm></FormLabel>
                                        <FormControl>
                                            <Input data-testid="login-mfa-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" className="h-11 font-mono tracking-[0.35em]" {...field} />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground">{t('auth.mfa_optional', 'Hesabınızda MFA etkinse 6 haneli kodu girin.')}</p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="organizationSlug"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel>{t('auth.organization', 'Kurum')}</FormLabel>
                                        <FormControl><Input data-testid="login-org-input" autoComplete="organization" placeholder={t('auth.organization_placeholder', 'Kurum kodu (opsiyonel)')} className="h-11" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button data-testid="login-submit-button" type="submit" className="mt-2 h-11 w-full" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('auth.sign_in')}
                            </Button>
                            <Button data-testid="login-sso-button" type="button" variant="outline" className="h-11 w-full" onClick={signInWithSso} disabled={isLoading} title="SSO: Kurumsal hesabınızla ayrı bir Nexa şifresi kullanmadan giriş yapmanızı sağlar.">
                                <Shield className="mr-2 h-4 w-4" />
                                {t('auth.sign_in_sso', 'Kurumsal SSO ile giriş')}
                            </Button>
                        </form>
                    </Form>

                    <p className="mt-8 text-center text-xs text-muted-foreground">
                        {t('auth.footer_copyright', { year: new Date().getFullYear() })}
                    </p>
                </div>
            </div>
        </div>
    )
}
import { logger } from "@/utils/logger";
