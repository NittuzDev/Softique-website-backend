import { Hono } from 'hono'

const app = new Hono()

// Rotta principale (Hello World di base)
app.get('/', (c) => {
  return c.text('Hello Cloudflare Workers!')
})

// Prima API: Ritorna un testo semplice (GET /api/saluto)
app.get('/api/saluto', (c) => {
  return c.text('Ciao! Questa è la prima API di test wewe.')
})

// Seconda API: Ritorna un oggetto JSON (GET /api/info)
app.get('/api/info', (c) => {
  const data = {
    status: "success",
    message: "Benvenuto nella seconda API!",
    timestamp: new Date().toISOString(),
    environment: "Cloudflare Worker"
  }
  return c.json(data)
})

export default app