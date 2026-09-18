import * as inquirer from 'inquirer'
import { banner, error, dim } from './theme'
import { journeysMenu } from './journeys'
import { travelsMenu } from './travels'
import { cronsMenu } from './crons'
import { bookersMenu } from './bookers'
import { notifiersMenu } from './notifiers'

type Action = 'journeys' | 'travels' | 'crons' | 'bookers' | 'notifiers' | 'quit'

export async function runTui(): Promise<void> {
  banner()
  console.log(dim('  La veille des alertes continue en tâche de fond pendant que vous naviguez ci-dessous.'))

  while (true) {
    console.log('')
    const { action } = await inquirer.prompt<{ action: Action }>([
      {
        type: 'list',
        name: 'action',
        message: 'Que voulez-vous faire ?',
        choices: [
          { name: 'Rechercher et réserver un trajet maintenant', value: 'journeys' },
          { name: 'Gérer les alertes', value: 'travels' },
          { name: 'Gérer les alertes récurrentes', value: 'crons' },
          { name: 'Gérer les comptes de réservation', value: 'bookers' },
          { name: 'Gérer les notifications', value: 'notifiers' },
          new inquirer.Separator(),
          { name: dim('Quitter'), value: 'quit' },
        ],
      },
    ])

    try {
      switch (action) {
        case 'journeys':
          await journeysMenu()
          break
        case 'travels':
          await travelsMenu()
          break
        case 'crons':
          await cronsMenu()
          break
        case 'bookers':
          await bookersMenu()
          break
        case 'notifiers':
          await notifiersMenu()
          break
        case 'quit': {
          const { confirmQuit } = await inquirer.prompt<{ confirmQuit: boolean }>([
            {
              type: 'confirm',
              name: 'confirmQuit',
              message: 'Quitter arrêtera aussi la veille des alertes en cours (ce process les surveille). Continuer ?',
              default: false,
            },
          ])
          if (confirmQuit) {
            console.log(dim('  À bientôt !'))
            process.exit(0)
          }
          break
        }
      }
    } catch (e) {
      error(`Une erreur inattendue est survenue : ${(e as Error).message}`)
    }
  }
}
