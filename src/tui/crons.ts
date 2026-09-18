import * as inquirer from 'inquirer'
import * as parser from 'cron-parser'
import CronTravelEntity from '../entities/cronTravel.entity'
import BookerEntity from '../entities/booker.entity'
import NotifierEntity from '../entities/notifier.entity'
import { BookerType } from '../book/interface'
import { trainlineStations } from '../book/trainline'
import { title, table, success, warn, error, pause, dim, yesNo } from './theme'
import { pickStation, pickHourWindow, pickBooker, pickNotifier, pickFromList, confirm, BACK } from './prompts'

const stationName = (sncfId: string) => trainlineStations.find(s => s.sncfId === sncfId)?.name ?? sncfId

const CRON_PRESETS: { name: string; value: string }[] = [
  { name: 'Tous les jours à 8h', value: '0 8 * * *' },
  { name: 'Tous les jours à 18h', value: '0 18 * * *' },
  { name: 'Tous les lundis à 8h', value: '0 8 * * 1' },
  { name: 'Toutes les heures', value: '0 * * * *' },
  { name: 'Personnalisé (expression cron)', value: '__custom__' },
]

async function pickCronExpression(): Promise<string | typeof BACK> {
  const { preset } = await inquirer.prompt<{ preset: string }>([
    { type: 'list', name: 'preset', message: 'Fréquence', choices: CRON_PRESETS },
  ])
  if (preset !== '__custom__') return preset

  const { expr } = await inquirer.prompt<{ expr: string }>([
    {
      type: 'input',
      name: 'expr',
      message: `Expression cron ${dim('(minute heure jour mois jour-semaine, ex: "0 8 * * *", vide pour annuler)')}`,
      validate: (v: string) => {
        if (v.trim() === '') return true
        try {
          parser.parseExpression(v.trim())
          return true
        } catch {
          return 'Expression cron invalide.'
        }
      },
    },
  ])
  return expr.trim() === '' ? BACK : expr.trim()
}

async function listCrons(): Promise<CronTravelEntity[]> {
  const crons = await CronTravelEntity.find({ relations: ['notifier', 'booker'] })
  title('Alertes récurrentes')
  if (crons.length === 0) {
    console.log(dim('  Aucune alerte récurrente pour le moment.'))
    return crons
  }
  const t = table(['#', 'Trajet', 'Fréquence', 'Max. voyages', 'Réservation auto.', 'Notif.', 'Compte'])
  crons.forEach(c => {
    t.push([
      String(c.id),
      `${stationName(c.from)} → ${stationName(c.to)}`,
      c.cron,
      String(c.maxTravels),
      yesNo(c.book),
      c.notifier?.name ?? dim('—'),
      c.booker?.name ?? dim('—'),
    ])
  })
  console.log(t.toString())
  return crons
}

async function createCron(): Promise<void> {
  title('Nouvelle alerte récurrente')

  const from = await pickStation('Gare de départ')
  if (from === BACK) return
  const to = await pickStation('Gare d\'arrivée')
  if (to === BACK) return

  const cronExpression = await pickCronExpression()
  if (cronExpression === BACK) return

  const { maxTravels } = await inquirer.prompt<{ maxTravels: number }>([
    {
      type: 'number',
      name: 'maxTravels',
      message: 'Nombre de voyages à garder ouverts en permanence',
      default: 1,
      validate: (v: number) => (Number.isInteger(v) && v > 0) || 'Doit être un entier positif.',
    },
  ])

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

  try {
    await CronTravelEntity.insertAndInit({
      from: from.sncfId,
      to: to.sncfId,
      cron: cronExpression,
      maxTravels,
      ...hourWindow,
      notifier: { id: notifier.id } as NotifierEntity,
      booker: { id: booker.id } as BookerEntity,
      book,
    })
    success(`Alerte récurrente créée pour ${from.name} → ${to.name}.`)
  } catch (e) {
    error(`Impossible de créer l'alerte récurrente : ${(e as Error).message}`)
  }
}

async function deleteCron(crons: CronTravelEntity[]): Promise<void> {
  const picked = await pickFromList(
    'Quelle alerte récurrente supprimer ?',
    crons,
    c => `${stationName(c.from)} → ${stationName(c.to)} (${c.cron})`
  )
  if (picked === BACK) return

  if (!(await confirm('Supprimer cette alerte récurrente et tous les voyages qu\'elle a créés ?'))) return
  await CronTravelEntity.deleteById(picked.id)
  success('Alerte récurrente supprimée.')
}

export async function cronsMenu(): Promise<void> {
  while (true) {
    const crons = await listCrons()
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'Alertes récurrentes',
        choices: [
          { name: 'Ajouter une alerte récurrente', value: 'create' },
          { name: 'Supprimer une alerte récurrente', value: 'delete', disabled: crons.length === 0 ? 'aucune alerte' : false },
          new inquirer.Separator(),
          { name: dim('« Retour'), value: 'back' },
        ],
      },
    ])

    if (action === 'back') return
    if (action === 'create') await createCron()
    if (action === 'delete') await deleteCron(crons)
    await pause()
  }
}
