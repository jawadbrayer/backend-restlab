import 'dotenv/config'
import { fetchData, server } from './server'

const port = 8080

// Polling interval: Fetch data every 5 minutes
setInterval(fetchData, 300000)

// Initial fetch
fetchData()

// Start Express server
server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)
})
