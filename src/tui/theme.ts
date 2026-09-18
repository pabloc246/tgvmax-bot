import * as chalk from 'chalk'
import * as Table from 'cli-table3'

export const banner = () => {
  console.log('')
  console.log(chalk.bold.cyanBright('  🚄  TGVMax Bot'))
  console.log(chalk.dim('  ────────────────────────────────────'))
}

export const title = (text: string) => {
  console.log('')
  console.log(chalk.bold.white(`  ${text}`))
  console.log(chalk.dim('  ' + '─'.repeat(text.length)))
}

export const success = (text: string) => console.log(chalk.green(`  ✔ ${text}`))
export const error = (text: string) => console.log(chalk.red(`  ✘ ${text}`))
export const info = (text: string) => console.log(chalk.cyan(`  ℹ ${text}`))
export const warn = (text: string) => console.log(chalk.yellow(`  ⚠ ${text}`))
export const dim = (text: string) => chalk.dim(text)

export const table = (head: string[]): Table.Table => {
  return new Table({
    head: head.map(h => chalk.bold.cyanBright(h)),
    style: { head: [], border: ['grey'] },
  })
}

export const yesNo = (value: boolean, whenTrue = 'oui', whenFalse = 'non'): string =>
  value ? chalk.green(whenTrue) : chalk.dim(whenFalse)

export const pause = async (): Promise<void> => {
  const inquirer = await import('inquirer')
  await inquirer.prompt([{ type: 'input', name: '_', message: chalk.dim('Appuyez sur Entrée pour continuer…') }])
}
