import { useState } from "react";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import SecuritySetup from "./pages/SecuritySetup";

function App() {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const handleSetUser = (userData) => {
    console.log("User data received:", userData);
    if (userData.needs_security_setup === true) {
      setNeedsSetup(true);
    }
    setUser(userData);
  };

  console.log("needsSetup:", needsSetup, "user:", user?.name);

  if (!user) return <Login setUser={handleSetUser} />;
  if (needsSetup && user) return <SecuritySetup user={user} onComplete={() => setNeedsSetup(false)} />;
  if (user.role === "student") return <StudentDashboard user={user} setUser={setUser} />;
  if (user.role === "faculty") return <FacultyDashboard user={user} setUser={setUser} />;
}

export default App;