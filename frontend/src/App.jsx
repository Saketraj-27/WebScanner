import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";

function AppContent() {
  const { user, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return (
      <div>
        <h1 className="title">Website Security Scanner</h1>
        {isLogin ? (
          <Login onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <Register onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="title">Website Security Scanner</h1>
      <Dashboard />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
