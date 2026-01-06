import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Validate token by making a request to get profile
      fetch(
        `${
          import.meta.env.VITE_API_URL || "http://localhost:5000/api"
        }/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
        .then((res) => {
          if (res.ok) {
            return res.json();
          } else {
            throw new Error("Token invalid");
          }
        })
        .then((data) => {
          if (data.user) {
            setUser(data.user);
          } else {
            logout();
          }
        })
        .catch(() => {
          // Token is invalid, clear it
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const response = await fetch(
      `${
        import.meta.env.VITE_API_URL || "http://localhost:5000/api"
      }/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const register = async (name, email, password) => {
    const response = await fetch(
      `${
        import.meta.env.VITE_API_URL || "http://localhost:5000/api"
      }/auth/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
