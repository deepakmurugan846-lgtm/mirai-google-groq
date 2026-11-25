// Paste this file into Extensions > Apps Script from the Google response spreadsheet.
// Set WEBHOOK_URL and WEBHOOK_SECRET before saving.
const WEBHOOK_URL = "https://YOUR-RENDER-SERVICE.onrender.com/api/google-form-webhook";
const WEBHOOK_SECRET = "REPLACE_WITH_THE_SAME_SECRET_AS_SERVER_ENV";

function onFormSubmit(e) {
  const values = e.namedValues || {};
  const get = (label) => (values[label] && values[label][0]) ? values[label][0] : "";
  const payload = {
    registrationCode: get("Registration Code"),
    name: get("Full Name"),
    phone: get("Phone Number"),
    email: get("Email ID"),
    company: get("Company Name"),
    designation: get("Designation"),
    favorite: get("Which do you like the most?")
  };
  if (!payload.registrationCode) throw new Error("Registration Code is missing. Check the exact question title.");
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: { "x-webhook-secret": WEBHOOK_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  console.log("MIRAI webhook status:", response.getResponseCode(), response.getContentText());
}

// Run this once manually only if you want to check that Apps Script can execute.
// Do not run onFormSubmit manually; it requires a real form-submit event.
