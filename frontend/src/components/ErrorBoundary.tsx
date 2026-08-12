import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withTranslation, type WithTranslation } from "react-i18next";
import { logger } from "@/utils/logger";
import { useLocation } from "react-router-dom";

interface Props extends WithTranslation {
  children: ReactNode;
  resetKey: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryBase extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("Uncaught error:", error, errorInfo);
  }

  public componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  public render() {
    if (this.state.hasError) {
      const { t } = this.props;

      return (
        <div className="flex min-h-[450px] w-full flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-slate-950/80 backdrop-blur-xl p-8 text-center shadow-2xl space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-inner">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-heading">
            {t('error_boundary.title', 'Bir Hata Oluştu')}
          </h2>
          <p className="max-w-md text-xs text-slate-400 leading-relaxed">
            {t('error_boundary.description', 'Bileşen yüklenirken beklenmeyen bir durum meydana geldi. Sistem günlüğüne kaydedildi.')}
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2 bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
              {t('error_boundary.refresh', 'Sayfayı Yenile')}
            </Button>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25"
            >
              {t('error_boundary.retry', 'Yeniden Deneye Geç')}
            </Button>
          </div>
          {import.meta.env.DEV && (
            <details className="mt-4 max-w-xl w-full text-left text-[11px]">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-400 font-mono text-[10px] text-center">
                Teknik Hata Detayı (Geliştirici Modu)
              </summary>
              <pre className="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-rose-400 overflow-x-auto whitespace-pre-wrap">
                {this.state.error?.toString()}
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const TranslatedErrorBoundary = withTranslation()(ErrorBoundaryBase);

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <TranslatedErrorBoundary resetKey={`${location.pathname}${location.search}`} children={children} />;
}
