import React from "react";
import { Navigate } from "react-router-dom";

const PublicRoute = ({ children }) => {
  // 🎯 KRİTİK DEĞİŞİKLİK: İki depolama alanına da bakıyoruz
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

  if (token) {
    // Kullanıcı zaten giriş yapmışsa direkt dashboard'a yönlendir
    return <Navigate to="/dashboard" replace />;
  }

  // Giriş yapmamışsa sayfayı normal şekilde göster
  return children;
};

export default PublicRoute;
