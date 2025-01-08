const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const faceapi = require('face-api.js');
const mongoose = require('mongoose');
const validator = require('validator');
const nodemailer = require('nodemailer');
const app = express();
const cookieParser = require('cookie-parser');
app.use(cookieParser());

const PORT = 4000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/favicon.ico', (req, res) => res.status(204));

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

app.post('/store', async (req, res) => {
  const { username, data } = req.body;

  // Validate inputs
  if (!username || !data) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex'); // Generate a new salt
    const { iv, encryptedVault } = encryptData(data, username, salt); // Encrypt the data

    // Find the user's vault
    let vault = await Vault.findOne({ username });

    if (vault) {
      // Append the new encrypted data to the existing encryptedVault string
      vault.encryptedVault += `|${encryptedVault}`;
      vault.iv += `|${iv}`; // Append the IV (keep a separator)
      vault.salt += `|${salt}`; // Append the salt (keep a separator)
    } else {
      // If no vault exists, create a new one
      vault = new Vault({
        username,
        encryptedVault, // Save as a single string
        iv,
        salt,
      });
    }

    await vault.save();
    await new Analytics({
      username,
      action: 'store',
    }).save();

    res.status(200).json({ message: 'Data stored successfully in vault' });
  } catch (err) {
    console.error('Error storing data:', err.message);
    res.status(500).json({ message: 'Error storing data: ' + err.message });
  }
});


app.post('/retrieve', async (req, res) => {
  const { username, search } = req.body;

  // Validate inputs
  if (!username || !search) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const vault = await Vault.findOne({ username });
    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    // Split the concatenated strings
    const encryptedVaults = vault.encryptedVault.split('|');
    const ivs = vault.iv.split('|');
    const salts = vault.salt.split('|');

    // Decrypt each entry and filter by the search query
    const results = encryptedVaults.map((encryptedData, index) => {
      const decryptedData = decryptData(
        encryptedData,
        ivs[index],
        username,
        salts[index]
      );
      return decryptedData;
    });

    // Filter the decrypted results
    const filteredResults = results.filter(item => {
      return (
        item.description?.toLowerCase().includes(search.toLowerCase()) ||
        item.email?.toLowerCase().includes(search.toLowerCase()) ||
        item.password?.toLowerCase().includes(search.toLowerCase())
      );
    });

    if (filteredResults.length === 0) {
      return res.status(404).json({ message: 'No matching records found' });
    }

    await new Analytics({
      username,
      action: 'retrieve',
    }).save();

    res.status(200).json(filteredResults);
  } catch (err) {
    console.error('Error retrieving data:', err.message);
    res.status(500).json({ message: 'Error retrieving data: ' + err.message });
  }
});



// Create a transporter object using Gmail's SMTP server
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'cryptkeep7@gmail.com',
    pass: 'afqf fbio vpzz sdru',
  },
  tls: {
    rejectUnauthorized: false,
  }
});

// Generate a random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit OTP
};

// Global variable to store OTP temporarily (in production, use Redis or similar)
let storedOtp = null;

// Send OTP via email
const sendOTP = (email, otp) => {
  const mailOptions = {
    from: 'cryptkeep7@gmail.com',
    to: email,
    subject: 'Cryptkeep OTP Verification',
    text: `Your OTP for Cryptkeep registration is: ${otp}`
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject('Error sending OTP email: ' + error);
      } else {
        resolve(info.response);
      }
    });
  });
};

// Function to register a new user
const registerUser = async (username, password, email) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = generateKey(password, salt).toString('hex');
  const user = new User({ username, password: hashedPassword, salt ,email});
  await user.save();
  console.log('User registered successfully');
};

app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!validator.isAlphanumeric(username) || !validator.isLength(password, { min: 8 }) || !validator.isEmail(email)) {
    return res.status(400).send('Invalid input');
  }

  try {
    // Generate OTP
    const otp = generateOTP();
    console.log(`Generated OTP: ${otp}`);

    // Send OTP email
    await sendOTP(email, otp);

    // Store OTP temporarily
    storedOtp = otp;
    console.log(`Stored OTP: ${storedOtp}`);

    res.json({ message: 'OTP sent to your email. Please verify it to complete registration.' });
  } catch (err) {
    res.status(400).send('Error registering user: ' + err.message);
  }
});

// OTP verification endpoint
app.post('/verify-otp', async (req, res) => {
  const { otpEntered, username, password, email } = req.body;

  // Log the incoming request body to check if password is defined
  console.log('Request body:', req.body);

  // Ensure OTP is available in memory
  if (!storedOtp) {
    return res.status(400).json({ success: false, message: 'OTP has not been generated or stored.' });
  }

  // Convert both entered OTP and stored OTP to strings (if they aren't already)
  const otpEnteredStr = String(otpEntered);  // Ensure entered OTP is a string
  const storedOtpStr = String(storedOtp);    // Ensure stored OTP is a string

  console.log(`Entered OTP: ${otpEnteredStr}`);
  console.log(`Stored OTP: ${storedOtpStr}`);

  // Compare the two OTPs
  if (otpEnteredStr === storedOtpStr) {
    console.log('OTP is valid'); // This prints to the console if OTPs match
    try {
      // OTP is valid, now register the user
      if (!password) {
        return res.status(400).send('Password is required.');
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = generateKey(password, salt).toString('hex');
     
      // Create new user object
      const user = new User({ username, password: hashedPassword, salt, email });

      // Save user to database
      const savedUser = await user.save();  // Await the save and store the result
      console.log('User registered successfully:', savedUser);

      // Clear the stored OTP after successful registration
      storedOtp = null;

      // Return success response
      res.json({ success: true, message: 'OTP verified successfully! Registration complete.' });
    } catch (err) {
      if (err.name === 'ValidationError') {
        // Log validation error details
        console.error('Validation error:', err.errors);
        return res.status(400).send('Validation error: ' + err.message);
      }
     
      // If it's a different kind of error, log the error message
      console.error('Error saving user:', err);
      return res.status(400).send('Error saving user: ' + err.message);
    }
   
  }
  else {
    // OTP is invalid
    console.log('OTP is invalid'); // This prints to the console if OTPs do not match
    
    return res.status(400).send('Invalid OTP. Please try again.');
  }

});

// Step 3: Finalize Registration
app.post('/finalize-registration', async (req, res) => {
  const { username, password, email } = req.body;

  try {
    await registerUser(username, password, email); // Register user
    console.log('Registration completed successfully for:', username);

    res.send('User registered successfully.');
  } catch (err) {
    res.status(400).send('Error registering user: ' + err.message);
  }
});


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
      res.cookie('username', username, { maxAge: 3600000 }); // Cookie expires in 1 hour
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

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    // Extract username from the cookie
    const username = req.cookies.username;

    if (!username) {
      return res.status(401).json({ error: 'Unauthorized: No username found in cookies' });
    }

    const now = new Date();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Get total passwords for this user
    const totalPasswords = await Vault.countDocuments({ username });

    // Get today's retrievals for this user
    const todayRetrievals = await Analytics.countDocuments({
      username,  // filter by username
      action: 'retrieve',
      timestamp: { $gte: dayAgo }
    });

    // Get active users (users who performed any action in the last 24 hours, filter by this user)
    const activeUsers = await Analytics.distinct('username', {
      username,  // filter by username
      timestamp: { $gte: dayAgo }
    });

    // Get last 7 days retrievals for this user
    const dailyRetrievals = await Analytics.aggregate([
      {
        $match: {
          username,  // filter by username
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

    // Get hourly usage pattern for this user
    const hourlyPattern = await Analytics.aggregate([
      {
        $match: {
          username,  // filter by username
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

    // Get recent activity for this user
    const recentActivity = await Analytics.find({ username })  // filter by username
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
