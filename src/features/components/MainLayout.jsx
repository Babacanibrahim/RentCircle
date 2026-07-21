import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

const MainLayout = ({ onLocationFilter }) => {
  return (
    <div className="flex flex-col min-h-screen bg-[#1e293b] text-[#f8fafc] selection:bg-blue-500/30 font-sans overflow-x-hidden">
      <Navbar onLocationFilter={onLocationFilter} />

      <main className="flex-1 w-full flex flex-col relative">
        <Outlet />
      </main>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;
