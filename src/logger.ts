import chalk from 'chalk';

export type Colorize = (text: string) => string;

export const colors: Record<'red' | 'yellow' | 'green' | 'cyan' | 'gray' | 'magenta' | 'white', Colorize> = {
  red: chalk.red,
  yellow: chalk.yellow,
  green: chalk.green,
  cyan: chalk.cyan,
  gray: chalk.gray,
  magenta: chalk.magenta,
  white: chalk.white
};

export const styleKV = (label: string, value: string | number): string =>
  `${colors.magenta(label)}: ${colors.white(String(value))}`;

export const logInfo = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

export const logWarn = (message: string): void => {
  process.stderr.write(`${colors.yellow('WARN')} ${message}\n`);
};

export const logError = (message: string): void => {
  process.stderr.write(`${colors.red('ERROR')} ${message}\n`);
};

export const logSuccess = (message: string): void => {
  process.stdout.write(`${colors.green('OK')} ${message}\n`);
};