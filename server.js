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

// Helper to validate donor input
function validateDonorInput(req, res, next) {
  const { name, phone, bloodGroup, unitNo } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required and must be a valid string' });
  }
  
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const formattedBloodGroup = bloodGroup ? bloodGroup.toUpperCase().trim() : '';
  
  if (!formattedBloodGroup || !validBloodGroups.includes(formattedBloodGroup)) {
    return res.status(400).json({ error: `Blood group must be one of: ${validBloodGroups.join(', ')}` });
  }
  
  // Clean inputs for route handler
  req.cleanedBody = {
    name: name.trim(),
    phone: phone.trim(),
    bloodGroup: formattedBloodGroup,
    unitNo: unitNo ? String(unitNo).trim() : ''
  };
  
  next();
}

// REST API Endpoints

// Get all donors
app.get('/api/donors', async (req, res) => {
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
app.put('/api/donors/:id', validateDonorInput, async (req, res) => {
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
app.delete('/api/donors/:id', async (req, res) => {
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
app.post('/api/donors/:id/donate', async (req, res) => {
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
