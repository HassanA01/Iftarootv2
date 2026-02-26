import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";

// Pages (to be implemented)
const HomePage = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-center text-white">
      <h1 className="text-5xl font-bold mb-4">Iftaroot</h1>
      <p className="text-gray-400 text-xl">Real-time quiz game platform</p>
    </div>
  </div>
);

const NotFound = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-center text-white">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-gray-400 mt-2">Page not found</p>
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
