import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Auth ve Ortak Bileşenler
import Login from "./features/auth/views/Login";
import Register from "./features/auth/views/Register";
import PublicRoute from "./features/components/PublicRoute";
import PrivateRoute from "./features/components/PrivateRoute";
import MainLayout from "./features/components/MainLayout";

// Uygulama İçi Sayfalar
import ItemDashboard from "./features/items/views/ItemDashboard";
import ItemDetail from "./features/items/views/ItemDetail";
import StoreDetail from "./features/items/views/StoreDetail";
import Chat from "./features/items/views/Chat";
import Favorites from "./features/items/views/Favorites";
import CreateListing from "./features/items/views/CreateListing";
import BookingsDashboard from "./features/items/views/BookingsDashboard";
import RentalHistory from "./features/items/views/RentalHistory";
import Profile from "./features/auth/views/Profile";
import ForgotPassword from "./features/auth/views/ForgotPassword";
import MyListings from "./features/items/views/MyListings";

// 🎯 YENİ: Cüzdan Sayfası
import WalletDashboard from "./features/items/views/WalletDashboard";

function App() {
  const isAuthenticated = !!(localStorage.getItem("access_token") || sessionStorage.getItem("access_token"));
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />

        {/* --- LAYOUT DIŞINDA KALANLAR (NAVBAR VE FOOTER OLMAYACAK) --- */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />

        {/* --- LAYOUT İÇİNDE KALANLAR (NAVBAR VE FOOTER OTOMATİK EKLENECEK) --- */}
        <Route element={<MainLayout />}>
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <ItemDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />

          {/* 🎯 YENİ: Cüzdan Rotası */}
          <Route
            path="/wallet"
            element={
              <PrivateRoute>
                <WalletDashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/create-listing"
            element={
              <PrivateRoute>
                <CreateListing />
              </PrivateRoute>
            }
          />

          <Route
            path="/my-listings"
            element={
              <PrivateRoute>
                <MyListings />
              </PrivateRoute>
            }
          />

          <Route
            path="/bookings"
            element={
              <PrivateRoute>
                <BookingsDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/history"
            element={
              <PrivateRoute>
                <RentalHistory />
              </PrivateRoute>
            }
          />
          <Route
            path="/listings/:id"
            element={
              <PrivateRoute>
                <ItemDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/stores/:id"
            element={
              <PrivateRoute>
                <StoreDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <PrivateRoute>
                <Favorites />
              </PrivateRoute>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
