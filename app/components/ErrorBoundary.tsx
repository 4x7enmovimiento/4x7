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
      localStorage.removeItem("four_seven_saved_profile");
      localStorage.removeItem("4x7_weight_history");
      localStorage.removeItem("4x7_body_measurements");
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
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
            background: "#f0fdf4",
            color: "#14532d",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "32px 24px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
              border: "1px solid #bbf7d0",
            }}
          >
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>🌿</div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px", color: "#166534" }}>
              4×7 En Movimiento
            </h2>
            <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.5, margin: "0 0 20px" }}>
              Tuvimos un breve parpadeo al cargar tu tablero. Presiona el botón para entrar directo a tu espacio.
            </p>
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
              🔄 Recargar y Continuar
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
