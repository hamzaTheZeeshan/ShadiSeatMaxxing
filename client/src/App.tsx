import HallCanvas from "./features/hall-designer/components/canvas/HallCanvas";

export default function App() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Shadi Maxing</header>
      <HallCanvas />
    </div>
  );
}