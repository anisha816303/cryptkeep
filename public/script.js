const apiUrl = 'http://localhost:4000';


document.addEventListener('DOMContentLoaded', async () => {
  // Ensure face-api.js is loaded
  if (typeof faceapi === 'undefined') {
    console.error('face-api.js is not loaded.');
    return;
  }

  // Load all face-api models
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
  video.play(); // Start video stream
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

// Login form handler
document.addEventListener('DOMContentLoaded', () => {
  const apiUrl = 'http://localhost:4000';

  // Login form handler
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const masterPassword = document.getElementById('masterPassword').value;
    console.log('Login attempt:', { username, masterPassword});


    // Send login request to the server
    const response = await fetch(`${apiUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: masterPassword }),
    });
    
    const result = await response.json();  // Assuming the response is a JSON object
    console.log('Response:', response);
    console.log('Result:', result);
    // Check if the response is successful
    if (response.ok) {
      // Successful login, redirect to dashboard
      window.location.href = 'dashboard.html';
    } else {
      // Login failed, display error message
      alert(result.message || 'Login failed!');
    }
  });

  //Register form handler
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const masterPassword = document.getElementById('masterPassword').value;

    // Send registration request to the server
    const response = await fetch(`${apiUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: masterPassword }),
    });

    // Assuming the response is a JSON object
    const result = await response.json();
    if (response.ok){
      alert(result.message);
    } else {
      alert(result.message || 'An error occurred during registration.');
    }
  });
 });


 document.getElementById('store-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = Cookies.get('username'); // Retrieve username from cookies
  const masterPassword = document.getElementById('masterPassword').value;
  const description = document.getElementById('description').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const response = await fetch(`${apiUrl}/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      username,
      password: masterPassword,
      data: { description, email, password }
    }),
  });

  if (response.ok) {
    alert('Password stored successfully in vault!');
  } else {
    const result = await response.json();
    alert(result.message || 'Error storing password');
  }
});

document.getElementById('search-btn')?.addEventListener('click', async () => {
  const username = Cookies.get('username');
  const masterPassword = document.getElementById('masterPassword').value;
  const search = document.getElementById('search').value;

  const response = await fetch(`${apiUrl}/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: masterPassword }),
  });

  if (response.ok) {
    const result = await response.json();
    const filteredResults = result.filter(entry => entry.description.includes(search));

    const resultsList = document.getElementById('results');
    resultsList.innerHTML = ''; // Clear previous results
    filteredResults.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.description} - ${entry.email} - ${entry.password}`;
      resultsList.appendChild(li);
    });
  } else {
    const result = await response.json();
    alert(result.message || 'Error retrieving passwords');
  }
});



// Function for Face ID registration
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
  const result = await response.json();
  alert(result.message);
}

// Function for Face ID authentication
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
    loadingSpinner.style.display = 'flex'; // Hide spinner after starting camera
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
document.getElementById('login-faceid-btn')?.addEventListener('click', async () => {
  const username = prompt('Enter your username:');
  await startCamera();
  document.getElementById('capture-login-btn').style.display = 'block';
  document.getElementById('capture-login-btn').addEventListener('click', async () => {
    await authenticateWithFaceID(username);
  });
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


document.addEventListener('DOMContentLoaded', () => {
  const loginFaceIdBtn = document.getElementById('login-faceid-btn');
  const faceIdSection = document.getElementById('faceid-section');
  const captureLoginBtn = document.getElementById('capture-login-btn');
  const loadingSpinner = document.getElementById('loading-spinner');

  // Toggle Face ID section
  loginFaceIdBtn.addEventListener('click', () => {
    faceIdSection.style.display = faceIdSection.style.display === 'none' ? 'block' : 'none';
  });

  // Start camera and show loading spinner when capturing
  captureLoginBtn.addEventListener('click', async () => {
    try {
      loadingSpinner.style.display = 'flex'; // Show spinner
      const video = document.getElementById('video');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.play();

      // Simulate a delay for capturing and processing
      setTimeout(() => {
        loadingSpinner.style.display = 'none'; // Hide spinner after capturing
      }, 3000); // Adjust time as needed for actual processing
    } catch (error) {
      console.error('Error accessing camera:', error);
      loadingSpinner.style.display = 'none'; // Hide spinner on error
      alert('Unable to access the camera.');
    }
  });
});




