import chalk from 'chalk';

export const styleKV = (label: string, value: string | number): string =>
  `${chalk.magenta(label)}: ${chalk.white(String(value))}`;

export const logInfo = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

export const logWarn = (message: string): void => {
  process.stderr.write(`${chalk.yellow('WARN')} ${message}\n`);
};

export const logError = (message: string): void => {
  process.stderr.write(`${chalk.red('ERROR')} ${message}\n`);
};