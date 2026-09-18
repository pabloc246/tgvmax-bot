import * as inquirer from 'inquirer'
import NotifierEntity, { Type as NotifierType } from '../entities/notifier.entity'
import TravelEntity from '../entities/travel.entity'
import CronTravelEntity from '../entities/cronTravel.entity'
import { title, table, success, error, pause, dim } from './theme'
import { pickFromList, confirm, maskedPassword, BACK } from './prompts'

async function listNotifiers(): Promise<NotifierEntity[]> {
  const notifiers = await NotifierEntity.find()
  title('Notifications')
  if (notifiers.length === 0) {
    console.log(dim('  Aucune notification configurée pour le moment.'))
    return notifiers
  }
  const t = table(['#', 'Nom', 'Type'])
  notifiers.forEach(n => t.push([String(n.id), n.name, n.type]))
  console.log(t.toString())
  return notifiers
}

async function createNotifier(): Promise<void> {
  title('Nouvelle notification')
  const { name, type } = await inquirer.prompt<{ name: string; type: NotifierType }>([
    { type: 'input', name: 'name', message: 'Nom (juste pour vous)', validate: (v: string) => v.trim().length > 0 || 'Requis.' },
    {
      type: 'list',
      name: 'type',
      message: 'Type de notification',
      choices: [
        { name: `Telegram ${dim('(un bot vous écrit directement)')}`, value: NotifierType.telegram },
        { name: `SMS Free mobile ${dim('(uniquement chez Free)')}`, value: NotifierType.sms },
      ],
    },
  ])

  let username: string
  let password = ''
  if (type === NotifierType.telegram) {
    console.log(dim('  Démarrez une conversation avec votre bot Telegram (/start) : il vous donnera votre chat id.'))
    const { chatId } = await inquirer.prompt<{ chatId: string }>([
      { type: 'input', name: 'chatId', message: 'Chat id Telegram', validate: (v: string) => v.trim().length > 0 || 'Requis.' },
    ])
    username = chatId
  } else {
    const creds = await inquirer.prompt<{ login: string; apiKey: string }>([
      { type: 'input', name: 'login', message: 'Identifiant Free mobile', validate: (v: string) => v.trim().length > 0 || 'Requis.' },
      { ...maskedPassword('Clé API Free mobile'), name: 'apiKey', validate: (v: string) => v.length > 0 || 'Requis.' },
    ])
    username = creds.login
    password = creds.apiKey
  }

  const inserted = await NotifierEntity.insert({ name, type, username, password })
  success(`Notification "${name}" créée (#${inserted.generatedMaps[0].id}).`)
}

async function deleteNotifier(notifiers: NotifierEntity[]): Promise<void> {
  const picked = await pickFromList('Quelle notification supprimer ?', notifiers, n => `${n.name} (${n.type})`)
  if (picked === BACK) return

  const attachedTravels = await TravelEntity.find({ where: { notifier: { id: picked.id } } })
  const attachedCrons = await CronTravelEntity.find({ where: { notifier: { id: picked.id } } })
  if (attachedTravels.length > 0 || attachedCrons.length > 0) {
    error(`Impossible de supprimer "${picked.name}" : elle est utilisée par ${attachedTravels.length} alerte(s) et ${attachedCrons.length} alerte(s) récurrente(s). Supprimez-les d'abord.`)
    return
  }

  if (!(await confirm(`Supprimer définitivement la notification "${picked.name}" ?`))) return
  await NotifierEntity.delete({ id: picked.id })
  success(`Notification "${picked.name}" supprimée.`)
}

export async function notifiersMenu(): Promise<void> {
  while (true) {
    const notifiers = await listNotifiers()
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'Notifications',
        choices: [
          { name: 'Ajouter une notification', value: 'create' },
          { name: 'Supprimer une notification', value: 'delete', disabled: notifiers.length === 0 ? 'aucune notification' : false },
          new inquirer.Separator(),
          { name: dim('« Retour'), value: 'back' },
        ],
      },
    ])

    if (action === 'back') return
    if (action === 'create') await createNotifier()
    if (action === 'delete') await deleteNotifier(notifiers)
    await pause()
  }
}
