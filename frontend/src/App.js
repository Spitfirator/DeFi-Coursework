import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import MyCards from './pages/MyCards';
import CardDetail from './pages/CardDetail';
import CreateAuction from './pages/CreateAuction';
import DayCare from './pages/DayCare';
import Evolution from './pages/Evolution';
import Hatchery from './pages/Hatchery';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-dark to-darker">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/my-cards" element={<MyCards />} />
            <Route path="/card/:tokenId" element={<CardDetail />} />
            <Route path="/create-auction/:tokenId" element={<CreateAuction />} />
            <Route path="/day-care" element={<DayCare />} />
            <Route path="/evolution" element={<Evolution />} />
            <Route path="/hatchery" element={<Hatchery />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
