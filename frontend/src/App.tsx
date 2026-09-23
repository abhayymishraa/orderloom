import { BrowserRouter, Route, Routes } from "react-router-dom";
import Signin from "./pages/Singin";
import Signup from "./pages/Signup";
import Trading from "./pages/Trading";
import OrderloomLanding from "./pages/Homepage";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrderloomLanding />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/trading" element={<Trading />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
