import inquirer from "inquirer";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import chalk from "chalk";

// Ruta del archivo de configuración
const settingsFilePath = path.join(process.cwd(), "commit-helper-settings.json");

// Cargar la configuración si existe
let settings = {};

if (fs.existsSync(settingsFilePath)) {
  settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
} else {
  settings = {}; // Si no existe, inicializar vacío
}

// Valores por defecto de la configuración
const defaultConfig = {
  GPG_SIGNING: false,
  BREAKING_CHANGE_FORMAT: "BREAKING CHANGE",
  ADVANCE_OPTIONS: undefined,
  breakingChange: false,
  solved: false,
  footer: "",
  description: "",
  title: "",
};

// Primero, configurar GPG_SIGNING si no está definido
let gpgSigning = settings.GPG_SIGNING;
if (gpgSigning === undefined) {
  const { confirmGpgSigning } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmGpgSigning",
      message: `🔐 Do you want to sign your commits with GPG? (default false)`,
      default: false,
    },
  ]);

  gpgSigning = confirmGpgSigning;
  settings.GPG_SIGNING = gpgSigning;
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  console.log(chalk.green("🔧 GPG signing preference saved."));
}

// Configurar el formato de BREAKING_CHANGE si no está definido
let breakingChangeFormat = settings.BREAKING_CHANGE_FORMAT;
if (breakingChangeFormat === undefined) {
  const { confirmBreakingChangeFormat } = await inquirer.prompt([
    {
      type: "list",
      name: "confirmBreakingChangeFormat",
      message: "💥 How would you like to format breaking changes?",
      choices: [
        { name: "Use 'BREAKING CHANGE'", value: "BREAKING CHANGE" },
        { name: "Use '!' in the type", value: "!" },
        { name: "Use both 'BREAKING CHANGE' and '!'", value: "BOTH" },
      ],
      default: "BREAKING CHANGE",
    },
  ]);

  breakingChangeFormat = confirmBreakingChangeFormat;
  settings.BREAKING_CHANGE_FORMAT = breakingChangeFormat;
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  console.log(chalk.green("🔧 Breaking change format preference saved."));
}

// Preguntar si se activan configuraciones avanzadas solo si ADVANCE_OPTIONS está indefinido
if (settings.ADVANCE_OPTIONS === undefined) {
  const { confirmAdvancedConfig } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmAdvancedConfig",
      message: "⚙️ Do you want to enable advanced configurations?",
      default: false,
    },
  ]);

  // Guardar la preferencia de configuraciones avanzadas en settings
  settings.ADVANCE_OPTIONS = confirmAdvancedConfig;
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));

  if (confirmAdvancedConfig) {
    // Si activan la configuración avanzada, preguntamos por los valores predeterminados
    const advancedSettings = await inquirer.prompt([
      {
        type: "confirm",
        name: "breakingChange",
        message: `⚠️ Does this change introduce a BREAKING CHANGE? (default ${settings.breakingChange ?? defaultConfig.breakingChange})`,
        default: settings.breakingChange ?? defaultConfig.breakingChange,
      },
      {
        type: "confirm",
        name: "solved",
        message: `✅ Did you solve a PR or issue? (default ${settings.solved ?? defaultConfig.solved})`,
        default: settings.solved ?? defaultConfig.solved,
      },
      {
        type: "input",
        name: "footer",
        message: "✏️ Add footer (e.g., references, etc.) (optional):",
        default: settings.footer ?? defaultConfig.footer,
      },
      {
        type: "input",
        name: "description",
        message: "📝 Set a default description for commits:",
        default: settings.description ?? defaultConfig.description,
      },
      {
        type: "input",
        name: "title",
        message: "🔖 Set a default title for commits:",
        default: settings.title ?? defaultConfig.title,
      },
    ]);

    // Guardar las configuraciones avanzadas y predeterminadas en settings
    settings.breakingChange = advancedSettings.breakingChange;
    settings.solved = advancedSettings.solved;
    settings.footer = advancedSettings.footer;
    settings.description = advancedSettings.description;
    settings.title = advancedSettings.title;

    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    console.log(chalk.green("🔧 Advanced and default configuration preferences saved."));
  } else {
    console.log(chalk.green("🔧 Advanced configurations are disabled."));
  }
}

async function main() {
  const isGitAdded = checkGitAdd();
  if (!isGitAdded) {
    const { confirmGitAdd } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmGitAdd",
        message: "❗ You have not staged all your changes. Do you want me to run 'git add .' for you?",
        default: true,
      },
    ]);

    if (confirmGitAdd) {
      execSync('git add .', { stdio: 'inherit' });
      console.log(chalk.green("✅ git add . executed successfully!"));
    } else {
      console.log(chalk.red("❌ Commit aborted due to un-staged changes."));
      return;
    }
  }

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "type",
      message: "🔧 Select the type of change:",
      choices: [
        { name: "✨ feat: A new feature", value: "feat" },
        { name: "🐛 fix: A bug fix", value: "fix" },
        { name: "📚 docs: Documentation changes", value: "docs" },
        { name: "🎨 style: Code style changes (formatting, no logic)", value: "style" },
        { name: "🔨 refactor: Code refactoring (no new features or fixes)", value: "refactor" },
        { name: "⚡ perf: Performance improvements", value: "perf" },
        { name: "🧪 test: Adding or updating tests", value: "test" },
        { name: "🛠️ build: Build system or configuration changes", value: "build" },
        { name: "💼 chore: Miscellaneous tasks (build, tools)", value: "chore" },
        { name: "🎬 ci: Continuous integration changes", value: "ci" },
      ],
    },
    {
      type: "input",
      name: "scope",
      message: "🌍 What parts of the project are you changing? (e.g., components, API, styles, etc.):",
      default: "",
    },
    {
      type: "input",
      name: "description",
      message: "📝 Write a short description:",
      default: settings.description ?? defaultConfig.description,
      validate(input) {
        return input.length > 0 || "Description cannot be empty.";
      },
    },
    {
      type: "confirm",
      name: "breakingChange",
      message: `⚠️ Does this change introduce a BREAKING CHANGE? (default ${settings.breakingChange ?? defaultConfig.breakingChange})`,
      default: settings.breakingChange ?? defaultConfig.breakingChange,
    },
    {
      type: "input",
      name: "body",
      message: "🖋️ Write a longer description (optional):",
    },
    {
      type: "confirm",
      name: "solved",
      message: `✅ Did you solve a PR or issue? (default ${settings.solved ?? defaultConfig.solved})`,
      default: settings.solved ?? defaultConfig.solved,
    },
  ]);

  const { type, scope, description, breakingChange, body, solved } = answers;

  let commitMessage = `${type}${scope ? `(${scope})` : ''}: ${description}`;

  if (breakingChange) {
    switch (settings.BREAKING_CHANGE_FORMAT) {
      case "!":
        commitMessage = `${commitMessage}!`;
        break;
      case "BOTH":
        commitMessage = `${commitMessage}!`;
        commitMessage += `\n\nBREAKING CHANGE: ${body}`;
        break;
      default:
        commitMessage += `\n\nBREAKING CHANGE: ${body}`;
    }
  } else if (body) {
    commitMessage += "\n\n" + body;
  }

  let solvedFooter = "";
  if (solved) {
    const { solvedDetails } = await inquirer.prompt([
      {
        type: "input",
        name: "solvedDetails",
        message: "💬 Enter the details or IDs (separate with commas):",
      },
    ]);
    const solvedItems = solvedDetails.split(",").map((item) => item.trim());
    solvedFooter = `Fixes: ${solvedItems.join(", ")}`;
  }

  if (solvedFooter) {
    commitMessage += `\n\n${solvedFooter}`;
  }

  console.log(chalk.green(`\n✅ Commit message created: \n${commitMessage}\n`));

  // Confirm commit
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "✔️ Do you want to commit with this message?",
      default: true,
    },
  ]);

  if (confirm) {
    const commitCommand = `git commit -m "${commitMessage}"`;
    if (gpgSigning) {
      execSync(`${commitCommand} --gpg-sign`, { stdio: "inherit" });
    } else {
      execSync(commitCommand, { stdio: "inherit" });
    }

    console.log(chalk.green("✅ Commit successful!"));
    console.log(chalk.cyan("\n🚀 Now push your changes with:"));
    console.log(chalk.yellow("git push -u <origin>"));
  } else {
    console.log(chalk.red("❌ Commit aborted."));
  }
}

function checkGitAdd() {
  const status = execSync('git status --porcelain').toString();
  const lines = status.split('\n');

  // Verificar si alguna línea tiene espacio al inicio
  for (const line of lines) {
    if (line.startsWith(" ")) {
      return false; // Si algún archivo no está añadido, retornamos false
    }
  }

  return true; // Si todos están añadidos, retornamos true
}

main();
