const functions = require("firebase-functions");
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const clientId = '09d68439501f4ff087b13e24a12f770f';
const clientSecret = '4f9004be892e4740a9eca9b93636008c';

let spotifyToken = "";

// Function to get Spotify token
async function getSpotifyToken() {
  try {
    const response = await axios.post("https://accounts.spotify.com/api/token", null, {
      params: { grant_type: "client_credentials" },
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    spotifyToken = response.data.access_token;
    console.log("✅ Spotify Token Refreshed:", spotifyToken);
  } catch (error) {
    console.error("❌ Error fetching Spotify token:", error.response?.data || error.message);
  }
}

// Refresh token every hour
getSpotifyToken();
setInterval(getSpotifyToken, 3600 * 1000);

const songQueue = [];

// Home route
app.get("/", (req, res) => {
  res.send({ message: "✅ Backend is running on Firebase Functions!", available_routes: ["/api/spotify/search", "/api/queue", "/api/play"] });
});

// Spotify Search API
app.get("/api/spotify/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ message: "Search query is required" });

  try {
    const response = await axios.get("https://api.spotify.com/v1/search", {
      params: { q: query, type: "track", limit: 5 },
      headers: { Authorization: `Bearer ${spotifyToken}` },
    });

    res.json(response.data.tracks.items);
  } catch (error) {
    console.error("❌ Error fetching search results:", error.response?.data || error.message);
    res.status(500).json({ message: "Error fetching search results from Spotify" });
  }
});

// Add a song to the queue
app.post("/api/queue", (req, res) => {
  const { song } = req.body;
  if (!song || !song.external_urls || !song.external_urls.spotify || !song.uri) {
    return res.status(400).json({ message: "Song data with a valid Spotify URL and URI is required" });
  }

  const newSong = {
    name: song.name,
    artist: song.artists.map(artist => artist.name).join(", "),
    url: song.external_urls.spotify,
    uri: song.uri,
  };

  songQueue.push(newSong);
  console.log("🎵 Song added to queue:", newSong);
  res.status(201).json(newSong);
});

// Get queue
app.get("/api/queue", (req, res) => {
  res.json(songQueue);
});

// Deploy the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
