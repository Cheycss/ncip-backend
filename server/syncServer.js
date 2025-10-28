// Simple sync server for cross-device localStorage synchronization
import express from 'express'
import cors from 'cors'
const app = express()

// In-memory storage for development sync
const syncData = {
  ncip_purposes: [],
  ncip_services: [],
  applications: [],
  users: [],
  pendingRegistrations: []
}

app.use(cors())
app.use(express.json())

// Get data endpoint
app.get('/api/sync/:key', (req, res) => {
  const { key } = req.params
  res.json({
    data: syncData[key] || [],
    timestamp: Date.now()
  })
})

// Update data endpoint
app.post('/api/sync/:key', (req, res) => {
  const { key } = req.params
  const { data } = req.body
  
  syncData[key] = data
  console.log(`Synced ${key}: ${data.length} items`)
  
  res.json({ success: true, timestamp: Date.now() })
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', syncKeys: Object.keys(syncData) })
})

const PORT = 3002
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sync server running on http://localhost:${PORT}`)
  console.log(`Network access: http://192.168.68.59:${PORT}`)
})
