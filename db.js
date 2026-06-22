const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/blood_donation_hub';

let isMock = false;
let mockDonors = [];

// Define Mongoose Schema with the new unitNo field
const donorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  bloodGroup: { type: String, required: true, uppercase: true, trim: true },
  unitNo: { type: String, default: '' }, // New field representing donated unit numbers
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
    unitNo: doc.unitNo || '',
    lastDonated: doc.lastDonated ? doc.lastDonated.toISOString() : null
  };
}

// Database Connection Lifecycle Handler
async function connectDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    console.log('MongoDB connection established successfully.');
  } catch (error) {
    console.warn('WARNING: Failed to connect to MongoDB. Falling back to in-memory database for local testing.');
    isMock = true;
    mockDonors = [
      { id: 'mock-1', name: 'Alby George', phone: '9876543210', bloodGroup: 'O+', unitNo: 'Unit 4', lastDonated: null },
      { id: 'mock-2', name: 'John Miller', phone: '9988776655', bloodGroup: 'A+', unitNo: 'Ward 2', lastDonated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString() },
      { id: 'mock-3', name: 'Sarah Connor', phone: '9123456789', bloodGroup: 'B-', unitNo: 'Unit 1', lastDonated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString() }
    ];
  }
}

// REST CRUD Operations

// Get all donors
async function getDonors() {
  if (isMock) {
    return mockDonors;
  }
  const docs = await Donor.find({}).lean();
  return docs.map(formatDonor);
}

// Add a donor
async function addDonor({ name, phone, bloodGroup, unitNo }) {
  if (isMock) {
    const newDonor = {
      id: 'mock-' + Math.random().toString(36).substr(2, 9),
      name,
      phone,
      bloodGroup: bloodGroup.toUpperCase(),
      unitNo: unitNo || '',
      lastDonated: null
    };
    mockDonors.push(newDonor);
    return newDonor;
  }
  const donor = new Donor({ name, phone, bloodGroup, unitNo });
  await donor.save();
  return formatDonor(donor);
}

// Update a donor
async function updateDonor(id, { name, phone, bloodGroup, unitNo }) {
  if (isMock) {
    const donor = mockDonors.find(d => d.id === id);
    if (!donor) {
      throw new Error(`Donor with ID ${id} not found`);
    }
    donor.name = name;
    donor.phone = phone;
    donor.bloodGroup = bloodGroup.toUpperCase();
    donor.unitNo = unitNo || '';
    return donor;
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Donor with ID ${id} not found`);
  }
  const donor = await Donor.findByIdAndUpdate(
    id, 
    { name, phone, bloodGroup, unitNo }, 
    { new: true, runValidators: true }
  );
  if (!donor) {
    throw new Error(`Donor with ID ${id} not found`);
  }
  return formatDonor(donor);
}

// Delete a donor
async function deleteDonor(id) {
  if (isMock) {
    const index = mockDonors.findIndex(d => d.id === id);
    if (index === -1) {
      throw new Error(`Donor with ID ${id} not found`);
    }
    mockDonors.splice(index, 1);
    return { success: true };
  }
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
  if (isMock) {
    const donor = mockDonors.find(d => d.id === id);
    if (!donor) {
      throw new Error(`Donor with ID ${id} not found`);
    }
    donor.lastDonated = new Date().toISOString();
    return donor;
  }
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
