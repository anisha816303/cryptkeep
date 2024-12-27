const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const validator = require('validator');
const faceapi = require('face-api.js');
const app = express();
const PORT = 4000;
const cookieParser = require('cookie-parser');
app.use(cookieParser());


// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/favicon.ico', (req, res) => res.status(204));


// MongoDB connection URI
const uri = 'mongodb+srv://anishaajit816:3JevU00J9Mr7XnrL@cryptkeepcluster.grvfy.mongodb.net/?retryWrites=true&w=majority&appName=cryptkeepcluster';

// Connect to MongoDB using Mongoose
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Define User schema and model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  salt: { type: String, required: true },
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

// Function to generate a secure key using PBKDF2
const generateKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
};

// Function to encrypt data
const encryptData = (data, password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = generateKey(password, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encryptedData = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  
  return {
    salt,
    iv: iv.toString('hex'),
    encryptedVault: encryptedData.toString('hex')
  };
};

// Function to decrypt data
const decryptData = (encryptedData, password, salt, iv) => {
  const key = generateKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  const decryptedData = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'hex')), decipher.final()]);
  return JSON.parse(decryptedData.toString());
};

app.post('/store', async (req, res) => {
  const { username, data, password } = req.body;

  // Validate inputs
  if (!username || !data || !password || !validator.isLength(password, { min: 8 })) {
    return res.status(400).send('Invalid input');
  }

  try {
    // Encrypt data with the master password
    const { salt, iv, encryptedVault } = encryptData(data, password);

    // Check if a vault exists for the user
    let vault = await Vault.findOne({ username });
    if (vault) {
      // Update existing vault
      vault.encryptedVault = encryptedVault;
      vault.salt = salt;
      vault.iv = iv;
    } else {
      // Create a new vault
      vault = new Vault({ username, encryptedVault, salt, iv });
    }

    await vault.save();
    res.status(200).send('Data stored successfully in vault');
  } catch (err) {
    res.status(500).send('Error storing data: ' + err.message);
  }
});


app.post('/retrieve', async (req, res) => {
  const { username, password } = req.body;

  // Validate inputs
  if (!username || !password || !validator.isLength(password, { min: 8 })) {
    return res.status(400).send('Invalid input');
  }

  try {
    // Find the vault
    const vault = await Vault.findOne({ username });
    if (!vault) {
      return res.status(404).send('Vault not found');
    }

    // Decrypt the vault data
    const decryptedData = decryptData(vault.encryptedVault, password, vault.salt, vault.iv);
    res.status(200).json(decryptedData);
  } catch (err) {
    res.status(500).send('Error retrieving data: ' + err.message);
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
    throw new Error('User not found');
  }
  const hashedPassword = generateKey(password, user.salt).toString('hex');
  if (hashedPassword !== user.password) {
    throw new Error('Invalid password');
  }
  return user;
};

// Register endpoint
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!validator.isAlphanumeric(username) || !validator.isLength(password, { min: 8 })) {
    return res.status(400).send('Invalid input');
  }
  try {
    await registerUser(username, password);
    res.status(200).json({message:'User registered successfully'});
  } catch (err) {
    res.status(400).json({message:'Error registering user: ' + err.message});
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Validate input
  if (!validator.isAlphanumeric(username) || !validator.isLength(password, { min: 8 })) {
    return res.status(400).send('Invalid input');
  }

  try {
    // Attempt user authentication (you would need to implement authenticateUser function)
    await authenticateUser(username, password);
    
    // Set the username in a cookie (expires in 1 hour)
    res.cookie('username', username, { maxAge: 3600000, httpOnly: true }); // Cookie expires in 1 hour
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Error logging in: ' + err.message });
  }
});



// Face ID registration endpoint
app.post('/api/register-faceid', async (req, res) => {
  const { username, descriptors } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({message:'User not found'});
    }
    user.descriptors.push(...descriptors);
    await user.save();
    res.json({ message: 'Face ID registration successful!' });
  } catch (err) {
    res.status(400).send('Error registering Face ID: ' + err.message);
  }
});

// Face ID authentication endpoint
app.post('/api/authenticate-faceid', async (req, res) => {
  const { username, descriptors } = req.body;

  try {
    // Find user by username
    const user = await User.findOne({ username });

    // If user is not found, return a 400 response
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Authenticate user by comparing descriptors using face-api.js
    const isAuthenticated = user.descriptors.some(storedDescriptor => {
      return descriptors.some(descriptor => {
        // Check if any of the provided descriptors matches the stored ones
        return faceapi.euclideanDistance(storedDescriptor, descriptor) < 0.6;
      });
    });

    // If authentication is successful
    if (isAuthenticated) {
      // Set the username in a cookie (expires in 1 hour)
      res.cookie('username', username, { maxAge: 3600000, httpOnly: true }); // Cookie expires in 1 hour
      res.json({ success: true, message: 'Authentication successful!' });
    } else {
      // If authentication fails, send a 401 Unauthorized status
      res.status(401).json({ success: false, message: 'Authentication failed.' });
    }

  } catch (err) {
    // Handle any errors during the process
    res.status(500).json({ success: false, message: 'Error authenticating Face ID: ' + err.message });
  }
});



// Serve Frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
