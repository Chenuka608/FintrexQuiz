// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ✅ Fix CORS: allow both local dev + deployed frontend
app.use(cors({
  origin: [
    "http://localhost:5173",          // dev
    "https://fintrexquiz.vercel.app"  // deployed frontend
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Explicit preflight handling
app.options("*", cors());

app.use(express.json());

// ---- MongoDB ----
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error:", err));

// ---- Schema / Model ----
const playerSchema = new mongoose.Schema(
  {
    nic: { type: String, unique: true, required: true, index: true },
    name: { type: String, default: "" },
    mobile: { type: String, unique: true, required: true, index: true },
    score: { type: Number, default: 0 },
    status: { type: String, enum: ["WON", "LOST"], default: "LOST" },
    played: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Player = mongoose.model("Player", playerSchema);

// ---- Validators ----
const isValidNIC = (nic) => /^([0-9]{9}[vVxX]|[0-9]{12})$/.test(nic);
const isValidMobile = (mobile) => /^07[0-9]{8}$/.test(mobile);

// ---- Routes ----

// Health check (for uptime ping)
app.get("/health", (req, res) => {
  res.send("✅ OK - Fintrex Quiz backend is alive");
});

// Auth: login/register-on-first-use
app.post("/api/auth/authenticate", async (req, res) => {
  try {
    const { nic, name = "", mobile } = req.body;

    if (!isValidNIC(nic)) return res.status(400).json({ message: "Invalid NIC format" });
    if (!isValidMobile(mobile)) return res.status(400).json({ message: "Invalid Mobile Number" });

    let player = await Player.findOne({ $or: [{ nic }, { mobile }] });

    if (player) {
      if (player.nic !== nic || player.mobile !== mobile) {
        return res.status(409).json({ message: "NIC or Mobile already registered to a different user" });
      }
      if (player.played) {
        return res.status(403).json({ message: "Already played!" });
      }
      if (name && name.trim() && name.trim() !== player.name) {
        player.name = name.trim();
        await player.save();
      }
    } else {
      player = new Player({ nic, name: name.trim(), mobile, played: false });
      await player.save();
    }

    res.json({ user: player });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "NIC or Mobile already in use" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Save result (idempotent)
app.post("/api/result", async (req, res) => {
  try {
    const { nic, score } = req.body;

    if (!isValidNIC(nic)) return res.status(400).json({ message: "Invalid NIC format" });
    if (typeof score !== "number" || score < 0 || score > 10) {
      return res.status(400).json({ message: "Invalid score" });
    }

    const status = score === 10 ? "WON" : "LOST";
    const player = await Player.findOne({ nic });

    if (!player) return res.status(404).json({ message: "Player not found" });
    if (player.played) return res.status(403).json({ message: "Result already recorded" });

    player.score = score;
    player.status = status;
    player.played = true;
    await player.save();

    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Winners / Losers
app.get("/api/winners", async (_req, res) => {
  const winners = await Player.find({ status: "WON" }).sort({ updatedAt: -1 });
  res.json(winners);
});

app.get("/api/losers", async (_req, res) => {
  const losers = await Player.find({ status: "LOST" }).sort({ updatedAt: -1 });
  res.json(losers);
});

// ---- Start ----
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
