import { Hono } from 'hono'
import { calendar } from '@googleapis/calendar'
import { google } from 'googleapis'

const app = new Hono()

const CALENDAR_ID = "la_tua_email_personale@gmail.com"

app.get('/api/slots-liberi', async (c) => {
  try {
    // 1. Recuperiamo i secrets dalle variabili d'ambiente di Cloudflare (c.env)
    // Assicurati che i nomi coincidano con quelli inseriti nei Secrets della dashboard
    const clientEmail = c.env.GOOGLE_CLIENT_EMAIL
    let privateKey = c.env.GOOGLE_PRIVATE_KEY

    if (!clientEmail || !privateKey) {
      return c.json({ status: "error", message: "Configurazione dei Secrets mancante su Cloudflare" }, 500)
    }

    // Fix cruciale per i Secrets: i ritorni a capo (\n) inseriti come testo nelle textbox dei segreti
    // spesso vengono letti come stringhe letterali. Questo rimpiazzo sistema la chiave.
    privateKey = privateKey.replace(/\\n/g, '\n')

    // 2. Inizializziamo l'autenticazione con i dati presi dai Secrets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      },
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })

    const googleCal = calendar({
      version: 'v3',
      auth: auth
    })

    // 3. Logica di recupero date (Prossimi 7 giorni)
    const oggi = new Date()
    const finePeriodo = new Date()
    finePeriodo.setDate(oggi.getDate() + 7)

    const response = await googleCal.freebusy.query({
      requestBody: {
        timeMin: oggi.toISOString(),
        timeMax: finePeriodo.toISOString(),
        items: [{ id: CALENDAR_ID }]
      }
    })

    const eventiOccupati = response.data.calendars[CALENDAR_ID].busy || []
    const risultato = []
    const giorniDellaSettimana = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"]

    for (let d = new Date(oggi); d <= finePeriodo; d.setDate(d.getDate() + 1)) {
      const limiteInizio = new Date(d)
      limiteInizio.setHours(9, 0, 0, 0)
      
      const limiteFine = new Date(d)
      limiteFine.setHours(19, 0, 0, 0)

      if (new Date() > limiteFine) continue

      const inizioEffettivo = new Date() > limiteInizio ? new Date() : limiteInizio

      const occupatiDelGiorno = eventiOccupati.filter(evento => {
        const inizioEv = new Date(evento.start)
        const fineEv = new Date(evento.end)
        return inizioEv < limiteFine && fineEv > inizioEffettivo
      }).sort((a, b) => new Date(a.start) - new Date(b.start))

      const slotsLiberi = []
      let oraCorrente = new Date(inizioEffettivo)

      for (const blocco of occupatiDelGiorno) {
        const inizioOccupato = new Date(blocco.start)
        const fineOccupato = new Date(blocco.end)

        if (inizioOccupato > oraCorrente) {
          slotsLiberi.push({
            inizio: formattaOra(oraCorrente),
            fine: formattaOra(inizioOccupato)
          })
        }
        if (fineOccupato > oraCorrente) {
          oraCorrente = new Date(fineOccupato)
        }
      }

      if (oraCorrente < limiteFine) {
        slotsLiberi.push({
          inizio: formattaOra(oraCorrente),
          fine: formattaOra(limiteFine)
        })
      }

      const dataFormattata = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`

      risultato.push({
        data: dataFormattata,
        giorno: giorniDellaSettimana[d.getDay()],
        slots: slotsLiberi
      })
    }

    return c.json(risultato)

  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500)
  }
})

function formattaOra(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default app