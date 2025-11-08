import chalk from "chalk";

type LogType = "database" | "response" | "debug" | "info" | "warn" | "error";

const iconMap: Record<LogType, string> = {
  database: "🗄️",
  response: "✅",
  debug: "🐛",
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
};

export function Console(message: unknown, type: LogType = "debug"): void {
  if (process.env.NODE_ENV === "production") return; // hide logs in production

  const colorMap: Record<LogType, chalk.Chalk> = {
    database: chalk.blueBright.bold,
    response: chalk.greenBright.bold,
    debug: chalk.yellowBright.bold,
    info: chalk.cyan.bold,
    warn: chalk.magenta.bold,
    error: chalk.redBright.bold,
  };

  const colorFn = colorMap[type] || chalk.white;

  // Format the message
  let output: string;

  if (typeof message === "object") {
    try {
      // Pretty print objects & arrays
      output = JSON.stringify(message, null, 2);
    } catch {
      output = String(message);
    }
  } else {
    output = String(message);
  }

  console.log(colorFn(`${iconMap[type]} [${type.toUpperCase()}] → ${output}`));
}
