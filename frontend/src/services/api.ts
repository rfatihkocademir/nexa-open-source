import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { createLogger } from '@/utils/logger';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const logger = createLogger('API');

function getApiErrorMessage(status?: number) {
    if (status === 400) return i18n.t('api_errors.bad_request', 'Gönderilen bilgiler geçersiz.');
    if (status === 404) return i18n.t('api_errors.not_found', 'İstenen kayıt bulunamadı.');
    if (status === 409) return i18n.t('api_errors.conflict', 'Bu işlem mevcut verilerle çakışıyor.');
    if (status && status >= 500) return i18n.t('api_errors.server_error', 'Sunucu Hatası');
    return i18n.t('api_errors.generic', 'İşlem tamamlanamadı.');
}

logger.info('Configured URL:', API_URL);

export const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    // Read the token directly from the Zustand store
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
    (response) => {
        // Return response data directly, or response if data is undefined
        return response && response.data !== undefined ? response.data : response;
    },
    async (error) => {
        const original = error.config as typeof error.config & { _retry?: boolean };
        const isAuthRequest = String(original?.url || '').includes('/auth/');
        if (error.response?.status === 401 && !original?._retry && !isAuthRequest) {
            original._retry = true;
            try {
                refreshPromise ||= axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
                    .then((response) => response.data?.data?.token || response.data?.token)
                    .finally(() => { refreshPromise = null; });
                const token = await refreshPromise;
                if (token) {
                    useAuthStore.getState().setToken(token);
                    original.headers.Authorization = `Bearer ${token}`;
                    return api.request(original);
                }
            } catch {
                logger.info('Refresh session rejected, clearing authentication');
                useAuthStore.getState().logout();
            }
        } else if (error.response?.status === 401) {
            useAuthStore.getState().logout();
        } else {
            // Global error handling for other statuses
            const status = error.response?.status;

            if (status && status >= 500) {
                toast.error(getApiErrorMessage(status));
            } else if (status === 403) {
                toast.error(i18n.t('api_errors.permission_denied', 'Yetkisiz Erişim'), { description: i18n.t('api_errors.permission_description', 'Bu işlemi gerçekleştirmek için yetkiniz bulunmamaktadır.') });
            } else if (status && [400, 404, 409].includes(status)) {
                toast.error(getApiErrorMessage(status));
            }
        }
        return Promise.reject(error);
    }
);
