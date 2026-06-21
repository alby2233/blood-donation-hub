const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/blood_donation_hub';

// Define Mongoose Schema
const donorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  bloodGroup: { type: String, required: true, uppercase: true, trim: true },
  lastDonated: { type: Date, default: null }
}, {
  timestamps: true
});

const Donor = mongoose.model('Donor', donorSchema);

// Helper to format Mongoose document keys to match frontend expectation (converting _id to id string)
function formatDonor(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone,
    bloodGroup: doc.bloodGroup,
    lastDonated: doc.lastDonated ? doc.lastDonated.toISOString() : null
  };
}

// Database Connection Lifecycle Handler
async function connectDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connection established successfully.');
  } catch (error) {
    console.error('CRITICAL: Failed to connect to MongoDB.');
    console.error(error.message);
    console.error('\n--- SETUP GUIDE ---');
    console.error('To run the server, please set the MONGODB_URI environment variable.');
    console.error('Example (Windows Powershell):');
    console.error('  $env:MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/database"');
    console.error('-------------------\n');
    throw error;
  }
}

// REST CRUD Operations

// Get all donors
async function getDonors() {
  const docs = await Donor.find({}).lean();
  return docs.map(formatDonor);
}

// Add a donor
async function addDonor({ name, phone, bloodGroup }) {
  const donor = new Donor({ name, phone, bloodGroup });
  await donor.save();
  return formatDonor(donor);
}

// Update a donor
async function updateDonor(id, { name, phone, bloodGroup }) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Donor with ID ${id} not found`);
  }
  const donor = await Donor.findByIdAndUpdate(
    id, 
    { name, phone, bloodGroup }, 
    { new: true, runValidators: true }
  );
  if (!donor) {
    throw new Error(`Donor with ID ${id} not found`);
  }
  return formatDonor(donor);
}

// Delete a donor
async function deleteDonor(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Donor with ID ${id} not found`);
  }
  const donor = await Donor.findByIdAndDelete(id);
  if (!donor) {
    throw new Error(`Donor with ID ${id} not found`);
  }
  return { success: true };
}

// Mark donor as donated (starts 6 month cooldown)
async function markDonated(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Donor with ID ${id} not found`);
  }
  const donor = await Donor.findByIdAndUpdate(
    id, 
    { lastDonated: new Date() }, 
    { new: true }
  );
  if (!donor) {
    throw new Error(`Donor with ID ${id} not found`);
  }
  return formatDonor(donor);
}

module.exports = {
  connectDB,
  getDonors,
  addDonor,
  updateDonor,
  deleteDonor,
  markDonated
};
