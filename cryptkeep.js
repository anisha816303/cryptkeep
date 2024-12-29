const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const validator = require('validator');
const nodemailer = require('nodemailer');
const app = express();
const PORT = 4000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection URI
const uri = 'mongodb+srv://anishaajit816:3JevU00J9Mr7XnrL@cryptkeepcluster.grvfy.mongodb.net/test?retryWrites=true&w=majority&appName=cryptkeepcluster';

// Connect to MongoDB using Mongoose
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Define User schema and model with email field
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  salt: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  descriptors: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);


// Define Vault schema and model
const vaultSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  encryptedVault: { type: String, required: true },
  salt: { type: String, required: true },
  iv: { type: String, required: true }
});

const Vault = mongoose.model('Vault', vaultSchema);

// const crypto = require('crypto');

// Secure key for encryption, generated once and used consistently
const generateKey = (username, salt) => {
  // Derive key from username and salt using PBKDF2
  return crypto.pbkdf2Sync(username, salt, 100000, 32, 'sha256');
};

// Function to encrypt data
const encryptData = (data, username, salt) => {
  const iv = crypto.randomBytes(16); // Random initialization vector
  const key = generateKey(username, salt); // Generate the encryption key using username and salt
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encryptedData = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);

  return {
    iv: iv.toString('hex'),
    encryptedVault: encryptedData.toString('hex'),
  };
};

// Function to decrypt data
const decryptData = (encryptedData, iv, username, salt) => {
  const key = generateKey(username, salt); // Regenerate the key using username and salt
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  const decryptedData = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'hex')), decipher.final()]);
  return JSON.parse(decryptedData.toString());
};

// Store endpoint
app.post('/store', async (req, res) => {
  const { username, data } = req.body;

  // Validate inputs
  if (!username || !data) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex'); // Generate a new salt for each user
    const { iv, encryptedVault } = encryptData(data, username, salt);

    // Check if a vault exists for the user
    let vault = await Vault.findOne({ username });
    if (vault) {
      vault.encryptedVault = encryptedVault;
      vault.iv = iv;
      vault.salt = salt; // Store the salt
    } else {
      vault = new Vault({ username, encryptedVault, iv, salt });
    }

    await vault.save();
    await new Analytics({
      username,
      action: 'store'
    }).save();
    res.status(200).json({ message: 'Data stored successfully in vault' });
  } catch (err) {
    console.error('Error storing data:', err.message);
    res.status(500).json({ message: 'Error storing data: ' + err.message });
  }
});

// Retrieve endpoint
app.post('/retrieve', async (req, res) => {
  const { username } = req.body;

  // Validate input
  if (!username) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    // Find the user's vault in the database
    const vault = await Vault.findOne({ username });
    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    // Decrypt the vault data using the stored salt and username
    const decryptedData = decryptData(vault.encryptedVault, vault.iv, username, vault.salt);
    await new Analytics({
      username,
      action: 'retrieve'
    }).save();
    res.status(200).json(decryptedData);
  } catch (err) {
    console.error('Error retrieving data:', err.message);
    res.status(500).json({ message: 'Error retrieving data: ' + err.message });
  }
});



// Function to register a new user
const registerUser = async (username, password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = generateKey(password, salt).toString('hex');
  const user = new User({ username, password: hashedPassword, salt });
  await user.save();
  console.log('User registered successfully');
};

// Function to authenticate a user
const authenticateUser = async (username, password) => {
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Invalid username or password');
  }

  const key = generateKey(password, user.salt);
  const hashedPassword = key.toString('hex');

  if (hashedPassword !== user.password) {
    throw new Error('Invalid username or password');
  }

  return user;
};

// The rest of your login endpoint remains the same
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!validator.isAlphanumeric(username) || !validator.isLength(password, { min: 8 })) {
    return res.status(400).send('Invalid input');
  }
  try {
    await authenticateUser(username, password);
    
    // Set the username in a cookie (expires in 1 hour)
    res.cookie('username', username, { maxAge: 3600000 }); // Cookie expires in 1 hour
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Error logging in: ' + err.message });
  }
});

// Store endpoint
app.post('/store', (req, res) => {
  const { filePath, data, password } = req.body;
  if (!validator.isLength(password, { min: 8 })) {
    return res.status(400).send('Invalid input');
  }
  storeEncryptedData(filePath, data, password);
  res.send('Data stored successfully');
});

// Retrieve endpoint
app.post('/retrieve', (req, res) => {
  const { filePath, password } = req.body;
  if (!validator.isLength(password, { min: 8 })) {
    return res.status(400).send('Invalid input');
  }
  try {
    const data = retrieveDecryptedData(filePath, password);
    res.json(data);
  } catch (err) {
    res.status(400).send('Error retrieving data: ' + err.message);
  }
});

// Face ID registration endpoint
app.post('/api/register-faceid', async (req, res) => {
  const { username, descriptors } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('User not found');
    }
    user.descriptors.push(...descriptors);
    await user.save();
    res.json({ message: 'Face ID registration successful!' });
  } catch (err) {
    res.status(400).send('Error registering Face ID: ' + err.message);
  }
});

// Face ID authentication endpoint
app.post('/authenticate-faceid', async (req, res) => {
  const { username, descriptors } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('User not found');
    }

    const isAuthenticated = user.descriptors.some(storedDescriptor => {
      return descriptors.some(descriptor => {
        return faceapi.euclideanDistance(storedDescriptor, descriptor) < 0.6;
      });
    });

    if (isAuthenticated) {
      // Set the username in a cookie (expires in 1 hour)
      res.cookie('username', username, { maxAge: 3600000 }); // Cookie expires in 1 hour
      res.json({ success: true, message: 'Authentication successful!' });
    } else {
      res.status(400).json({ message: 'Authentication failed.' });
    }
  } catch (err) {
    res.status(400).send('Error authenticating Face ID: ' + err.message);
  }
});

// Serve Frontend
// Serve Frontend - Calc Page on Root
app.get('/', (req, res) => {
  // Serve calc.html as the homepage
  res.sendFile(path.join(__dirname, 'public', 'calc.html'));
});

// Serve index.html when the link is clicked from calc.html
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

const analyticsSchema = new mongoose.Schema({
  username: String,
  action: String, // 'store' or 'retrieve'
  timestamp: { type: Date, default: Date.now }
});

const Analytics = mongoose.model('Analytics', analyticsSchema);

// Add these new endpoints to your server.js:

// Get dashboard statistics
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Get total passwords
    const totalPasswords = await Vault.countDocuments();

    // Get today's retrievals
    const todayRetrievals = await Analytics.countDocuments({
      action: 'retrieve',
      timestamp: { $gte: dayAgo }
    });

    // Get active users (users who performed any action in last 24 hours)
    const activeUsers = await Analytics.distinct('username', {
      timestamp: { $gte: dayAgo }
    });

    // Get last 7 days retrievals
    const dailyRetrievals = await Analytics.aggregate([
      {
        $match: {
          action: 'retrieve',
          timestamp: { $gte: weekAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get hourly usage pattern
    const hourlyPattern = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: dayAgo }
        }
      },
      {
        $group: {
          _id: {
            $hour: "$timestamp"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get recent activity
    const recentActivity = await Analytics.find()
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      totalPasswords,
      todayRetrievals,
      activeUsersCount: activeUsers.length,
      dailyRetrievals,
      hourlyPattern,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
