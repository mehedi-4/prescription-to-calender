import { useState, useEffect } from 'react'
import userData from './assets/user.json'
import prescriptionData from './assets/prescription.json'
import {
  initializeMsal,
  signInWithMicrosoft,
  signOutFromMicrosoft,
  getAccessToken,
  graphConfig,
  msalInstance
} from './msalConfig'

// Generate calendar events from medicine prescription
const generateCalendarEvents = (medicine, startDate) => {
  const events = []
  const times = {
    morning: { hour: 9, minute: 0 },
    afternoon: { hour: 14, minute: 0 },
    evening: { hour: 21, minute: 0 }
  }

  // Parse dosage pattern (e.g., "1+1+1" -> [1, 1, 1])
  const dosages = medicine.dosagePattern.split('+').map(Number)

  for (let day = 0; day < medicine.days; day++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + day)

    // Morning dose (9 AM)
    if (dosages[0] === 1) {
      const eventStart = new Date(currentDate)
      eventStart.setHours(times.morning.hour, times.morning.minute, 0, 0)
      events.push(createEventObject(medicine.name, eventStart, '9:00 AM'))
    }

    // Afternoon dose (2 PM)
    if (dosages[1] === 1) {
      const eventStart = new Date(currentDate)
      eventStart.setHours(times.afternoon.hour, times.afternoon.minute, 0, 0)
      events.push(createEventObject(medicine.name, eventStart, '2:00 PM'))
    }

    // Evening dose (9 PM)
    if (dosages[2] === 1) {
      const eventStart = new Date(currentDate)
      eventStart.setHours(times.evening.hour, times.evening.minute, 0, 0)
      events.push(createEventObject(medicine.name, eventStart, '9:00 PM'))
    }
  }

  return events
}

// Create Microsoft Graph calendar event object
const createEventObject = (medicineName, startDateTime, timeLabel) => {
  const endDateTime = new Date(startDateTime)
  endDateTime.setMinutes(endDateTime.getMinutes() + 15) // 15 min event

  return {
    subject: `💊 Take ${medicineName}`,
    body: {
      contentType: 'HTML',
      content: `<p>Time to take your medicine: <strong>${medicineName}</strong></p><p>Scheduled time: ${timeLabel}</p><p><em>This is an automated reminder from your prescription calendar.</em></p>`
    },
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    reminderMinutesBeforeStart: 15,
    isReminderOn: true
  }
}

// Add events to Microsoft Calendar using Graph API (batch requests)
const addEventsToCalendar = async (events, onProgress) => {
  const accessToken = await getAccessToken()
  
  // Microsoft Graph batch API allows max 20 requests per batch
  const batchSize = 20
  const batches = []
  
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize))
  }

  let completedEvents = 0
  const results = []

  for (const batch of batches) {
    const batchRequests = batch.map((event, index) => ({
      id: `${completedEvents + index + 1}`,
      method: 'POST',
      url: '/me/calendar/events',
      headers: {
        'Content-Type': 'application/json'
      },
      body: event
    }))

    const response = await fetch(graphConfig.graphBatchEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: batchRequests })
    })

    const result = await response.json()
    results.push(...(result.responses || []))
    
    completedEvents += batch.length
    if (onProgress) {
      onProgress(completedEvents, events.length)
    }
  }

  return results
}

// Login Component
function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const user = userData.users.find(
      u => u.username === username && u.password === password
    )

    if (user) {
      onLogin(user)
    } else {
      setError('Invalid username or password')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-4xl">💊</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Medicine Reminder</h1>
          <p className="text-gray-500 mt-2">Sign in to view your prescriptions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition transform hover:scale-[1.02]"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Demo accounts: mehedi, hamga, igi, kalo</p>
          <p>Password: 1234</p>
        </div>
      </div>
    </div>
  )
}

// Prescription Card Component
function PrescriptionCard({ medicine }) {
  const getDosageDescription = (pattern) => {
    const parts = pattern.split('+').map(Number)
    const times = []
    if (parts[0] === 1) times.push('9:00 AM')
    if (parts[1] === 1) times.push('2:00 PM')
    if (parts[2] === 1) times.push('9:00 PM')
    return times.join(', ')
  }

  const getTotalDoses = (pattern, days) => {
    const parts = pattern.split('+').map(Number)
    const dosesPerDay = parts.reduce((a, b) => a + b, 0)
    return dosesPerDay * days
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
        <h3 className="text-xl font-bold text-white">{medicine.name}</h3>
      </div>
      
      <div className="p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <p className="text-sm text-gray-500">Dosage Pattern</p>
              <p className="font-semibold text-gray-800">{medicine.dosagePattern}</p>
            </div>
          </div>
          
          {/* <div className="flex items-center gap-3">
            <span className="text-2xl">🕐</span>
            <div>
              <p className="text-sm text-gray-500">Times</p>
              <p className="font-semibold text-gray-800">{getDosageDescription(medicine.dosagePattern)}</p>
            </div>
          </div> */}
          
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-semibold text-gray-800">{medicine.days} days</p>
            </div>
          </div>
          
          {/* <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="text-sm text-gray-500">Total Reminders</p>
              <p className="font-semibold text-gray-800">{getTotalDoses(medicine.dosagePattern, medicine.days)} events</p>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  )
}

// Dashboard Component
function Dashboard({ user, onLogout }) {
  const [msAccount, setMsAccount] = useState(null)
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const userPrescription = prescriptionData.prescriptions.find(
    p => p.username === user.username
  )

  // Initialize MSAL on component mount
  useEffect(() => {
    const init = async () => {
      try {
        const account = await initializeMsal()
        setMsAccount(account)
      } catch (err) {
        console.error('MSAL initialization error:', err)
      }
    }
    init()
  }, [])

  // Handle Microsoft sign in
  const handleMicrosoftSignIn = async () => {
    try {
      setError(null)
      const account = await signInWithMicrosoft()
      setMsAccount(account)
    } catch (err) {
      setError('Failed to sign in with Microsoft. Please try again.')
      console.error(err)
    }
  }

  // Handle Microsoft sign out
  const handleMicrosoftSignOut = async () => {
    try {
      await signOutFromMicrosoft()
      setMsAccount(null)
      setResult(null)
    } catch (err) {
      console.error(err)
    }
  }

  // Add all prescriptions to calendar
  const handleAddToCalendar = async () => {
    if (!userPrescription || userPrescription.medicines.length === 0) return

    setIsAddingToCalendar(true)
    setError(null)
    setResult(null)

    try {
      // If not signed in with Microsoft, sign in first
      if (!msAccount) {
        const account = await signInWithMicrosoft()
        setMsAccount(account)
      }

      // Generate all events for all medicines
      const allEvents = []
      const startDate = new Date()
      
      for (const medicine of userPrescription.medicines) {
        const events = generateCalendarEvents(medicine, startDate)
        allEvents.push(...events)
      }

      setProgress({ current: 0, total: allEvents.length })

      // Add all events to calendar
      const results = await addEventsToCalendar(allEvents, (current, total) => {
        setProgress({ current, total })
      })

      const successCount = results.filter(r => r.status >= 200 && r.status < 300).length
      const failCount = results.length - successCount

      setResult({
        success: successCount,
        failed: failCount,
        total: allEvents.length
      })

    } catch (err) {
      console.error('Error adding to calendar:', err)
      setError(err.message || 'Failed to add events to calendar. Please try again.')
    } finally {
      setIsAddingToCalendar(false)
    }
  }

  // Calculate total events
  const getTotalEvents = () => {
    if (!userPrescription) return 0
    return userPrescription.medicines.reduce((total, medicine) => {
      const dosages = medicine.dosagePattern.split('+').map(Number)
      const dosesPerDay = dosages.reduce((a, b) => a + b, 0)
      return total + (dosesPerDay * medicine.days)
    }, 0)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-xl">💊</span>
            </div>
            <span className="font-bold text-xl text-gray-800">Medicine Reminder</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              <span className="font-semibold">{user.fullname}</span>
            </span>
            <button
              onClick={onLogout}
              className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-gray-700 font-medium transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-4 mb-4 text-white">
          <h1 className="text-3xl font-bold">Welcome back, {user.fullname}! 👋</h1>
        </div>


        {/* Prescriptions Grid */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Prescriptions</h2>
        </div>

        {userPrescription && userPrescription.medicines.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userPrescription.medicines.map((medicine, index) => (
              <PrescriptionCard key={index} medicine={medicine} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <span className="text-6xl mb-4 block">📋</span>
            <p className="text-gray-500">You don't have any prescriptions at the moment.</p>
          </div>
        )}


        {/* Add to Calendar Section */}
        {userPrescription && userPrescription.medicines.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Add to Reminders to Microsoft Calendar</h2>
                {/* <p className="text-gray-500">
                  Add all {getTotalEvents()} medicine reminders to your Microsoft Calendar with one click.
                </p> */}
                
                {msAccount && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Connected as {msAccount.username}</span>
                    <button 
                      onClick={handleMicrosoftSignOut}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      (Disconnect)
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleAddToCalendar}
                disabled={isAddingToCalendar}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isAddingToCalendar ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Adding... {progress.current}/{progress.total}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm-.624 3.744h1.248v1.248h-1.248V3.744zm0 2.496h1.248v1.248h-1.248V6.24zM3.744 11.376h1.248v1.248H3.744v-1.248zm16.512 0h1.248v1.248h-1.248v-1.248zM6.24 8.88h1.248v1.248H6.24V8.88zm10.272 0h1.248v1.248h-1.248V8.88zM6.24 14.88h1.248v1.248H6.24v-1.248zm10.272 0h1.248v1.248h-1.248v-1.248zm-7.632 2.496h1.248v1.248H8.88v-1.248zm5.024 0h1.248v1.248h-1.248v-1.248z" />
                    </svg>
                    <span>Add Prescription to Calendar</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress Bar */}
            {isAddingToCalendar && progress.total > 0 && (
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Adding event {progress.current} of {progress.total}...
                </p>
              </div>
            )}

            {/* Result Message */}
            {result && (
              <div className={`mt-4 p-4 rounded-lg ${result.failed > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <div className="flex items-center gap-2">
                  {result.failed === 0 ? (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={result.failed === 0 ? 'text-green-700' : 'text-yellow-700'}>
                    {result.failed === 0 
                      ? `Successfully added ${result.success} events to your calendar!`
                      : `Added ${result.success} events. ${result.failed} events failed.`
                    }
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Check your Microsoft Calendar to see the reminders.
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-2 py-1">
        <div className="max-w-2xl mx-auto px-4 text-center text-gray-500">
          <p className="text-sm">Never miss your medicine again! 💊</p>
        </div>
      </footer>
    </div>
  )
}

// Main App Component
function App() {
  const [user, setUser] = useState(null)

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
  }

  const handleLogout = () => {
    setUser(null)
  }

  return (
    <>
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </>
  )
}

export default App
