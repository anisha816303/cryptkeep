const apiUrl = 'http://localhost:4000';

// Ensure face-api.js is loaded
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof faceapi === 'undefined') {
    console.error('face-api.js is not loaded.');
    return;
  }

  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
  await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');

  console.log('Face API models loaded');
});

// Function to start the camera
async function startCamera() {
  const video = document.getElementById('video');
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play(); // Start video stream
}

// Function to capture the image
function captureImage() {
  const video = document.getElementById('video');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Helper to handle JSON responses
async function parseResponse(response) {
  try {
    return await response.json();
  } catch {
    return { message: response.statusText };
  }
}

// Login form handler
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const masterPassword = document.getElementById('masterPassword').value;

  const response = await fetch(`${apiUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: masterPassword }),
  });

  const result = await parseResponse(response);

  if (response.ok) {
    window.location.href = 'dashboard.html';
  } else {
    alert(result.message || 'Login failed!');
  }
});

// Register form handler
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const masterPassword = document.getElementById('masterPassword').value;
  const email = document.getElementById('email').value;

  const registerMessage = document.getElementById('register-message');
  registerMessage.innerText = '';
  registerMessage.style.color = '';

  const response = await fetch(`${apiUrl}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: masterPassword, email }),
  });

  const result = await parseResponse(response);

  if (response.ok) {
    registerMessage.innerText = 'Registration successful! Please check your email for OTP.';
    registerMessage.style.color = 'green';
    document.getElementById('otp-sections').style.display = 'block'; // Show OTP section
  } else {
    registerMessage.innerText = result.message || 'An error occurred during registration.';
    registerMessage.style.color = 'red';
  }
});

// OTP Verification
// OTP Verification
document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
  const otpEntered = document.getElementById('otp').value;
  const username = document.getElementById('username').value;
  const masterPassword = document.getElementById('masterPassword').value;
  const email = document.getElementById('email').value;

  const response = await fetch(`${apiUrl}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      otpEntered,
      username,
      password: masterPassword,
      email 
    }),
  });

  const result = await parseResponse(response);
  const otpFeedback = document.getElementById('otp-feedback');

  if (response.ok) {
    otpFeedback.textContent = 'OTP verified successfully!';
    otpFeedback.style.color = 'green';
    window.location.href = 'index.html'; // Redirect to dashboard after OTP verification
  } else {
    otpFeedback.textContent = result.message || 'Invalid OTP. Please try again.';
    otpFeedback.style.color = 'red';
  }
});

// Face ID Registration
async function registerWithFaceID(username) {
  const canvas = captureImage();
  const detections = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors();

  if (detections.length === 0) {
    alert('No face detected. Please try again.');
    return;
  }

  const response = await fetch(`${apiUrl}/register-faceid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, descriptors: detections.map(d => Array.from(d.descriptor)) }),
  });

  const result = await parseResponse(response);
  alert(result.message || 'Face ID registration failed.');
}

// Face ID Login
async function authenticateWithFaceID(username) {
  const canvas = captureImage();
  const detections = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors();

  if (detections.length === 0) {
    alert('No face detected. Please try again.');
    return;
  }

  const response = await fetch(`${apiUrl}/authenticate-faceid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, descriptors: detections.map(d => Array.from(d.descriptor)) }),
  });

  const result = await parseResponse(response);

  if (response.ok) {
    alert('Login successful with Face ID!');
    window.location.href = 'dashboard.html';
  } else {
    alert(result.message || 'Face ID login failed.');
  }
}

// Event listener for Face ID registration
document.getElementById('register-faceid-btn')?.addEventListener('click', async () => {
  const username = prompt('Enter your username:');
  await startCamera();
  document.getElementById('capture-btn')?.addEventListener('click', async () => {
    await registerWithFaceID(username);
  });
});

// Event listener for Face ID login
document.getElementById('login-faceid-btn')?.addEventListener('click', async () => {
  const username = prompt('Enter your username:');
  await startCamera();
  document.getElementById('capture-login-btn')?.addEventListener('click', async () => {
    await authenticateWithFaceID(username);
  });
});
