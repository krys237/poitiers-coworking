import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside component:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 max-w-xl mx-auto rounded-2xl bg-white border border-rose-200 shadow-sm space-y-3 text-center">
          <div className="size-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="text-base font-bold text-ocean-nuit">
            {this.props.fallbackTitle || "Une erreur temporaire est survenue"}
          </h2>
          <p className="text-xs text-muted-foreground font-mono bg-slate-50 p-2.5 rounded-lg text-left break-words">
            {this.state.error?.message || "Erreur inattendue"}
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Recharger la page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
