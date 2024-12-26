const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const validator = require('validator');
const faceapi = require('face-api.js');
const app = express();
const PORT = 4000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Function to generate a secure key using PBKDF2
const generateKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
};

// Function to encrypt and store data locally
const storeEncryptedData = (filePath, data, password) => {
  const salt = crypto.randomBytes(16).toString('hex'); // Generate random salt
  const key = generateKey(password, salt);
  const iv = crypto.randomBytes(16); // Random initialization vector

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encryptedData = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);

  const fileContent = {
    salt,
    iv: iv.toString('hex'),
    data: encryptedData.toString('hex'),
  };

  fs.writeFileSync(filePath, JSON.stringify(fileContent));
  console.log('Data encrypted and stored locally');
};

// Function to decrypt and retrieve data from a local file
const retrieveDecryptedData = (filePath, password) => {
  const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const { salt, iv, data } = fileContent;
  const key = generateKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  const decryptedData = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
  return JSON.parse(decryptedData.toString());
};

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
    res.send('User registered successfully');
  } catch (err) {
    res.status(400).send('Error registering user: ' + err.message);
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!validator.isAlphanumeric(username) || !validator.isLength(password, { min: 8 })) {
    return res.status(400).send('Invalid input');
  }
  try {
    await authenticateUser(username, password);
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
      res.json({ message: 'Authentication successful!' });
    } else {
      res.status(400).json({ message: 'Authentication failed.' });
    }
  } catch (err) {
    res.status(400).send('Error authenticating Face ID: ' + err.message);
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
