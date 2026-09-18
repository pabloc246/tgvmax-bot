import * as inquirer from 'inquirer'
import * as chalk from 'chalk'
import { trainlineStations, TrainlineStation } from '../book/trainline'
import BookerEntity from '../entities/booker.entity'
import NotifierEntity from '../entities/notifier.entity'
import { BookerType } from '../book/interface'
import { error, dim } from './theme'

export const BACK = Symbol('back')

const normalize = (str: string): string =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Free-text search + disambiguation list. Returns the chosen station, or BACK. */
export async function pickStation(label: string): Promise<TrainlineStation | typeof BACK> {
  while (true) {
    const { term } = await inquirer.prompt<{ term: string }>([
      {
        type: 'input',
        name: 'term',
        message: label + dim(' (nom de la gare, vide pour annuler)'),
      },
    ])
    if (!term.trim()) return BACK

    const needle = normalize(term.trim())
    const matches = trainlineStations.filter(s => normalize(s.name).includes(needle))

    if (matches.length === 0) {
      error(`Aucune gare ne correspond à "${term}".`)
      continue
    }
    if (matches.length === 1) return matches[0]

    const shown = matches.slice(0, 20)
    const { station } = await inquirer.prompt<{ station: TrainlineStation | typeof BACK }>([
      {
        type: 'list',
        name: 'station',
        message: `${matches.length} gares trouvées, laquelle ?${matches.length > shown.length ? dim(` (20 premières sur ${matches.length})`) : ''}`,
        choices: [
          ...shown.map(s => ({ name: s.name, value: s })),
          new inquirer.Separator(),
          { name: dim('« Recommencer la recherche'), value: BACK },
        ],
      },
    ])
    if (station === BACK) continue
    return station
  }
}

export type HourWindow = {
  minHour?: number
  minMinute?: number
  maxHour?: number
  maxMinute?: number
}

const intInRange = (min: number, max: number) => (value: string) => {
  if (value.trim() === '') return true
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) return `Doit être un entier entre ${min} et ${max} (ou vide).`
  return true
}

/** Optional departure-time window. Skips straight through if the user doesn't want one. */
export async function pickHourWindow(): Promise<HourWindow> {
  const { restrict } = await inquirer.prompt<{ restrict: boolean }>([
    {
      type: 'confirm',
      name: 'restrict',
      message: 'Restreindre la plage horaire de départ ?',
      default: false,
    },
  ])
  if (!restrict) return {}

  const answers = await inquirer.prompt<{ minHour: string; minMinute: string; maxHour: string; maxMinute: string }>([
    { type: 'input', name: 'minHour', message: 'Heure minimale de départ (0-23, vide = pas de minimum)', validate: intInRange(0, 23) },
    { type: 'input', name: 'minMinute', message: 'Minute minimale (0-59, vide = 0)', validate: intInRange(0, 59) },
    { type: 'input', name: 'maxHour', message: 'Heure maximale de départ (0-23, vide = pas de maximum)', validate: intInRange(0, 23) },
    { type: 'input', name: 'maxMinute', message: 'Minute maximale (0-59, vide = 59)', validate: intInRange(0, 59) },
  ])

  return {
    minHour: answers.minHour.trim() === '' ? undefined : Number(answers.minHour),
    minMinute: answers.minMinute.trim() === '' ? undefined : Number(answers.minMinute),
    maxHour: answers.maxHour.trim() === '' ? undefined : Number(answers.maxHour),
    maxMinute: answers.maxMinute.trim() === '' ? undefined : Number(answers.maxMinute),
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Asks for a YYYY-MM-DD date, defaulting to `defaultDate`. */
export async function pickDate(label: string, defaultDate: Date): Promise<Date> {
  const defaultStr = defaultDate.toISOString().split('T')[0]
  while (true) {
    const { value } = await inquirer.prompt<{ value: string }>([
      { type: 'input', name: 'value', message: `${label} (AAAA-MM-JJ)`, default: defaultStr },
    ])
    if (!DATE_RE.test(value.trim())) {
      error('Format invalide, attendu AAAA-MM-JJ (ex: 2026-10-03).')
      continue
    }
    const date = new Date(value.trim())
    if (isNaN(date.getTime())) {
      error('Date invalide.')
      continue
    }
    return date
  }
}

/** Generic "pick one item from a list, or go back" prompt. */
export async function pickFromList<T>(
  message: string,
  items: T[],
  labelFn: (item: T) => string,
  backLabel = '« Retour'
): Promise<T | typeof BACK> {
  const { picked } = await inquirer.prompt<{ picked: T | typeof BACK }>([
    {
      type: 'list',
      name: 'picked',
      message,
      choices: [
        ...items.map(item => ({ name: labelFn(item), value: item })),
        new inquirer.Separator(),
        { name: dim(backLabel), value: BACK },
      ],
    },
  ])
  return picked
}

export async function pickBooker(
  bookers: BookerEntity[],
  opts: { onlyTrainline?: boolean } = {}
): Promise<BookerEntity | typeof BACK> {
  const filtered = opts.onlyTrainline ? bookers.filter(b => b.type === BookerType.trainline) : bookers
  if (filtered.length === 0) {
    error(
      opts.onlyTrainline
        ? 'Aucun compte de réservation Trainline configuré. Créez-en un dans le menu "Comptes de réservation".'
        : 'Aucun compte de réservation configuré. Créez-en un dans le menu "Comptes de réservation".'
    )
    return BACK
  }
  return pickFromList('Avec quel compte de réservation ?', filtered, b => `${b.name} ${dim(`(${b.type})`)}`)
}

export async function pickNotifier(notifiers: NotifierEntity[]): Promise<NotifierEntity | typeof BACK> {
  if (notifiers.length === 0) {
    error('Aucune notification configurée. Créez-en une dans le menu "Notifications".')
    return BACK
  }
  return pickFromList('Comment voulez-vous être notifié ?', notifiers, n => `${n.name} ${dim(`(${n.type})`)}`)
}

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { ok } = await inquirer.prompt<{ ok: boolean }>([
    { type: 'confirm', name: 'ok', message, default: defaultValue },
  ])
  return ok
}

export const maskedPassword = (label: string) => ({
  type: 'password' as const,
  name: 'password',
  message: label,
  mask: chalk.dim('•'),
})
