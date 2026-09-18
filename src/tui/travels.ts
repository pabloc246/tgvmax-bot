import * as inquirer from 'inquirer'
import * as chalk from 'chalk'
import TravelEntity from '../entities/travel.entity'
import BookerEntity from '../entities/booker.entity'
import NotifierEntity from '../entities/notifier.entity'
import { BookerType } from '../book/interface'
import { trainlineStations } from '../book/trainline'
import { getHumanDate } from '../utils/date'
import { title, table, success, warn, pause, dim, yesNo } from './theme'
import { pickStation, pickDate, pickHourWindow, pickBooker, pickNotifier, pickFromList, confirm, BACK } from './prompts'

const stationName = (sncfId: string) => trainlineStations.find(s => s.sncfId === sncfId)?.name ?? sncfId

async function listTravels(): Promise<TravelEntity[]> {
  const travels = await TravelEntity.find({ relations: ['notifier', 'booker', 'cron'] })
  travels.sort((a, b) => a.date.getTime() - b.date.getTime())

  title('Alertes')
  if (travels.length === 0) {
    console.log(dim('  Aucune alerte pour le moment.'))
    return travels
  }
  const t = table(['#', 'Trajet', 'Date', 'Statut', 'Notif.', 'Compte', 'Récurrente'])
  travels.forEach(tr => {
    const status = tr.book ? (tr.booked ? 'réservé' : 'à réserver') : 'veille'
    t.push([
      String(tr.id),
      `${stationName(tr.from)} → ${stationName(tr.to)}`,
      getHumanDate(new Date(tr.date), false),
      tr.booked ? chalk.green(status) : status,
      tr.notifier?.name ?? dim('—'),
      tr.booker?.name ?? dim('—'),
      yesNo(!!tr.cron),
    ])
  })
  console.log(t.toString())
  return travels
}

async function createTravel(): Promise<void> {
  title('Nouvelle alerte')

  const from = await pickStation('Gare de départ')
  if (from === BACK) return
  const to = await pickStation('Gare d\'arrivée')
  if (to === BACK) return

  const inSevenDays = new Date()
  inSevenDays.setDate(inSevenDays.getDate() + 7)
  const date = await pickDate('Date du voyage', inSevenDays)

  const hourWindow = await pickHourWindow()

  const notifiers = await NotifierEntity.find()
  const notifier = await pickNotifier(notifiers)
  if (notifier === BACK) return

  const bookers = await BookerEntity.find()
  const booker = await pickBooker(bookers)
  if (booker === BACK) return

  const book = await confirm('Réserver automatiquement dès qu\'une place TGVMax est trouvée ?', false)
  if (book && booker.type !== BookerType.trainline) {
    warn('Ce compte ne permet pas la réservation automatique : vous serez seulement notifié, il faudra réserver vous-même.')
  }

  await TravelEntity.insertAndCrawl({
    from: from.sncfId,
    to: to.sncfId,
    date,
    ...hourWindow,
    notifier: { id: notifier.id } as NotifierEntity,
    booker: { id: booker.id } as BookerEntity,
    book,
  })
  success(`Alerte créée pour ${from.name} → ${to.name} le ${getHumanDate(date, false)}. La veille a démarré.`)
}

async function deleteTravel(travels: TravelEntity[]): Promise<void> {
  const picked = await pickFromList(
    'Quelle alerte supprimer ?',
    travels,
    tr => `${stationName(tr.from)} → ${stationName(tr.to)} (${getHumanDate(new Date(tr.date), false)})`
  )
  if (picked === BACK) return

  if (!(await confirm('Supprimer cette alerte ?'))) return
  await picked.delete()
  success('Alerte supprimée.')
}

export async function travelsMenu(): Promise<void> {
  while (true) {
    const travels = await listTravels()
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'Alertes',
        choices: [
          { name: 'Ajouter une alerte', value: 'create' },
          { name: 'Supprimer une alerte', value: 'delete', disabled: travels.length === 0 ? 'aucune alerte' : false },
          new inquirer.Separator(),
          { name: dim('« Retour'), value: 'back' },
        ],
      },
    ])

    if (action === 'back') return
    if (action === 'create') await createTravel()
    if (action === 'delete') await deleteTravel(travels)
    await pause()
  }
}
