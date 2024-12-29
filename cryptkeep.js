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
const uri = 'mongodb+srv://anishaajit816:3JevU00J9Mr7XnrL@cryptkeepcluster.grvfy.mongodb.net/?retryWrites=true&w=majority&appName=cryptkeepcluster';

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

// Function to generate a secure key using PBKDF2
const generateKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
};

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

// Register endpoint (includes OTP generation)
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



// Add this function before the login endpoint
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
