import { Route, Routes } from "react-router-dom";
import AppShell from "./app/AppShell";
import HallDesignerPage from "./features/hall-designer/components/HallDesignerPage";
import CurtainSplash from "./features/splash/CurtainSplash";
import EventPage from "./pages/EventPage";
import GuestsPage from "./pages/GuestsPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <>
      <CurtainSplash />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/event" element={<EventPage />} />
          <Route path="/guests" element={<GuestsPage />} />
          <Route path="/designer" element={<HallDesignerPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}