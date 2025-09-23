import { useState } from "react";

export default function Auth({ onSuccess }) {
  const [nic, setNic] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");

  const isValidNIC = (nic) => /^([0-9]{9}[vVxX]|[0-9]{12})$/.test(nic);
  const isValidMobile = (mobile) => /^07[0-9]{8}$/.test(mobile);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const nicTrim = nic.trim();
    const nameTrim = name.trim();
    const mobileTrim = mobile.trim();

    if (!isValidNIC(nicTrim)) {
      setError("⚠️ Please enter a valid Sri Lankan NIC!");
      return;
    }
    if (!isValidMobile(mobileTrim)) {
      setError("⚠️ Please enter a valid Sri Lankan Mobile number!");
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/api/auth/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nic: nicTrim, name: nameTrim, mobile: mobileTrim }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "❌ Something went wrong");
        return;
      }

      // Save player (acts like a token for session)
      localStorage.setItem("fintrex_player", JSON.stringify(data.user));
      onSuccess(data.user);
    } catch (err) {
      console.error(err);
      setError("🚨 Server not reachable.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="flex flex-col md:flex-row bg-gray-800 rounded-3xl shadow-2xl overflow-hidden max-w-5xl w-full">
        <div className="w-full md:w-1/2 bg-gray-800 flex items-center justify-center">
          <img
            src="/assets/menu.jpg"
            alt="Menu"
            className="w-full h-auto max-h-[500px] object-contain p-4 rounded-t-3xl md:rounded-t-none md:rounded-l-3xl"
          />
        </div>

        <div className="w-full md:w-1/2 flex justify-center items-center p-8">
          <form className="w-full max-w-md flex flex-col gap-5" onSubmit={handleSubmit}>
            <h2 className="text-3xl font-bold text-center text-white mb-4">
              Enter Your Details
            </h2>

            <label className="text-gray-200 font-semibold">NIC</label>
            <input
              type="text"
              placeholder="Enter NIC"
              value={nic}
              onChange={(e) => setNic(e.target.value)}
              className="p-3 mb-3 rounded-lg border border-gray-600 bg-gray-700 placeholder-gray-400 text-white"
            />

            <label className="text-gray-200 font-semibold">Name</label>
            <input
              type="text"
              placeholder="Enter Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-3 mb-3 rounded-lg border border-gray-600 bg-gray-700 placeholder-gray-400 text-white"
            />

            <label className="text-gray-200 font-semibold">Mobile Number</label>
            <input
              type="tel"
              placeholder="07XXXXXXXX"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="p-3 mb-3 rounded-lg border border-gray-600 bg-gray-700 placeholder-gray-400 text-white"
            />

            {error && <p className="text-red-500 font-semibold text-center">{error}</p>}

            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition">
              Start Game
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
