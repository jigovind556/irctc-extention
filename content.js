let shouldAutoFill = false;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "connect") {
    shouldAutoFill = true;
    console.log("IRCTC Tatkal Helper: Connect triggered");

    autofillForm(); // Initial autofill
  }
});

// Detect URL changes by monkey-patching pushState and replaceState
(function () {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function () {
    originalPushState.apply(this, arguments);
    window.dispatchEvent(new Event("urlchange"));
  };

  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    window.dispatchEvent(new Event("urlchange"));
  };

  window.addEventListener("popstate", () => {
    window.dispatchEvent(new Event("urlchange"));
  });
})();

// Trigger autofillForm on URL change, if connect was triggered
window.addEventListener("urlchange", () => {
  if (shouldAutoFill) {
    console.log("IRCTC Tatkal Helper: URL changed");
    setTimeout(() => {
      autofillForm();
    }, 2000); // Slight delay to allow new DOM to load
  }
});

// On content script load, optionally auto-connect
chrome.storage.local.get("autoConnect", function (data) {
  if (data.autoConnect) {
    chrome.storage.local.remove("autoConnect");
    shouldAutoFill = true;
    setTimeout(autofillForm, 2000);
  }
});

// Main function to autofill the IRCTC form
async function autofillForm() {
  console.log("IRCTC Tatkal Helper: Starting autofill...");

  chrome.storage.local.get("formData", async (result) => {
    const data = result.formData;
    if (!data) {
      console.log("IRCTC Tatkal Helper: No saved data found");
      return;
    }

    console.log("IRCTC Tatkal Helper: Retrieved data for autofill", data);

    try {
      // The autofill logic will depend on the current page URL and structure

      // 1. Check if we're on the login page
      if (window.location.href.includes("login")) {
        fillLoginForm(data);
      }
      // 2. Check if we're on the booking page
      else if (window.location.href.includes("train-search")) {
        await fillBookingForm(data);
      }
      // 3. Select the Train Search tab if not already selected
      else if (window.location.href.includes("train-list")) {
        await selectTrain(data);
      }
      // 3. Check if we're on the passenger details page
      else if (window.location.href.includes("psgninput")) {
        await fillPassengerDetails(data);
      }
      // 4. Check if we're on the payment page
      else if (window.location.href.includes("bkgPaymentOptions")) {
        await MakePayment();
      } else {
        console.log(
          "IRCTC Tatkal Helper: Current page not recognized for autofill"
        );
      }
    } catch (error) {
      console.error("IRCTC Tatkal Helper: Error during autofill", error);
    }
  });
}

function fillLoginForm(data) {
  console.log("IRCTC Tatkal Helper: Attempting to fill login form");

  // These selectors need to be updated based on the actual IRCTC login form structure
  const usernameField = document.querySelector(
    'input[type="text"][formcontrolname="userid"], input[name="username"]'
  );
  const passwordField = document.querySelector(
    'input[type="password"][formcontrolname="password"], input[name="password"]'
  );
  const loginButton = document.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (usernameField && data.username) {
    usernameField.value = data.username;
    triggerEvent(usernameField, "input");
    console.log("IRCTC Tatkal Helper: Username filled");
  }

  if (passwordField && data.password) {
    passwordField.value = data.password;
    triggerEvent(passwordField, "input");
    console.log("IRCTC Tatkal Helper: Password filled");
  }

  // Auto login if tatkal_timing is checked and the current time is close to tatkal booking time
  if (data.tatka1l_timing && loginButton && shouldAutoLogin()) {
    console.log("IRCTC Tatkal Helper: Auto login triggered");
    loginButton.click();
  }
}
async function fillBookingForm(data) {
  console.log("IRCTC Tatkal Helper: Attempting to fill booking form");

  const triggerEvent = (el, type) => {
    const event = new Event(type, { bubbles: true });
    el.dispatchEvent(event);
  };
  const OutsideClick = () => {
    const outsideClick = document.createElement("div");
    outsideClick.style.position = "absolute";
    outsideClick.style.top = "0";
    outsideClick.style.left = "0";
    outsideClick.style.width = "1px";
    outsideClick.style.height = "1px";
    outsideClick.style.pointerEvents = "none"; // Make it non-interactive
    document.body.appendChild(outsideClick);
    outsideClick.click();
    document.body.removeChild(outsideClick);
  };

  const setInputValue = (selector, value) => {
    const input = document.querySelector(selector);
    if (input) {
      input.value = value;
      triggerEvent(input, "input");
      triggerEvent(input, "change");
      // click outside to trigger any blur events
      OutsideClick();
      return true;
    }
    return false;
  };

  const setDropdownValue = async (dropdownSelector, value) => {
    return new Promise((resolve, reject) => {
      try {
        const dropdown = document.querySelector(dropdownSelector);
        if (!dropdown) {
          console.warn(`Dropdown not found: ${dropdownSelector}`);
          return reject(false);
        }
        console.log("dropdown found:", dropdownSelector, dropdown);
        OutsideClick();
        // Open the dropdown
        dropdown.click();
        // reject(false);
        let attempts = 0;
        const maxAttempts = 20; // ~2 seconds (100ms * 20)

        const interval = setInterval(() => {
          const options = document.querySelectorAll(".ui-dropdown-item");
          console.log(
            "IRCTC Tatkal Helper: Checking dropdown options",
            options.length
          );

          for (let opt of options) {
            if (
              opt.innerText.trim().toLowerCase() === value.trim().toLowerCase()
            ) {
              opt.click();
              console.log(
                `IRCTC Tatkal Helper: Selected "${value}" in dropdown ${dropdownSelector}`
              );
              clearInterval(interval);
              return resolve(true);
            }
          }

          attempts++;
          if (attempts >= maxAttempts) {
            console.warn(
              `IRCTC Tatkal Helper: Failed to select "${value}" in ${dropdownSelector}`
            );
            clearInterval(interval);
            return reject(false);
          }
        }, 100);
      } catch (error) {
        console.error(
          `IRCTC Tatkal Helper: Error setting dropdown value for ${dropdownSelector}`,
          error
        );
        return reject(false);
      }
    });
  };

  // Fill "From" Station
  if (data.from) {
    console.log("Filling From Station:", data.from);
    setInputValue('p-autocomplete[formcontrolname="origin"] input', data.from);
    console.log("Filled From");
  }

  // Fill "To" Station
  if (data.to) {
    setInputValue(
      'p-autocomplete[formcontrolname="destination"] input',
      data.to
    );
    console.log("Filled To");
  }

  // Fill Date (ensure date is in correct format like DD/MM/YYYY)
  if (data.date) {
    setInputValue('p-calendar[formcontrolname="journeyDate"] input', data.date);
    console.log("Filled Journey Date");
  }

  // Select Class
  if (data.class) {
    let res = await setDropdownValue(
      'p-dropdown[formcontrolname="journeyClass"] .ui-dropdown-label',
      data.class
    );
    console.log("Selected Class");
  }

  // Select Quota
  if (data.quota) {
    await setDropdownValue(
      'p-dropdown[formcontrolname="journeyQuota"] .ui-dropdown-label',
      data.quota
    );
    console.log("Selected Quota");
  }

  // Trigger Search button
  const searchButton = document.querySelector('button[type="submit"]');
  if (searchButton && data.tatkal_timing && shouldAutoSearch()) {
    console.log("Auto search triggered");
    searchButton.click();
  }
}

async function selectTrain(data) {
  // document.querySelectorAll("p-tabmenu .hidden-x")[0].innerText;
  // Get all train cards
  console.log("IRCTC Tatkal Helper: Attempting to select train");
  const trainCards = document.querySelectorAll("app-train-avl-enq");
  if (trainCards.length === 0) {
    console.log("IRCTC Tatkal Helper: No train cards found");
    return;
  }
  console.log(`IRCTC Tatkal Helper: Found ${trainCards.length} train cards`);
  // Loop through each train card
  for (const card of trainCards) {
    // Get train number and name
    // const trainNumber = card.querySelector(".train-number")?.innerText.trim();
    const trainName = card.querySelector(".train-heading").innerText.trim();

    // Check if this train matches the user's preference
    if (data.train && trainName.includes(data.train)) {
      const trainNumber = data.train;
      console.log(`IRCTC Tatkal Helper: Selecting train ${trainName}`);
      // Find the classes available for this train
      let classes = card.querySelectorAll("td");
      let query = ".link";
      if (classes.length === 0) {
        classes = card.querySelector(".ui-tabmenu-nav");
        query = ".ui-tabmenuitem a";
      }
      // Loop through each class
      for (const cls of classes) {
        // Check if the class matches the user's preference
        if (cls.innerText.includes(data.class)) {
          console.log(
            `IRCTC Tatkal Helper: Class ${data.class} found for train ${trainName}`
          );
          // Find the select button for this class
          const selectButton = cls.querySelector(query);
          if (selectButton) {
            selectButton.click();
            console.log(
              `IRCTC Tatkal Helper: Train ${trainNumber} class ${data.class} selected`
            );
            break; // Exit the loop after selecting the class
          } else {
            console.warn(
              `IRCTC Tatkal Helper: No select button found for train ${trainNumber}`
            );
          }
        }
      }

      // wait for the available seats to load
      // Wait for the availability grid to load
      const availabilityTable = await waitForElementWithin(
        card,
        ".ui-tabmenu-nav",
        80000
      );
      if (!availabilityTable) {
        console.warn("IRCTC Tatkal Helper: Availability table not found");
        continue;
      }
      // Match the date in the availability table
      const cells = card.querySelectorAll("td");
      console.log("cells:", cells.length);
      let dateMatched = false;
      // Format date (e.g., 2025-05-28 → "Wed, 28 May")
      const dateObj = new Date(data.date);
      const options = { weekday: "short", day: "2-digit", month: "short" };
      const formattedDate = dateObj
        .toLocaleDateString("en-GB", options)
        .replace(",", "");

      console.log(`IRCTC Tatkal Helper: Looking for date ${formattedDate}`);
      // click on the div containing date and available seats

      for (const cell of cells) {
        const dateText = cell.innerText.trim().replace(",", ""); // Remove any commas
        console.log(`IRCTC Tatkal Helper: Checking cell date - ${dateText}`);
        if (dateText.includes(formattedDate)) {
          const div = cell.querySelector(".pre-avl");
          if (div) {
            div.click(); // Click the availability cell
            dateMatched = true;
            console.log(
              `IRCTC Tatkal Helper: Clicked on date cell - ${data.date}`
            );
            break;
          }
        }
      }

      // click on the book button
      if (!dateMatched) {
        console.warn(
          `IRCTC Tatkal Helper: Desired date not found - ${data.date}`
        );
        continue;
      }

      // Wait for and click "Book Now" button
      const bookBtn = await waitForElementWithin(card, "button", 80000, (el) =>
        el.innerText.includes("Book Now")
      );

      if (bookBtn) {
        bookBtn.click();
        console.log("IRCTC Tatkal Helper: Book Now button clicked");
        return;
      } else {
        console.warn("IRCTC Tatkal Helper: Book Now button not found");
      }
    }
  }
}

// Utility to wait for a specific element within a container
function waitForElementWithin(
  container,
  selector,
  timeout = 5000,
  filterFn = null
) {
  return new Promise((resolve) => {
    const interval = 100;
    const maxAttempts = timeout / interval;
    let attempts = 0;

    const check = () => {
      const elements = container.querySelectorAll(selector);
      const target = filterFn
        ? [...elements].find(filterFn)
        : elements.length > 0
        ? elements[0]
        : null;
      console.log(
        `IRCTC Tatkal Helper: Checking for element ${selector}, found: ${elements.length}`
      );
      console.log(`IRCTC Tatkal Helper: Target element found: ${target}`);
      if (target) {
        resolve(target);
      } else if (attempts++ >= maxAttempts) {
        resolve(null);
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
}

// Utility to wait for a specific element in the document
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    // Check if element already exists
    const existingElement = document.querySelector(selector);
    if (existingElement) {
      console.log(`IRCTC Tatkal Helper: Element ${selector} found immediately`);
      return resolve(existingElement);
    }

    // If not, set up observer and wait for it
    const interval = 100;
    const maxAttempts = timeout / interval;
    let attempts = 0;

    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        console.log(
          `IRCTC Tatkal Helper: Element ${selector} found after waiting`
        );
        resolve(element);
      } else if (attempts++ >= maxAttempts) {
        console.warn(
          `IRCTC Tatkal Helper: Element ${selector} not found after ${timeout}ms`
        );
        resolve(null);
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

async function fillPassengerDetails(data) {
  console.log("IRCTC Tatkal Helper: Attempting to fill passenger details");

  // Wait for passenger form to be ready
  await waitForElement("app-passenger");
  console.log("IRCTC Tatkal Helper: Passenger form found");

  // Determine how many passengers we need to add
  let passengerCount = 0;
  for (let i = 1; i <= 4; i++) {
    const nameKey = `p${i}_name`;
    if (data[nameKey] && data[nameKey].trim() !== "") {
      passengerCount++;
    }
  }

  console.log(`IRCTC Tatkal Helper: Need to fill ${passengerCount} passengers`);

  // Fill the first passenger
  if (data.p1_name && data.p1_name.trim() !== "") {
    await fillSinglePassenger(
      1,
      data.p1_name,
      data.p1_age,
      data.p1_gender,
      data.p1_berth,
      data.p1_nationality
    );
  }

  // Add additional passengers if needed
  if (passengerCount > 1) {
    for (let i = 2; i <= passengerCount; i++) {
      const nameKey = `p${i}_name`;
      const ageKey = `p${i}_age`;
      const genderKey = `p${i}_gender`;
      const berthKey = `p${i}_berth`;
      const nationalityKey = `p${i}_nationality`;

      if (data[nameKey] && data[nameKey].trim() !== "") {
        // Click the "Add Passenger" button
        const addPassengerButton = document.querySelector(
          "a span.prenext:first-child"
        );
        if (addPassengerButton) {
          console.log(`IRCTC Tatkal Helper: Adding passenger #${i}`);
          addPassengerButton.click();

          // Wait for the new passenger form to be added
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Fill the new passenger's details
          await fillSinglePassenger(
            i,
            data[nameKey],
            data[ageKey],
            data[genderKey],
            data[berthKey],
            data[nationalityKey]
          );
        } else {
          console.warn("IRCTC Tatkal Helper: Add Passenger button not found");
        }
      }
    }
  }

  // Fill contact details
  // const mobileField = document.querySelector(
  //   'input[formcontrolname="mobileNumber"], input[name="mobileNumber"]'
  // );
  // const emailField = document.querySelector(
  //   'input[formcontrolname="email"], input[name="email"]'
  // );

  // if (mobileField && data.mobile) {
  //   mobileField.value = data.mobile;
  //   triggerEvent(mobileField, "input");
  //   console.log("IRCTC Tatkal Helper: Mobile number filled");
  // }

  // if (emailField && data.email) {
  //   emailField.value = data.email;
  //   triggerEvent(emailField, "input");
  //   console.log("IRCTC Tatkal Helper: Email filled");
  // }

  // Handle preferences
  await handlePreferences(data);

  // Handle insurance
  // await handleInsurance(data);

  // Handle payment options
  await selectPaymentOption(data);
  console.log("IRCTC Tatkal Helper: Passenger details filled");
  // Auto submit if tatkal_timing is checked and the current time is close to tatkal booking time
  const continueButton = document.querySelector(
    'button[type="submit"], button.btn-primary'
  );
  if (data.tatkal_timing && continueButton && shouldAutoSubmit()) {
    console.log("IRCTC Tatkal Helper: Auto submit passenger details");
    continueButton.click();
  }
}

async function fillSinglePassenger(
  index,
  name,
  age,
  gender,
  berth,
  nationality
) {
  console.log(`IRCTC Tatkal Helper: Filling details for passenger #${index}`);

  // Get all passenger forms
  const passengerForms = document.querySelectorAll("app-passenger");

  // Calculate the actual index (0-based)
  const formIndex = index - 1;

  if (formIndex >= passengerForms.length) {
    console.warn(`IRCTC Tatkal Helper: Form for passenger #${index} not found`);
    return;
  }

  const passengerForm = passengerForms[formIndex];

  // Get the form fields for this passenger
  const nameField = passengerForm.querySelector('input[placeholder="Name"]');
  const ageField = passengerForm.querySelector(
    'input[formcontrolname="passengerAge"]'
  );
  const genderField = passengerForm.querySelector(
    'select[formcontrolname="passengerGender"]'
  );
  const berthField = passengerForm.querySelector(
    'select[formcontrolname="passengerBerthChoice"]'
  );
  const nationalityField = passengerForm.querySelector(
    'select[formcontrolname="passengerNationality"]'
  );

  // Fill name
  if (nameField && name) {
    nameField.value = name;
    triggerEvent(nameField, "input");
    triggerEvent(nameField, "change");
    console.log(
      `IRCTC Tatkal Helper: Passenger #${index} name filled: ${name}`
    );
  } else {
    console.warn(
      `IRCTC Tatkal Helper: Name field for passenger #${index} not found`
    );
  }

  // Fill age
  if (ageField && age) {
    ageField.value = age;
    triggerEvent(ageField, "input");
    triggerEvent(ageField, "change");
    console.log(`IRCTC Tatkal Helper: Passenger #${index} age filled: ${age}`);
  } else {
    console.warn(
      `IRCTC Tatkal Helper: Age field for passenger #${index} not found`
    );
  }

  // Select gender
  if (genderField && gender) {
    await selectDropdownOption(genderField, mapGender(gender));
    console.log(
      `IRCTC Tatkal Helper: Passenger #${index} gender selected: ${gender}`
    );
  } else {
    console.warn(
      `IRCTC Tatkal Helper: Gender field for passenger #${index} not found`
    );
  }

  // Select berth preference
  if (berthField && berth) {
    await selectDropdownOption(berthField, mapBerth(berth));
    console.log(
      `IRCTC Tatkal Helper: Passenger #${index} berth preference selected: ${berth}`
    );
  } else {
    console.warn(
      `IRCTC Tatkal Helper: Berth field for passenger #${index} not found`
    );
  }

  // Select nationality
  if (nationalityField && nationality) {
    await selectDropdownOption(
      nationalityField,
      nationality === "India" ? "IN" : nationality
    );
    console.log(
      `IRCTC Tatkal Helper: Passenger #${index} nationality selected: ${nationality}`
    );
  } else {
    console.warn(
      `IRCTC Tatkal Helper: Nationality field for passenger #${index} not found`
    );
  }
}

// Helper function to map gender values to IRCTC's values
function mapGender(gender) {
  gender = gender.toLowerCase();
  if (gender === "male") return "M";
  if (gender === "female") return "F";
  if (gender === "other" || gender === "transgender") return "T";
  return gender;
}

// Helper function to map berth preference values to IRCTC's values
function mapBerth(berth) {
  berth = berth.toLowerCase();
  if (berth === "lower") return "LB";
  if (berth === "middle") return "MB";
  if (berth === "upper") return "UB";
  if (berth === "side lower") return "SL";
  if (berth === "side upper") return "SU";
  return "";
}

// Helper function to select an option from a dropdown
async function selectDropdownOption(selectElement, value) {
  if (!selectElement || !value) return;

  // Try to match by value or text
  for (let i = 0; i < selectElement.options.length; i++) {
    const option = selectElement.options[i];
    if (
      option.value === value ||
      option.text === value ||
      option.value.toLowerCase() === value.toLowerCase() ||
      option.text.toLowerCase() === value.toLowerCase()
    ) {
      selectElement.selectedIndex = i;
      triggerEvent(selectElement, "change");
      return;
    }
  }

  console.warn(
    `IRCTC Tatkal Helper: Could not find option ${value} in dropdown`
  );
}

async function handlePreferences(data) {
  // Auto upgrade checkbox
  // const upgradeCheckbox = await waitForElement(
  //   'input[formcontrolname="autoUpgrade"], input[name="autoUpgrade"]'
  // );
  // if (upgradeCheckbox && data.auto_upgrade !== undefined) {
  //   upgradeCheckbox.checked = data.auto_upgrade;
  //   triggerEvent(upgradeCheckbox, "change");
  //   console.log("IRCTC Tatkal Helper: Auto upgrade preference set");
  // }

  // Confirm only checkbox
  const confirmOnlyCheckbox = document.querySelector('input[formcontrolname="bookOnlyIfCnf"]');
  if (confirmOnlyCheckbox && data.confirm_only !== undefined) {
    // confirmOnlyCheckbox.checked = data.confirm_only;
    // triggerEvent(confirmOnlyCheckbox, "change");
    confirmOnlyCheckbox.click();
    console.log("IRCTC Tatkal Helper: Confirm berths only preference set");
  }

  // Reservation choice
  // const reservationChoiceField = document.querySelector(
  //   'select[formcontrolname="reservationChoice"], select[name="reservationChoice"]'
  // );
  // if (reservationChoiceField && data.reservation_choice) {
  //   await selectDropdownOption(reservationChoiceField, data.reservation_choice);
  //   console.log("IRCTC Tatkal Helper: Reservation choice selected");
  // }

  // Coach preference
  // const coachField = document.querySelector(
  //   'input[formcontrolname="coachNumber"], input[name="coachNumber"]'
  // );
  // if (coachField && data.coach) {
  //   coachField.value = data.coach;
  //   triggerEvent(coachField, "input");
  //   console.log("IRCTC Tatkal Helper: Coach preference filled");
  // }
}

async function handleInsurance(data) {
  // Insurance radio buttons
  const insuranceSection = await waitForElement(
    'input[formcontrolname="travelInsurance"], input[name="travelInsurance"]',
    3000
  );
  if (!insuranceSection) {
    console.warn("IRCTC Tatkal Helper: Insurance section not found");
    return;
  }

  const yesInsuranceRadio = document.querySelector(
    'input[formcontrolname="travelInsurance"][value="Yes"], input[name="travelInsurance"][value="Yes"]'
  );
  const noInsuranceRadio = document.querySelector(
    'input[formcontrolname="travelInsurance"][value="No"], input[name="travelInsurance"][value="No"]'
  );

  if (data.insurance === "yes" && yesInsuranceRadio) {
    yesInsuranceRadio.checked = true;
    triggerEvent(yesInsuranceRadio, "change");
    console.log("IRCTC Tatkal Helper: Travel insurance selected: Yes");
  } else if (noInsuranceRadio) {
    noInsuranceRadio.checked = true;
    triggerEvent(noInsuranceRadio, "change");
    console.log("IRCTC Tatkal Helper: Travel insurance selected: No");
  }
}

async function selectPaymentOption(data) {
  console.log("IRCTC Tatkal Helper: Attempting to select payment option");

  // Wait for payment section to be ready
  await waitForElement('table', 5000);
  console.log("IRCTC Tatkal Helper: Payment options found");

  if (data.payment === "card") {
    // selected by default on the website
    console.log("IRCTC Tatkal Helper: Card payment option selected");
  } else if (data.payment === "upi") {
    // Try finding by role and content
    const radioButtons = document.querySelectorAll('div[role="radio"]');
    for (const button of radioButtons) {
      if (
        button.closest("label").textContent.includes("BHIM") ||
        button.closest("label").textContent.includes("UPI")
      ) {
        console.log("IRCTC Tatkal Helper: Clicking UPI payment by role");
        button.click();
        break;
      }
    }
    console.warn("IRCTC Tatkal Helper: UPI payment option not found");

    console.log("IRCTC Tatkal Helper: UPI payment option selected");
  }

  // Wait a moment for payment option to register
  await new Promise((resolve) => setTimeout(resolve, 500));

}

// Helper functions

function selectOption(selectElement, value) {
  if (!selectElement || !value) return;

  // Try exact match
  for (let i = 0; i < selectElement.options.length; i++) {
    if (
      selectElement.options[i].value === value ||
      selectElement.options[i].text === value
    ) {
      selectElement.selectedIndex = i;
      triggerEvent(selectElement, "change");
      return;
    }
  }

  // Try case insensitive match
  const lowerValue = value.toLowerCase();
  for (let i = 0; i < selectElement.options.length; i++) {
    if (
      selectElement.options[i].value.toLowerCase() === lowerValue ||
      selectElement.options[i].text.toLowerCase() === lowerValue
    ) {
      selectElement.selectedIndex = i;
      triggerEvent(selectElement, "change");
      return;
    }
  }

  // Try partial match
  for (let i = 0; i < selectElement.options.length; i++) {
    if (
      selectElement.options[i].value.toLowerCase().includes(lowerValue) ||
      selectElement.options[i].text.toLowerCase().includes(lowerValue)
    ) {
      selectElement.selectedIndex = i;
      triggerEvent(selectElement, "change");
      return;
    }
  }
}

function triggerEvent(element, eventType) {
  if (!element) return;

  const event = new Event(eventType, { bubbles: true });
  element.dispatchEvent(event);
}

function shouldAutoLogin() {
  // Logic to determine if auto login should be triggered based on tatkal timing
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // For AC classes: 10:00 AM (Check 20 seconds before)
  // For Non-AC classes: 11:00 AM (Check 20 seconds before)
  return (
    // (hours === 9 && minutes === 59 && seconds >= 40) ||
    // (hours === 10 && minutes === 0 && seconds <= 15) ||
    // (hours === 10 && minutes === 59 && seconds >= 40) ||
    // (hours === 11 && minutes === 0 && seconds <= 15)
    true // For testing purposes, always return true
  );
}

function shouldAutoSearch() {
  // Similar logic as shouldAutoLogin
  return shouldAutoLogin();
}

function shouldAutoSubmit() {
  // Similar logic as shouldAutoLogin
  return shouldAutoLogin();
}

function shouldAutoContinue() {
  // Similar logic as shouldAutoLogin
  return shouldAutoLogin();
}


async function MakePayment() {
  try {
    console.log("IRCTC Tatkal Helper: Initiating payment process...");

    // Step 1: Select BHIM UPI payment option from sidebar
    const tabItems = Array.from(document.querySelectorAll('div[tabindex="0"]'));
    const bhimTab = tabItems.find((el) =>
      el.innerHTML.toUpperCase().includes("BHIM")
    );

    if (!bhimTab) {
      console.warn("IRCTC Tatkal Helper: BHIM UPI tab not found.");
      return;
    }

    bhimTab.click();
    console.log("IRCTC Tatkal Helper: BHIM UPI option selected.");

    // Step 2: Wait for Paytm bank option to appear and click it
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const bankOptions = Array.from(document.querySelectorAll(".bank-text"));
    const paytmOption = bankOptions.find((el) =>
      el.innerHTML.toUpperCase().includes("PAYTM")
    );

    if (!paytmOption) {
      console.warn("IRCTC Tatkal Helper: Paytm payment option not found.");
      return;
    }

    paytmOption.click();
    console.log("IRCTC Tatkal Helper: Paytm option selected.");

    // Step 3: Wait for the "Pay & Book" button to appear and click it
    let payButton = null;
    const maxRetries = 20;

    for (let i = 0; i < maxRetries; i++) {
      payButton = Array.from(document.querySelectorAll("button")).find(
        (btn) => btn.innerText.trim().toUpperCase() === "PAY & BOOK"
      );

      if (payButton) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (payButton) {
      payButton.click();
      console.log("IRCTC Tatkal Helper: Clicked on 'Pay & Book' button.");
    } else {
      console.warn(
        "IRCTC Tatkal Helper: 'Pay & Book' button not found after waiting."
      );
    }
  } catch (error) {
    console.error(
      "IRCTC Tatkal Helper: Error during MakePayment process:",
      error
    );
  }
}
