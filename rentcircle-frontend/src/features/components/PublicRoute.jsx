import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  const location = useLocation();

  if (token) {
    // 🎯 DÜZELTME: Eğer kullanıcı Login'e gitmeye çalışıyorsa geldiği yere geri yolla,
    // yoksa standart olarak dashboard'a at.
    const from = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={from} replace />;
  }

  return children;
};

export default PublicRoute;
