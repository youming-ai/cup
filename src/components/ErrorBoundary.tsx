import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useT } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center h-dvh bg-night p-6 text-center gap-3">
      <div className="font-mono text-xs tracking-[0.3em] text-live">{t('common.signalLost')}</div>
      <h2 className="font-display font-bold text-2xl text-chalk tracking-wide">{t('common.error')}</h2>
      <p className="font-body text-sm text-chalkdim max-w-sm">
        {t('common.unexpectedError')}
      </p>
      <button
        onClick={onReset}
        className="mt-2 px-4 py-2 bg-pitch text-night font-display font-semibold tracking-wide rounded hover:brightness-110 transition"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}
