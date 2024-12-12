const apiUrl = '/api';

// Login form handler
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const masterPassword = document.getElementById('masterPassword').value;
  const response = await fetch(`${apiUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ masterPassword }),
  });
  const result = await response.json();
  if (response.ok) {
    localStorage.setItem('masterPassword', masterPassword);
    window.location.href = 'dashboard.html';
  } else {
    document.getElementById('login-message').innerText = result.message;
  }
});

// Store password form handler
document.getElementById('store-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const masterPassword = localStorage.getItem('masterPassword');
  const description = document.getElementById('description').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const response = await fetch(`${apiUrl}/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ masterPassword, description, email, password }),
  });
  const result = await response.json();
  document.getElementById('store-message').innerText = result.message;
});

// Search handler
document.getElementById('search-btn')?.addEventListener('click', async () => {
  const masterPassword = localStorage.getItem('masterPassword');
  const search = document.getElementById('search').value;
  const response = await fetch(`${apiUrl}/retrieve?masterPassword=${encodeURIComponent(masterPassword)}&search=${encodeURIComponent(search)}`);
  const result = await response.json();
  const resultsList = document.getElementById('results');
  resultsList.innerHTML = '';
  if (response.ok) {
    result.results.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.description} - ${entry.email} - ${entry.password}`;
      resultsList.appendChild(li);
    });
  } else {
    resultsList.innerHTML = `<li>${result.message}</li>`;
  }
});