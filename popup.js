// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Load saved data when popup opens
  loadSavedData();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup form validation
  setupValidation();
});

function setupEventListeners() {
  // Save button functionality
  document.getElementById('save').addEventListener('click', saveFormData);
  
  // Load button functionality
  document.getElementById('load').addEventListener('click', loadSavedData);
  
  // Clear button functionality
  document.getElementById('clear').addEventListener('click', clearFormData);
  
  // Connect button functionality
  document.getElementById('connect').addEventListener('click', connectToIRCTC);
  
  // Quota change handler - to show/hide tatkal timing message
  const quotaSelect = document.getElementById('quota');
  if (quotaSelect) {
    quotaSelect.addEventListener('change', function() {
      const tatkalCheckbox = document.querySelector('input[name="tatkal_timing"]');
      const tatkalInfo = tatkalCheckbox.parentElement.nextElementSibling;
      
      if (this.value === 'TATKAL' || this.value === 'PT') {
        tatkalCheckbox.disabled = false;
        tatkalInfo.style.display = 'block';
      } else {
        tatkalCheckbox.disabled = true;
        tatkalCheckbox.checked = false;
        tatkalInfo.style.display = 'none';
      }
    });
  }
}

function saveFormData() {
  // Basic validation before saving
  if (!validateRequiredFields()) {
    showNotification('Please fill all required fields correctly', 'error');
    return;
  }
  
  const form = document.getElementById('tatkalForm');
  const data = {};
  
  // Collect all form data
  [...form.elements].forEach(el => {
    if (el.name) {
      if (el.type === 'checkbox') {
        data[el.name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value;
      }
    }
  });
  
  // Save to chrome.storage.local
  chrome.storage.local.set({ formData: data }, () => {
    showNotification('Your data has been saved successfully!', 'success');
  });
}

function loadSavedData() {
  chrome.storage.local.get('formData', (result) => {
    const data = result.formData;
    if (!data) {
      showNotification('No saved data found', 'info');
      return;
    }
    
    const form = document.getElementById('tatkalForm');
    
    // Populate form fields with saved data
    [...form.elements].forEach(el => {
      if (el.name && data.hasOwnProperty(el.name)) {
        if (el.type === 'checkbox') {
          el.checked = data[el.name];
        } else if (el.type === 'radio') {
          el.checked = el.value === data[el.name];
        } else {
          el.value = data[el.name];
        }
      }
    });
    
    // Handle conditional displays (like tatkal timing)
    const quotaSelect = document.getElementById('quota');
    if (quotaSelect) {
      const event = new Event('change');
      quotaSelect.dispatchEvent(event);
    }
    
    showNotification('Data loaded successfully!', 'success');
  });
}

function clearFormData() {
  // Clear the form
  document.getElementById('tatkalForm').reset();
  
  // Clear the storage
  chrome.storage.local.remove('formData', () => {
    showNotification('All saved data has been cleared!', 'success');
  });
}

function connectToIRCTC() {
  // Basic validation before connecting
  if (!validateRequiredFields()) {
    showNotification('Please fill all required fields correctly', 'error');
    return;
  }
  
  // Save form data before connecting
  saveFormData();
  
  // Send message to content script to connect to IRCTC
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url.includes('irctc.co.in')) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'connect'});
      showNotification('Connecting to IRCTC...', 'info');
    } else {
      // Open IRCTC in a new tab if not already opened
      chrome.tabs.create({url: 'https://www.irctc.co.in/'}, function(tab) {
        // We can't immediately send messages to a newly created tab
        // So we'll save a flag that the content script will check when it loads
        chrome.storage.local.set({autoConnect: true});
      });
    }
  });
}

function validateRequiredFields() {
  const form = document.getElementById('tatkalForm');
  let isValid = true;
  
  // Clear previous error messages
  document.querySelectorAll('.error-message').forEach(el => el.remove());
  
  // Check all required fields
  [...form.elements].forEach(el => {
    if (el.hasAttribute('required') && !el.value.trim()) {
      isValid = false;
      showFieldError(el, 'This field is required');
    }
    
    // Validate patterns if specified
    if (el.hasAttribute('pattern') && el.value.trim()) {
      const pattern = new RegExp(el.getAttribute('pattern'));
      if (!pattern.test(el.value.trim())) {
        isValid = false;
        showFieldError(el, 'Invalid format');
      }
    }
    
    // Validate number ranges
    if (el.type === 'number' && el.value.trim()) {
      const min = Number(el.getAttribute('min'));
      const max = Number(el.getAttribute('max'));
      const val = Number(el.value);
      
      if (el.hasAttribute('min') && val < min) {
        isValid = false;
        showFieldError(el, `Minimum value is ${min}`);
      }
      if (el.hasAttribute('max') && val > max) {
        isValid = false;
        showFieldError(el, `Maximum value is ${max}`);
      }
    }
    
    // Validate email format
    if (el.type === 'email' && el.value.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(el.value.trim())) {
        isValid = false;
        showFieldError(el, 'Invalid email format');
      }
    }
  });
  
  return isValid;
}

function showFieldError(element, message) {
  // Add error styling to the element
  element.classList.add('error');
  
  // Create and append error message
  const errorMessage = document.createElement('div');
  errorMessage.className = 'error-message';
  errorMessage.textContent = message;
  
  // Append after the element
  if (element.nextElementSibling && element.nextElementSibling.classList.contains('error-message')) {
    element.nextElementSibling.textContent = message;
  } else {
    element.parentNode.insertBefore(errorMessage, element.nextElementSibling);
  }
}

function showNotification(message, type = 'info') {
  // You could implement a nicer notification system here
  // For now, we'll use alert
  // alert(message);
  console.log(message);
}

function setupValidation() {
  const form = document.getElementById('tatkalForm');
  
  // Add real-time validation on blur
  [...form.elements].forEach(el => {
    el.addEventListener('blur', function() {
      if (this.hasAttribute('required') || this.value.trim() !== '') {
        validateField(this);
      }
    });
    
    // Clear error styling on input
    el.addEventListener('input', function() {
      this.classList.remove('error');
      const errorMessage = this.nextElementSibling;
      if (errorMessage && errorMessage.classList.contains('error-message')) {
        errorMessage.remove();
      }
    });
  });
}

function validateField(field) {
  // Clear previous error for this field
  field.classList.remove('error');
  const nextSibling = field.nextElementSibling;
  if (nextSibling && nextSibling.classList.contains('error-message')) {
    nextSibling.remove();
  }
  
  // Check required
  if (field.hasAttribute('required') && !field.value.trim()) {
    showFieldError(field, 'This field is required');
    return false;
  }
  
  // Validate pattern
  if (field.hasAttribute('pattern') && field.value.trim()) {
    const pattern = new RegExp(field.getAttribute('pattern'));
    if (!pattern.test(field.value.trim())) {
      showFieldError(field, 'Invalid format');
      return false;
    }
  }
  
  // Validate number ranges
  if (field.type === 'number' && field.value.trim()) {
    const min = Number(field.getAttribute('min'));
    const max = Number(field.getAttribute('max'));
    const val = Number(field.value);
    
    if (field.hasAttribute('min') && val < min) {
      showFieldError(field, `Minimum value is ${min}`);
      return false;
    }
    if (field.hasAttribute('max') && val > max) {
      showFieldError(field, `Maximum value is ${max}`);
      return false;
    }
  }
  
  // Validate email
  if (field.type === 'email' && field.value.trim()) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(field.value.trim())) {
      showFieldError(field, 'Invalid email format');
      return false;
    }
  }
  
  return true;
}
