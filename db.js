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

// Initial Mock Donors to seed when database is empty
const seedDonors = [
  {
    name: "John Doe",
    phone: "555-0199",
    bloodGroup: "O+",
    lastDonated: null
  },
  {
    name: "Sarah Jenkins",
    phone: "555-0123",
    bloodGroup: "A-",
    lastDonated: new Date("2026-05-15T12:00:00.000Z")
  },
  {
    name: "Michael Chang",
    phone: "555-0145",
    bloodGroup: "B+",
    lastDonated: new Date("2025-11-20T10:00:00.000Z")
  },
  {
    name: "Emily Rodriguez",
    phone: "555-0177",
    bloodGroup: "AB+",
    lastDonated: null
  },
  {
    name: "David Kim",
    phone: "555-0188",
    bloodGroup: "O-",
    lastDonated: new Date("2026-06-10T14:30:00.000Z")
  },
  {
    name: "Lisa Watson",
    phone: "555-0155",
    bloodGroup: "A+",
    lastDonated: new Date("2026-02-18T09:00:00.000Z")
  }
];

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

    // Seed database if empty
    const count = await Donor.countDocuments();
    if (count === 0) {
      console.log('Registry is empty. Seeding initial donor profiles...');
      await Donor.insertMany(seedDonors);
      console.log('Database seeded successfully.');
    }
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
