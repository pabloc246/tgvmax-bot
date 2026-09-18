import Database from './src/utils/database'
import TravelEntity from './src/entities/travel.entity'
import CronTravelEntity from './src/entities/cronTravel.entity'
import { TelegramNotifier } from './src/notify/telegram'
import { runTui } from './src/tui'

const db = new Database()

db.connect().then(async () => {
  TelegramNotifier.start()

  await TravelEntity.deleteOld()
  const travels = await TravelEntity.find({ relations: ['notifier', 'booker', 'cron'] })
  travels.forEach(travel => travel.init())
  console.log(`${travels.length} travel(s) initiated.`)

  const crons = await CronTravelEntity.reloadAll()
  console.log(`${crons.length} cron(s) initiated.`)

  // Periodically prune past travels and let recurring alerts create their next occurrences.
  // This runs independently of the interactive menu below, on the same event loop.
  setInterval(async () => {
    await TravelEntity.deleteOld()
    await CronTravelEntity.reloadAll()
  }, 60 * 60 * 1000)

  await runTui()
})
