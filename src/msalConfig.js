import { PublicClientApplication } from '@azure/msal-browser'

// Microsoft Azure AD App Registration Config
// To set up your own app:
// 1. Go to https://portal.azure.com
// 2. Navigate to Azure Active Directory > App registrations > New registration
// 3. Name your app, select "Single-page application (SPA)"
// 4. Set redirect URI to http://localhost:5173 (for development)
// 5. Copy the Application (client) ID and paste it below

const msalConfig = {
  auth: {
    clientId: 'bbd9dade-8788-4611-9fcc-4634829ce1fc', // Replace with your Azure AD App Client ID
    authority: 'https://login.microsoftonline.com/consumers',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// Scopes needed for calendar access
export const loginRequest = {
  scopes: ['User.Read', 'Calendars.ReadWrite'],
}

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphCalendarEndpoint: 'https://graph.microsoft.com/v1.0/me/calendar/events',
  graphBatchEndpoint: 'https://graph.microsoft.com/v1.0/$batch',
}

export const msalInstance = new PublicClientApplication(msalConfig)

// Initialize MSAL
export const initializeMsal = async () => {
  await msalInstance.initialize()
  
  // Handle redirect response
  const response = await msalInstance.handleRedirectPromise()
  if (response) {
    return response.account
  }
  
  // Check if user is already signed in
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length > 0) {
    return accounts[0]
  }
  
  return null
}

// Get access token
export const getAccessToken = async () => {
  const accounts = msalInstance.getAllAccounts()
  
  if (accounts.length === 0) {
    throw new Error('No accounts found')
  }
  
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    })
    return response.accessToken
  } catch (error) {
    // If silent token acquisition fails, use popup
    const response = await msalInstance.acquireTokenPopup(loginRequest)
    return response.accessToken
  }
}

// Sign in with popup
export const signInWithMicrosoft = async () => {
  try {
    const response = await msalInstance.loginPopup(loginRequest)
    return response.account
  } catch (error) {
    console.error('Login failed:', error)
    throw error
  }
}

// Sign out
export const signOutFromMicrosoft = async () => {
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length > 0) {
    await msalInstance.logoutPopup({
      account: accounts[0],
    })
  }
}
