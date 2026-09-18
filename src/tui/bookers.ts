import * as inquirer from 'inquirer'
import BookerEntity from '../entities/booker.entity'
import TravelEntity from '../entities/travel.entity'
import CronTravelEntity from '../entities/cronTravel.entity'
import { BookerType } from '../book/interface'
import { title, table, success, error, pause, dim } from './theme'
import { pickFromList, confirm, maskedPassword, BACK } from './prompts'

async function listBookers(): Promise<BookerEntity[]> {
  const bookers = await BookerEntity.find()
  title('Comptes de réservation')
  if (bookers.length === 0) {
    console.log(dim('  Aucun compte de réservation pour le moment.'))
    return bookers
  }
  const t = table(['#', 'Nom', 'Type', 'Identifiant'])
  bookers.forEach(b => t.push([String(b.id), b.name, b.type, b.username ?? dim('—')]))
  console.log(t.toString())
  return bookers
}

async function createBooker(): Promise<void> {
  title('Nouveau compte de réservation')
  const { name, type } = await inquirer.prompt<{ name: string; type: BookerType }>([
    { type: 'input', name: 'name', message: 'Nom (juste pour vous, ex: "Mon compte Trainline")', validate: (v: string) => v.trim().length > 0 || 'Requis.' },
    {
      type: 'list',
      name: 'type',
      message: 'Type de compte',
      choices: [
        { name: `Trainline Business ${dim('(requis pour la réservation manuelle et automatique)')}`, value: BookerType.trainline },
        { name: `OuiSNCF ${dim('(veille uniquement, pas de réservation automatique)')}`, value: BookerType.ouisncf },
      ],
    },
  ])

  let username: string | undefined
  let password: string | undefined
  if (type === BookerType.trainline) {
    const creds = await inquirer.prompt<{ username: string; password: string }>([
      { type: 'input', name: 'username', message: 'Email du compte Trainline Business', validate: (v: string) => v.trim().length > 0 || 'Requis.' },
      { ...maskedPassword('Mot de passe Trainline'), validate: (v: string) => v.length > 0 || 'Requis.' },
    ])
    username = creds.username
    password = creds.password
  }

  const inserted = await BookerEntity.insert({ name, type, username, password })
  success(`Compte "${name}" créé (#${inserted.generatedMaps[0].id}).`)
}

async function deleteBooker(bookers: BookerEntity[]): Promise<void> {
  const picked = await pickFromList('Quel compte supprimer ?', bookers, b => `${b.name} (${b.type})`)
  if (picked === BACK) return

  const attachedTravels = await TravelEntity.find({ where: { booker: { id: picked.id } } })
  const attachedCrons = await CronTravelEntity.find({ where: { booker: { id: picked.id } } })
  if (attachedTravels.length > 0 || attachedCrons.length > 0) {
    error(`Impossible de supprimer "${picked.name}" : il est utilisé par ${attachedTravels.length} alerte(s) et ${attachedCrons.length} alerte(s) récurrente(s). Supprimez-les d'abord.`)
    return
  }

  if (!(await confirm(`Supprimer définitivement le compte "${picked.name}" ?`))) return
  await BookerEntity.delete({ id: picked.id })
  success(`Compte "${picked.name}" supprimé.`)
}

export async function bookersMenu(): Promise<void> {
  while (true) {
    const bookers = await listBookers()
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'Comptes de réservation',
        choices: [
          { name: 'Ajouter un compte', value: 'create' },
          { name: 'Supprimer un compte', value: 'delete', disabled: bookers.length === 0 ? 'aucun compte' : false },
          new inquirer.Separator(),
          { name: dim('« Retour'), value: 'back' },
        ],
      },
    ])

    if (action === 'back') return
    if (action === 'create') await createBooker()
    if (action === 'delete') await deleteBooker(bookers)
    await pause()
  }
}
