import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';

export default function VerifyEmailPage() {
    const [params] = useSearchParams();
    const token = params.get('token');
    const [status, setStatus] = useState<'pending' | 'success' | 'error'>(token ? 'pending' : 'error');
    useEffect(() => {
        if (!token) return;
        authService.verifyEmail(token).then(() => setStatus('success')).catch(() => setStatus('error'));
    }, [token]);
    return <div className="flex min-h-screen items-center justify-center bg-background p-6"><div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-8 text-center shadow-sm">{status === 'pending' ? <LoadingSpinner size="lg" /> : <><h1 className="text-2xl font-semibold">{status === 'success' ? 'E-posta doğrulandı' : 'Doğrulama başarısız'}</h1><p className="text-sm text-muted-foreground">{status === 'success' ? 'Hesabınızla güvenli şekilde giriş yapabilirsiniz.' : 'Bağlantı geçersiz veya süresi dolmuş olabilir.'}</p><Button asChild><Link to="/login">Giriş ekranına dön</Link></Button></>}</div></div>;
}
