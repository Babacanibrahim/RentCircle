import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  const location = useLocation(); // Hangi sayfaya girmeye çalışıyor?

  if (!token) {
    // 🎯 DÜZELTME: Kullanıcıyı login'e atarken, "state" içinde asıl gitmek istediği adresi taşı!
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default PrivateRoute;
