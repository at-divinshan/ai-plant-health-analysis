import { Loader2, Sprout } from "lucide-react";

export default function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="spinner-box" role="status" aria-live="polite">
      <span className="plant-loader"><Loader2 className="spin" size={52} /><Sprout className="loader-sprout" size={23} /></span>
      <p>{message}</p>
    </div>
  );
}
