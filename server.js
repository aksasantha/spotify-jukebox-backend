const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Spotify credentials (replace with your actual values)
const clientId = '09d68439501f4ff087b13e24a12f770f';
const clientSecret = '4f9004be892e4740a9eca9b93636008c';

let spotifyToken = '';

// Function to fetch a new Spotify access token
async function getSpotifyToken() {
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', null, {
      params: { grant_type: 'client_credentials' },
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    spotifyToken = response.data.access_token;
    console.log('✅ Spotify Token Refreshed:', spotifyToken);
  } catch (error) {
    console.error('❌ Error fetching Spotify token:', error.response?.data || error.message);
  }
}

// Refresh the token every hour
getSpotifyToken();
setInterval(getSpotifyToken, 3600 * 1000);

// In-memory song queue (For production, use a database)
const songQueue = [];

// 🎵 **Home Route (API Status)**
app.get('/', (req, res) => {
  res.send({
    message: "✅ Backend is running!",
    available_routes: ["/api/spotify/search", "/api/queue", "/api/play"]
  });
});

// 🎵 **Search for a song on Spotify**
app.get('/api/spotify/search', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ message: 'Search query is required' });

  try {
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: { q: query, type: 'track', limit: 5 },
      headers: { 'Authorization': `Bearer ${spotifyToken}` },
    });

    res.json(response.data.tracks.items);
  } catch (error) {
    console.error('❌ Error fetching search results:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error fetching search results from Spotify' });
  }
});

// 🎵 **Add a song to the queue**
app.post('/api/queue', (req, res) => {
  const { song } = req.body;
  if (!song || !song.external_urls || !song.external_urls.spotify || !song.uri) {
    return res.status(400).json({ message: 'Song data with a valid Spotify URL and URI is required' });
  }

  const newSong = {
    name: song.name,
    artist: song.artists.map(artist => artist.name).join(', '),
    url: song.external_urls.spotify,
    uri: song.uri,  // Needed for Web Playback SDK
  };

  songQueue.push(newSong);
  console.log('🎵 Song added to queue:', newSong);
  res.status(201).json(newSong);
});

// 🎵 **Get the current song queue**
app.get('/api/queue', (req, res) => {
  res.json(songQueue);
});

// 🎵 **Control Spotify Web Playback**
app.put('/api/play', async (req, res) => {
  const { device_id, uri } = req.body;
  if (!device_id || !uri) {
    return res.status(400).json({ message: 'Device ID and track URI are required' });
  }

  try {
    await axios.put(
      `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`,
      { uris: [uri] },
      {
        headers: {
          'Authorization': `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`▶️ Playing track: ${uri}`);
    res.status(200).json({ message: 'Playback started' });
  } catch (error) {
    console.error('❌ Error playing track:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error playing track' });
  }
});

// 🎵 **Start the server**
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
