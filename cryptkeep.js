// Required modules
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Function to generate a secure key using PBKDF2
const generateKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
};

// Function to encrypt and store data
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

  fs.writeFileSync(filePath, JSON.stringify(fileContent), 'utf8');
  console.log("Data has been securely stored.");
};

// Function to retrieve and decrypt data
const loadEncryptedData = (filePath, password) => {
  const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const key = generateKey(password, fileContent.salt);
  const iv = Buffer.from(fileContent.iv, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decryptedData = Buffer.concat([
    decipher.update(Buffer.from(fileContent.data, 'hex')),
    decipher.final(),
  ]);

  console.log("Data successfully decrypted.");
  return JSON.parse(decryptedData.toString());
};

// API Endpoints
const VAULT_FILE = 'secure_vault.json';

app.post('/api/login', (req, res) => {
  const { masterPassword } = req.body;
  if (!fs.existsSync(VAULT_FILE)) {
    return res.status(400).json({ message: "Vault not found. Please register first." });
  }
  try {
    loadEncryptedData(VAULT_FILE, masterPassword);
    res.json({ message: "Login successful!" });
  } catch (error) {
    res.status(401).json({ message: "Invalid master password." });
  }
});

app.post('/api/store', (req, res) => {
  const { masterPassword, description, email, password } = req.body;
  try {
    let vaultData = {};
    if (fs.existsSync(VAULT_FILE)) {
      vaultData = loadEncryptedData(VAULT_FILE, masterPassword);
    }
    const newEntry = { description, email, password };
    vaultData[description] = newEntry;
    storeEncryptedData(VAULT_FILE, vaultData, masterPassword);
    res.json({ message: "Password stored successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error storing password." });
  }
});

app.get('/api/retrieve', (req, res) => {
  const { masterPassword, search } = req.query;
  try {
    const vaultData = loadEncryptedData(VAULT_FILE, masterPassword);
    const results = Object.values(vaultData).filter(
      (entry) =>
        entry.description.includes(search) ||
        entry.email.includes(search)
    );
    res.json({ results });
  } catch (error) {
    res.status(401).json({ message: "Invalid master password." });
  }
});

app.post('/api/register', (req, res) => {
  const { masterPassword } = req.body;
  // if (fs.existsSync(VAULT_FILE)) {
  //   return res.status(400).json({ message: "Vault already exists. Please log in." });
  // }
  try {
    const initialData = {}; // Empty vault
    storeEncryptedData(VAULT_FILE, initialData, masterPassword);
    res.json({ message: "Registration successful! Vault created." });
  } catch (error) {
    res.status(500).json({ message: "Error during registration." });
  }
});

// Serve Frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

/*
 * Frontend: Create a folder named 'public' in the project directory.
 * Add the following files in 'public':
 * - index.html: For the login page
 * - dashboard.html: For the password management interface
 * - script.js: To handle user interactions and API calls
 */