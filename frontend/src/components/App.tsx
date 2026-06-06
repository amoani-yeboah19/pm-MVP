"use client";

import { useState, useEffect } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginPage } from "@/components/LoginPage";
import * as api from "@/lib/api";

export const App = () => {
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    api.getMe().then((res) => setAuth(res.ok));
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setAuth(false);
  };

  if (auth === null) return null;
  if (!auth) return <LoginPage onLogin={() => setAuth(true)} />;
  return <KanbanBoard onLogout={handleLogout} />;
};
