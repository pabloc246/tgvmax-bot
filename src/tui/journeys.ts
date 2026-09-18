import * as inquirer from 'inquirer'
import * as ora from 'ora'
import BookerEntity from '../entities/booker.entity'
import { TrainlineAuthentifier, TrainlineSearcher, TrainlineBooker } from '../book/trainline'
import { getHumanDate } from '../utils/date'
import { title, table, success, error, warn, pause, dim } from './theme'
import { pickStation, pickDate, pickHourWindow, pickBooker, pickFromList, confirm, BACK } from './prompts'

export async function journeysMenu(): Promise<void> {
  title('Rechercher et réserver un trajet')

  const bookers = await BookerEntity.find()
  const booker = await pickBooker(bookers, { onlyTrainline: true })
  if (booker === BACK) return await pause()

  const from = await pickStation('Gare de départ')
  if (from === BACK) return
  const to = await pickStation('Gare d\'arrivée')
  if (to === BACK) return

  const date = await pickDate('Date du voyage', new Date())
  const hourWindow = await pickHourWindow()

  const authentifier = new TrainlineAuthentifier({ username: booker.username!, password: booker.password! })

  const authSpinner = ora('Connexion à Trainline…').start()
  const isValid = await authentifier.checkToken()
  if (!isValid) {
    const loginResponse = await authentifier.login()
    if (typeof loginResponse !== 'undefined') {
      authSpinner.fail('Connexion refusée par Trainline.')
      if ('captchaUrl' in loginResponse) {
        error(`Trainline demande une vérification manuelle : ouvrez ${loginResponse.captchaUrl} puis réessayez.`)
      }
      await pause()
      return
    }
  }
  authSpinner.succeed('Connecté à Trainline.')

  const searcher = new TrainlineSearcher(
    { from: from.sncfId, to: to.sncfId, date, ...hourWindow },
    authentifier
  )

  const searchSpinner = ora('Recherche des trains TGVMax disponibles…').start()
  const trips: ReturnType<TrainlineSearcher['formatTrip']>[] = []
  const booking: { segmentIds: string[]; folderId: string; searchId: string }[] = []
  try {
    for await (const { trips: found, lastDate } of searcher.getTrips()) {
      for (const trip of found) {
        const formatted = searcher.formatTrip(trip)
        trips.push(formatted)
        booking.push(formatted.book)
      }
      searchSpinner.text = `Recherche des trains TGVMax disponibles… (${trips.length} trouvé(s), jusqu'au ${getHumanDate(lastDate, false)})`
    }
  } finally {
    await searcher.destroy()
  }

  if (trips.length === 0) {
    searchSpinner.warn('Aucun train TGVMax disponible pour ce trajet à cette date.')
    await pause()
    return
  }
  searchSpinner.succeed(`${trips.length} train(s) TGVMax disponible(s).`)

  const t = table(['#', 'Départ', 'Arrivée'])
  trips.forEach((trip, i) => t.push([String(i + 1), trip.formattedDepartureDate, trip.formattedArrivalDate]))
  console.log(t.toString())

  const picked = await pickFromList(
    'Réserver quel train ?',
    trips.map((trip, i) => ({ trip, index: i })),
    ({ trip, index }) => `#${index + 1} : ${trip.formattedDepartureDate} → ${trip.formattedArrivalDate}`,
    '« Ne rien réserver'
  )
  if (picked === BACK) {
    await pause()
    return
  }

  if (!(await confirm(`Confirmer la réservation du train ${picked.trip.formattedDepartureDate} → ${picked.trip.formattedArrivalDate} ?`))) {
    await pause()
    return
  }

  const bookSpinner = ora('Réservation en cours…').start()
  const confirmation = await TrainlineBooker.bookAndPay(authentifier, booking[picked.index])
  if (typeof confirmation === 'undefined') {
    bookSpinner.fail('La réservation a échoué (place probablement déjà prise).')
    await pause()
    return
  }
  bookSpinner.succeed('Train réservé !')

  console.log('')
  for (const segment of confirmation.segments) {
    success(`Train ${segment.train_number ?? dim('inconnu')} — voiture ${segment.car ?? '?'}, siège ${segment.seat ?? '?'}`)
  }
  await pause()
}
