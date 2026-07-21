import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

const MainLayout = () => {
  // 🎯 ÇÖZÜM: Filtre verisi Layout seviyesinde tutulmalı!
  const [locationFilter, setLocationFilter] = useState({ city: "", district: "" });

  return (
    <div className="flex flex-col min-h-screen bg-[#1e293b] text-[#f8fafc] selection:bg-blue-500/30 font-sans overflow-x-hidden">
      {/* 1. Navbar'a state güncelleyiciyi veriyoruz */}
      <Navbar onLocationFilter={setLocationFilter} />

      <main className="flex-1 w-full flex flex-col relative">
        {/* 2. 🎯 KRİTİK: Alt sayfalara (Dashboard) bu veriyi Outlet Context ile aktarıyoruz */}
        <Outlet context={{ locationFilter }} />
      </main>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;
