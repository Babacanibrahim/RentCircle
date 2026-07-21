import React from "react";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children }) => {
  // 🎯 KRİTİK DEĞİŞİKLİK: İki depolama alanına da bakıyoruz
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

  // Eğer token hiçbirinde yoksa (giriş yapılmamışsa) kullanıcıyı login sayfasına postala
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Token varsa sayfaya giriş izni ver
  return children;
};

export default PrivateRoute;
