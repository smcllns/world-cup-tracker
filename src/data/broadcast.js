// US broadcast & streaming for the 2026 World Cup.
//
// Every one of the 104 matches is carried in full by FOX/FS1 (English) and
// Telemundo/Universo (Spanish), so broadcast info is tournament-wide rather
// than per-match. FOX (English) and Telemundo (Spanish) are free over the air;
// FS1 and Universo are cable channels. Exact FOX-vs-FS1 channel assignments
// are confirmed closer to kickoff — check the FOX Sports app for the final call.
export const US_BROADCAST = {
  english: {
    language: 'English',
    tv: ['FOX', 'FS1'],
    freeOverTheAir: 'FOX',
    streaming: ['FOX One', 'Fubo', 'YouTube TV', 'Hulu + Live TV', 'Sling TV'],
  },
  spanish: {
    language: 'Spanish',
    tv: ['Telemundo', 'Universo'],
    freeOverTheAir: 'Telemundo',
    streaming: ['Peacock', 'Telemundo App', 'Fubo'],
  },
}
