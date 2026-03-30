import { BrowserRouter, Routes, Route } from "react-router-dom";
import QRCodeGenerator from "./pages/QRCodeGenerator";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<QRCodeGenerator />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
