import backgroundUrl from '../assets/background.png';
import logoUrl from '../assets/Logo.png';

interface LoadingScreenProps {
  progress: number;
  isReady: boolean;
  errorMessage: string | null;
  onStart: () => void;
  onRetry: () => void;
}

export function LoadingScreen({ progress, isReady, errorMessage, onStart, onRetry }: LoadingScreenProps) {
  const progressPercent = Math.max(0, Math.min(progress, 1)) * 100;

  return (
    <div
      className="loading-screen"
      style={{ backgroundImage: `linear-gradient(rgba(14, 10, 4, 0.42), rgba(14, 10, 4, 0.58)), url(${backgroundUrl})` }}
    >
      <div className="loading-screen__panel">
        <img className="loading-screen__logo" src={logoUrl} alt="" />
        <div className="loading-screen__action">
          {errorMessage ? (
            <button className="loading-screen__start" type="button" onClick={onRetry}>
              Retry
            </button>
          ) : isReady ? (
            <button className="loading-screen__start" type="button" onClick={onStart}>
              Start
            </button>
          ) : (
            <div className="loading-screen__bar" aria-hidden="true">
              <div className="loading-screen__fill" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
