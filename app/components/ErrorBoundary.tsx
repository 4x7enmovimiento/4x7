"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
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
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#f8fafc",
            color: "#0f172a",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              padding: "32px 24px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🌿</div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px", color: "#166534" }}>
              4×7 En Movimiento
            </h2>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px" }}>
              Hubo una actualización en el sistema. Presiona el botón para entrar con tu cuenta limpia.
            </p>

            {this.state.error && (
              <div style={{ textAlign: "left", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px", marginBottom: "16px", fontSize: "11px", color: "#b91c1c", wordBreak: "break-word" }}>
                <b>Detalle:</b> {this.state.error.message}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              style={{
                width: "100%",
                padding: "14px 20px",
                background: "#166534",
                color: "#ffffff",
                border: "none",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(22, 101, 52, 0.25)",
              }}
            >
              🔄 Limpiar y Entrar Limpio
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
