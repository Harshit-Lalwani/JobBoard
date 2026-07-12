import { Routes, Route } from "react-router-dom";

function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Job Board</h1>
        <p className="mt-2 text-gray-500">
          Frontend shell — auth, browse, and dashboard pages land in later phases.
        </p>
      </div>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}

export default App;
