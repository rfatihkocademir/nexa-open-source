import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [pending, setPending] = useState(false);
    const token = params.get('token') || '';
    const submit = async () => {
        if (password.length < 12) { toast.error('Parola en az 12 karakter olmalıdır.'); return; }
        setPending(true);
        try { await authService.resetPassword(token, password); toast.success('Parolanız güncellendi.'); navigate('/login', { replace: true }); }
        catch { toast.error('Bağlantı geçersiz veya süresi dolmuş.'); }
        finally { setPending(false); }
    };
    return <div className="flex min-h-screen items-center justify-center bg-background p-6"><div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-8 shadow-sm"><h1 className="text-2xl font-semibold">Yeni parola belirleyin</h1><p className="text-sm text-muted-foreground">En az 12 karakterden oluşan yeni parolanızı girin.</p><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><Button className="w-full" disabled={pending || !token} onClick={submit}>Parolayı güncelle</Button></div></div>;
}
