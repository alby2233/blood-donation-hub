const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Cache-Control middleware to prevent caching index.html
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Session token management and admin credentials
const crypto = require('crypto');
const sessions = new Set();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'kcym';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kcym098';

// Auth middleware to secure private endpoints
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.substring(7);
  if (!sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid session' });
  }
  next();
}

// Helper to validate donor input
function validateDonorInput(req, res, next) {
  const { name, phone, bloodGroup, unitNo, houseName } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required and must be a valid string' });
  }
  
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  if (!houseName || typeof houseName !== 'string' || houseName.trim().length === 0) {
    return res.status(400).json({ error: 'House name is required and must be a valid string' });
  }

  const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const formattedBloodGroup = bloodGroup ? bloodGroup.toUpperCase().trim() : '';
  
  if (!formattedBloodGroup || !validBloodGroups.includes(formattedBloodGroup)) {
    return res.status(400).json({ error: `Blood group must be one of: ${validBloodGroups.join(', ')}` });
  }
  
  const unitNum = parseInt(unitNo, 10);
  if (isNaN(unitNum) || unitNum < 1 || unitNum > 22) {
    return res.status(400).json({ error: 'Ward / Unit number must be a valid number between 1 and 22' });
  }

  // Clean inputs for route handler
  req.cleanedBody = {
    name: name.trim(),
    phone: phone.trim(),
    bloodGroup: formattedBloodGroup,
    unitNo: unitNo ? String(unitNo).trim() : '',
    houseName: houseName.trim()
  };
  
  next();
}

// REST API Endpoints

// Admin Authentication Endpoints
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(16).toString('hex');
    sessions.add(token);
    return res.json({ success: true, token });
  }
  res.status(401).json({ error: 'Invalid username or password' });
});

app.post('/api/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    sessions.delete(token);
  }
  res.json({ success: true });
});





// Get all donors
app.get('/api/donors', requireAuth, async (req, res) => {
  try {
    const donors = await db.getDonors();
    res.json(donors);
  } catch (error) {
    console.error('Error fetching donors:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add a donor
app.post('/api/donors', validateDonorInput, async (req, res) => {
  try {
    const newDonor = await db.addDonor(req.cleanedBody);
    res.status(201).json(newDonor);
  } catch (error) {
    console.error('Error adding donor:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update a donor
app.put('/api/donors/:id', requireAuth, validateDonorInput, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.updateDonor(id, req.cleanedBody);
    res.json(updated);
  } catch (error) {
    console.error('Error updating donor:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete a donor
app.delete('/api/donors/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.deleteDonor(id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting donor:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Mark donor as donated
app.post('/api/donors/:id/donate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.markDonated(id);
    res.json(updated);
  } catch (error) {
    console.error('Error marking donor as donated:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).send('Not Found');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to Database first, then Start Server
db.connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Blood Donation Registry Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server due to database connection error.');
    process.exit(1);
  });
