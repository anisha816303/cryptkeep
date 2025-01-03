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

 document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('store-form').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const username = Cookies.get('username'); // Retrieve username from cookies
    console.log(username);
    const description = document.getElementById('description').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    console.log('Storing password:', { username, description, email, password });
    try {
      const response = await fetch(`${apiUrl}/store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          data: { description, email, password },
        }),
      });
  
      if (response.ok) {
        alert('Password stored successfully in vault!');
        document.getElementById('store-form').reset(); // Clear form inputs
      } else {
        const result = await response.json();
        alert(result.message || 'Error storing password');
      }
    } catch (error) {
      alert('Error connecting to server. Please try again.');
      console.error('Error:', error);
    }
  });
  
 });


 document.getElementById('search-btn')?.addEventListener('click', async () => {
  const username = Cookies.get('username'); // Retrieve username from cookies

  try {
    const response = await fetch(`${apiUrl}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Retrieved Data:', data); // Log the raw response data

      // Check if data is an object and contains the necessary properties
      if (data && typeof data === 'object') {
        // Display the data
        const resultsList = document.getElementById('results');
        resultsList.innerHTML = ''; // Clear previous results

        const li = document.createElement('li');
        li.textContent = `${data.description} - ${data.email} - ${data.password}`;
        resultsList.appendChild(li);
      } else {
        alert('Unexpected data format received from the server.');
      }
    } else {
      const result = await response.json();
      alert(result.message || 'Error retrieving data');
    }
  } catch (error) {
    alert('Error connecting to server. Please try again.');
    console.error('Error:', error);
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

  const response = await fetch(`${apiUrl}/api/register-faceid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, descriptors: detections.map(d => d.descriptor) }),
  });

  const result = await parseResponse(response);
  alert(result.message || 'Face ID registration failed.');
}

async function authenticateWithFaceID(username) {
  const canvas = captureImage();
  const detections = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors();
  if (detections.length === 0) {
    alert('No face detected. Please try again.');
    return;
  }

  
  const response = await fetch(`${apiUrl}/api/authenticate-faceid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, descriptors: detections.map(d => d.descriptor) }),
  });
  const result = await response.json();
  if (result.success) {
    alert('Login successful with Face ID!');
    window.location.href = 'dashboard.html';
  } else {
    alert(result.message);
  }
}

document.getElementById('register-faceid-btn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const loadingSpinner = document.getElementById('loading-spinner');
  const username = prompt('Enter your username:');
  loadingSpinner.style.display = 'flex'; // Show spinner

  try {
    const video = document.getElementById('video');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    video.style.display = 'block'; 
    loadingSpinner.style.display = 'flex'; 
    document.getElementById('capture-btn').style.display = 'block';

    document.getElementById('capture-btn').addEventListener('click', async () => {
      loadingSpinner.style.display = 'flex'; // Show spinner while capturing
      await registerWithFaceID(username);
      loadingSpinner.style.display = 'none'; // Hide spinner after capturing
      alert('Face ID registration successful!');
    });
  } catch (error) {
    console.error('Error accessing camera:', error);
    loadingSpinner.style.display = 'none'; // Hide spinner on error
    alert('Unable to access the camera.');
  }
});


// Event listener for Face ID login button
document.getElementById('login-faceid-btn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const loadingSpinner = document.getElementById('loading-spinner');
  const username = prompt('Enter your username:');
  loadingSpinner.style.display = 'flex'; // Show spinner

  try {
    const video = document.getElementById('video');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    video.style.display = 'block'; 
    loadingSpinner.style.display = 'flex'; 
    document.getElementById('capture-login-btn').style.display = 'block';

    document.getElementById('capture-login-btn').addEventListener('click', async () => {
      loadingSpinner.style.display = 'flex'; // Show spinner while capturing
      await authenticateWithFaceID(username);
      loadingSpinner.style.display = 'none'; // Hide spinner after capturing
      
    });
  } catch (error) {
    console.error('Error accessing camera:', error);
    loadingSpinner.style.display = 'none'; // Hide spinner on error
    alert('Unable to access the camera.');
  }
});  

document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('masterPassword');
  const usernameFeedback = document.getElementById('username-feedback');
  const passwordFeedback = document.getElementById('password-feedback');
  

  // Validate username and password
  usernameInput.addEventListener('input', () => {
    if (validator.isAlphanumeric(usernameInput.value)) {
      usernameFeedback.textContent = '✓ Valid username';
      usernameFeedback.classList.remove('text-red-500');
      usernameFeedback.classList.add('text-green-500');
    } else {
      usernameFeedback.textContent = '✗ Username must be alphanumeric';
      usernameFeedback.classList.remove('text-green-500');
      usernameFeedback.classList.add('text-red-500');
    }
  });

  passwordInput.addEventListener('input', () => {
    if (validator.isLength(passwordInput.value, { min: 8 })) {
      passwordFeedback.textContent = '✓ Password length is sufficient';
      passwordFeedback.classList.remove('text-red-500');
      passwordFeedback.classList.add('text-green-500');
    } else {
      passwordFeedback.textContent = '✗ Password must be at least 8 characters';
      passwordFeedback.classList.remove('text-green-500');
      passwordFeedback.classList.add('text-red-500');
    }
  });

 });




// Helper function for relative time
Date.prototype.toRelative = function() {
  const diff = (new Date() - this) / 1000;
  const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
  };

  for (let [unit, seconds] of Object.entries(intervals)) {
      const interval = Math.floor(diff / seconds);
      if (interval >= 1) {
          return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
      }
  }
  return 'just now';
};

// Keep track of chart instances to destroy them before creating new ones
let retrievalsChart = null;
let patternsChart = null;

const updateDashboard = async () => {
  try {
      const response = await fetch('/api/dashboard-stats');
      const data = await response.json();

      // Update stat cards
      document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = data.totalPasswords;
      document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = data.todayRetrievals;
      document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = data.activeUsersCount;

      // Calculate average daily retrievals
      const avgRetrievals = Math.round(
          data.dailyRetrievals.reduce((acc, day) => acc + day.count, 0) / data.dailyRetrievals.length
      );
      document.querySelector('.stat-card:nth-child(4) .stat-value').textContent = avgRetrievals;

      // Destroy existing charts before creating new ones
      if (retrievalsChart) {
          retrievalsChart.destroy();
      }
      if (patternsChart) {
          patternsChart.destroy();
      }

      // Update retrievals chart
      retrievalsChart = new Chart(document.getElementById('retrievalsChart').getContext('2d'), {
          type: 'bar',
          data: {
              labels: data.dailyRetrievals.map(day => 
                  new Date(day._id).toLocaleDateString('en-US', { weekday: 'short' })
              ),
              datasets: [{
                  label: 'Password Retrievals',
                  data: data.dailyRetrievals.map(day => day.count),
                  backgroundColor: 'rgba(76, 175, 80, 0.6)',
                  borderColor: 'rgba(76, 175, 80, 1)',
                  borderWidth: 1
              }]
          },
          options: {
              responsive: true,
              scales: {
                  y: {
                      beginAtZero: true
                  }
              }
          }
      });

      // Update patterns chart
      patternsChart = new Chart(document.getElementById('patternsChart').getContext('2d'), {
          type: 'line',
          data: {
              labels: data.hourlyPattern.map(hour => `${hour._id}:00`),
              datasets: [{
                  label: 'Usage Pattern',
                  data: data.hourlyPattern.map(hour => hour.count),
                  fill: true,
                  backgroundColor: 'rgba(76, 175, 80, 0.2)',
                  borderColor: 'rgba(76, 175, 80, 1)',
                  tension: 0.4
              }]
          },
          options: {
              responsive: true,
              scales: {
                  y: {
                      beginAtZero: true
                  }
              }
          }
      });

      // Update recent activity
      const activityList = document.querySelector('.activity-list');
      activityList.innerHTML = data.recentActivity.map(activity => `
          <li class="activity-item">
              <span>Password ${activity.action}d</span>
              <span>${new Date(activity.timestamp).toRelative()}</span>
          </li>
      `).join('');

  } catch (error) {
      console.error('Error updating dashboard:', error);
  }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  updateDashboard();
  // Refresh dashboard every minute
  setInterval(updateDashboard, 60000);
});

// Add error handling for chart loading
window.addEventListener('error', (e) => {
  if (e.target.tagName === 'CANVAS') {
      console.error('Error loading chart:', e);
      // You might want to add some user-friendly error display here
  }
});

function logout() {
  // Remove the username from cookies
  Cookies.remove('username'); // Assuming the username is stored in a cookie named 'username'

  // Redirect to the login page
  window.location.href = 'login.html';
}


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
    window.location.href = 'login.html'; // Redirect to dashboard after OTP verification
  } else {
    otpFeedback.textContent = result.message || 'Invalid OTP. Please try again.';
    otpFeedback.style.color = 'red';
  }
});





