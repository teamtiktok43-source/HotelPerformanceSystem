import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

import {
  apiFetch,
  getAuthUser,
  logout,
  saveAuth,
  User,
} from './api';

import Layout from './components/Layout';

import Login from './pages/Login';
import Home from './pages/Home';
import DailyBookings from './pages/DailyBookings';
import SmartDailyEntry from './pages/SmartDailyEntry';
import DailyRevenue from './pages/DailyRevenue';
import Reviews from './pages/Reviews';
import ReviewDetails from './pages/ReviewDetails';
import HotelRatings from './pages/HotelRatings';
import MonthlyReport from './pages/MonthlyReport';
import Hotels from './pages/Hotels';
import Employees from './pages/Employees';
import Data from './pages/Data';
import Platforms from './pages/Platforms';
import License from './pages/License';

export default function App() {
  const [user, setUser] = useState<User | null>(getAuthUser());
  const nav = useNavigate();

  useEffect(() => {
    const handleExpired = () => {
      if (user?.id !== 1) {
        logout();
        setUser(null);
        nav('/login');
      }
    };
    window.addEventListener('hps-license-expired', handleExpired);
    return () => window.removeEventListener('hps-license-expired', handleExpired);
  }, [user, nav]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const checkSession = async () => {
      try {
        await apiFetch<User>('/api/auth/me');
      } catch {
        if (!cancelled) {
          logout();
          setUser(null);
          nav('/login');
        }
      }
    };
    checkSession();
    const timer = window.setInterval(checkSession, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user, nav]);

  if (!user) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <Login
              onLogin={(u, t) => {
                saveAuth(u, t);
                setUser(u);
                nav('/');
              }}
            />
          }
        />
      </Routes>
    );
  }

  return (
    <Layout
      user={user}
      onLogout={() => {
        logout();
        setUser(null);
        nav('/login');
      }}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        {user.id === 1 && <Route path="/license" element={<License />} />}

        <Route path="/smart-entry" element={<SmartDailyEntry user={user} />} />

        <Route path="/bookings" element={<DailyBookings />} />

        <Route path="/revenue" element={<DailyRevenue />} />

        <Route
          path="/platforms"
          element={<Platforms user={user} />}
        />

        <Route
          path="/reviews"
          element={<Reviews user={user} />}
        />

        <Route
          path="/reviews/:id"
          element={<ReviewDetails user={user} />}
        />

        <Route
          path="/ratings"
          element={<HotelRatings />}
        />

        <Route
          path="/monthly"
          element={<MonthlyReport />}
        />

        <Route
          path="/hotels"
          element={<Hotels user={user} />}
        />

        <Route
          path="/employees"
          element={<Employees user={user} />}
        />

        <Route
          path="/data"
          element={<Data />}
        />

        <Route
          path="*"
          element={<Home />}
        />
      </Routes>
    </Layout>
  );
}