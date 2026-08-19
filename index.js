import init, { Svod, setup_panic_hook, welcome_text } from "./pkg/svod_web.js";

// Gruvbox ANSI palettes (light and dark). jQuery Terminal renders ANSI via
// hardcoded CSS colour keywords and ignores 256-colour codes, so the Rust ANSI
// output is converted to HTML with the exact Gruvbox colours here instead.
const LIGHT_ANSI_COLORS = {
    30: "#7c6f64",
    31: "#9d0006",
    32: "#79740e",
    33: "#b57614",
    34: "#076678",
    35: "#8f3f71",
    36: "#427b58",
    37: "#a89984",
    90: "#7c6f64",
    91: "#cc241d",
    92: "#98971a",
    93: "#d79921",
    94: "#458588",
    95: "#b16286",
    96: "#689d6a",
    97: "#282828",
};

const DARK_ANSI_COLORS = {
    30: "#928374",
    31: "#cc241d",
    32: "#98971a",
    33: "#d79921",
    34: "#458588",
    35: "#b16286",
    36: "#689d6a",
    37: "#a89984",
    90: "#a89984",
    91: "#fb4934",
    92: "#b8bb26",
    93: "#fabd2f",
    94: "#83a598",
    95: "#d3869b",
    96: "#8ec07c",
    97: "#ebdbb2",
};

// 256-colour foregrounds used by the shared highlighter (only the comment
// grey 245 today), mapped onto the Gruvbox palette.
const LIGHT_ANSI_256 = {
    245: "#7c6f64",
};

const DARK_ANSI_256 = {
    245: "#928374",
};

// The palette active for the current theme; `ansiToHtml` reads these.
let ansiColors = LIGHT_ANSI_COLORS;
let ansi256 = LIGHT_ANSI_256;

const LANG_KEY = "svod-lang";
const THEME_KEY = "svod-theme";

function loadLangPref() {
    try {
        return localStorage.getItem(LANG_KEY);
    } catch {
        return null;
    }
}

function saveLangPref(lang) {
    try {
        localStorage.setItem(LANG_KEY, lang);
    } catch {
        // Private browsing or disabled storage: just don't persist.
    }
}

function loadThemePref() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch {
        return null;
    }
}

function saveThemePref(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch {
        // Private browsing or disabled storage: just don't persist.
    }
}

// "dark" when the OS asks for dark colour scheme, "light" otherwise.
function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// An explicitly saved choice wins; otherwise follow the system theme.
function resolvedTheme() {
    const saved = loadThemePref();
    return saved === "light" || saved === "dark" ? saved : systemTheme();
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function openSpan(state) {
    const styles = [];
    if (state.fg) {
        styles.push(`color:${state.fg}`);
    }
    if (state.bold) {
        styles.push("font-weight:bold");
    }
    if (state.italic) {
        styles.push("font-style:italic");
    }
    if (state.underline) {
        styles.push("text-decoration:underline");
    }
    return styles.length ? `<span style="${styles.join(";")}">` : "";
}

function closeSpan(state) {
    return state.bold || state.italic || state.underline || state.fg ? "</span>" : "";
}

function newState() {
    return { bold: false, italic: false, underline: false, fg: null };
}

function ansiToHtml(text) {
    const re = /\x1b\[([0-9;]*)m/g;
    let html = "";
    let pos = 0;
    let state = newState();
    let m;
    while ((m = re.exec(text)) !== null) {
        html += escapeHtml(text.slice(pos, m.index));
        const prev = { ...state };
        const parts = m[1].split(";");
        for (let i = 0; i < parts.length; i++) {
            const n = parseInt(parts[i], 10);
            if (n === 0) {
                state = newState();
            } else if (n === 1) {
                state.bold = true;
            } else if (n === 3) {
                state.italic = true;
            } else if (n === 4) {
                state.underline = true;
            } else if (n === 38 && parts[i + 1] === "5") {
                const x = parseInt(parts[i + 2], 10);
                if (ansi256[x]) {
                    state.fg = ansi256[x];
                }
                i += 2;
            } else if (ansiColors[n]) {
                state.fg = ansiColors[n];
            }
        }
        html += closeSpan(prev);
        html += openSpan(state);
        pos = re.lastIndex;
    }
    html += escapeHtml(text.slice(pos));
    html += closeSpan(state);
    return html;
}

async function main() {
    await init();
    setup_panic_hook();

    const svod = new Svod();

    const taglines = {
        en: "<strong>Svod</strong> is a modern calculation interpreter designed for engineering computations and technical report generation.",
        ru: "<strong>Svod</strong> — современный интерпретатор расчётов для инженерных вычислений и формирования технических отчётов.",
    };

    const hints = {
        en: "Ctrl+L — clear screen · ↑/↓ arrows — history",
        ru: "Ctrl+L — очистить экран · стрелки ↑/↓ — история",
    };

    const helps = {
        en: `Try some examples:

  2 + 3 * 4                       -- arithmetic: + - * / **, mod
  a = 42                          -- variable
  const k = 1.5                   -- constant; built-ins: #pi, #e, #g, #c
  F = 1500 kN                     -- quantity with a unit
  2 m in cm                       -- unit conversion
  sqrt(16); sin(30°); max(2, 7)   -- functions
  2 < 3 and not false             -- comparison & logic: == != < <= > >= and or not
  "text"; 'text'                  -- text value
  -- comment, --[[ block ]]       -- the two comment styles
  if 2 > 1 then 5 else 6 end      -- condition
  begin x = 3; x * 14 end         -- block with a local variable
  sqrt(a) where a = 16 end        -- local bindings (a is visible in the value)
  v = choice(75, 50)              -- pick from a list into a variable
  match v case 75 then "A" case 50 then "B" else "?" end  -- branch on v
  input N : kN;                   -- input parameter (the browser will ask)
  A = 10 cm2                      -- cross-section area
  σ = N / A                       -- axial stress
  check(σ <= 160 MPa)             -- strength check

Numbers keep ~28 significant digits; output precision is 4 by default.
Output can be rendered as Typst or LaTeX with :format typst / :format latex.`,
        ru: `Попробуйте примеры:

  2 + 3 * 4                       -- арифметика: + - * / **, mod
  a = 42                          -- переменная
  const k = 1.5                   -- константа; встроенные: #pi, #e, #g, #c
  F = 1500 кН                     -- величина с единицей
  2 м in см                       -- перевод единиц
  sqrt(16); sin(30°); max(2, 7)   -- функции
  2 < 3 and not false             -- сравнения и логика: == != < <= > >= and or not
  "текст"; 'текст'                -- текстовое значение
  -- комментарий, --[[ блочный ]] -- два вида комментариев
  if 2 > 1 then 5 else 6 end      -- условие
  begin x = 3; x * 14 end         -- блок с локальной переменной
  sqrt(a) where a = 16 end        -- локальные привязки (a доступна в значении)
  v = choice(75, 50)              -- выбор из списка в переменную
  match v case 75 then "A" case 50 then "B" else "?" end  -- ветвление по v
  input N : кН;                   -- входной параметр (браузер спросит значение)
  A = 10 см2                      -- площадь сечения
  σ = N / A                       -- напряжение в стержне
  check(σ <= 160 МПа)             -- проверка прочности

Числа хранятся с ~28 значащими цифрами; точность вывода по умолчанию 4.
Вывод можно рендерить в Typst или LaTeX: :format typst / :format latex.`,
    };

    function applyLang(lang) {
        svod.set_lang(lang);
        document.getElementById("tagline").innerHTML = taglines[lang];
        document.querySelector(".hint").textContent = hints[lang];
        // Only the examples are highlighted; the trailing note (after the last
        // blank line) stays plain prose, rendered in the sans-serif body font.
        const help = helps[lang];
        const noteAt = help.lastIndexOf("\n\n");
        const examples = noteAt === -1 ? help : help.slice(0, noteAt + 2);
        const note = noteAt === -1 ? "" : help.slice(noteAt + 2);
        document.getElementById("help").innerHTML =
            ansiToHtml(svod.highlight(examples)) +
            '<span class="help-note">' +
            escapeHtml(note) +
            "</span>";
    }

    document.getElementById("lang").addEventListener("change", (event) => {
        saveLangPref(event.target.value);
        applyLang(event.target.value);
    });
    const savedLang = loadLangPref();
    if (savedLang === "en" || savedLang === "ru") {
        document.getElementById("lang").value = savedLang;
    }
    applyLang(document.getElementById("lang").value);

    const themeButton = document.getElementById("theme");

    // The button offers the *opposite* theme, so its icon and label describe
    // the target: on light it shows ☾ "Dark theme", on dark ☀ "Light theme".
    function themeTargetMeta(current) {
        if (current === "dark") {
            return { icon: "☀", label: { en: "Light theme", ru: "Светлая тема" } };
        }
        return { icon: "☾", label: { en: "Dark theme", ru: "Тёмная тема" } };
    }

    function applyTheme(theme) {
        const dark = theme === "dark";
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        ansiColors = dark ? DARK_ANSI_COLORS : LIGHT_ANSI_COLORS;
        ansi256 = dark ? DARK_ANSI_256 : LIGHT_ANSI_256;
        const meta = themeTargetMeta(theme);
        const label = meta.label[document.getElementById("lang").value];
        themeButton.textContent = meta.icon;
        themeButton.title = label;
        themeButton.setAttribute("aria-label", label);
        // Re-highlight the help block so its ANSI colours match the theme.
        applyLang(document.getElementById("lang").value);
    }

    applyTheme(resolvedTheme());
    themeButton.addEventListener("click", () => {
        const next =
            document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        saveThemePref(next);
        applyTheme(next);
    });
    // Follow the OS theme live, but only while the user has not chosen
    // explicitly: an explicit pick always wins.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (loadThemePref() === null) {
            applyTheme(e.matches ? "dark" : "light");
        }
    });
    // Some Chromium forks never fire the change event live; they refresh
    // `matchMedia` when the tab regains focus/visibility. Re-check there.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && loadThemePref() === null) {
            applyTheme(systemTheme());
        }
    });
    window.addEventListener("focus", () => {
        if (loadThemePref() === null) {
            applyTheme(systemTheme());
        }
    });

    const PROMPT = "svod> ";
    const PROMPT_HTML = `<span class="repl-prompt">${PROMPT}</span>`;

    // Accumulates an unfinished multiline program (open begin/if block, an
    // unclosed parenthesis or a dangling operator) until it parses.
    let inputBuffer = "";

    // Evaluates one complete program, asking the user for any input/choice()
    // prompts via the same `read` mechanism used for the prompt loop.
    async function runCode(term, code) {
        svod.reset_input();
        while (true) {
            const result = svod.interpret(code);
            if (result.pending_prompt) {
                svod.queue_input(await term.read(result.pending_prompt));
                continue;
            }
            if (result.output) {
                term.echo(ansiToHtml(result.output), { raw: true });
            }
            return;
        }
    }

    function runCommand(term, input) {
        const r = svod.command(input);
        if (r.quit) {
            window.location.reload();
            return;
        }
        if (r.clear) {
            term.clear();
        }
        if (r.text) {
            term.echo(ansiToHtml(r.text), { raw: true });
        }
    }

    // Feeds one entered line into the multiline buffer, reading continuation
    // lines with a "..." prompt until the program is complete, then runs it.
    async function submitLine(term, line) {
        const trimmed = line.trim();
        if (trimmed.startsWith(":")) {
            // A REPL command is never part of the program, even inside an
            // unfinished multiline buffer (mirroring the CLI REPL).
            inputBuffer = "";
            runCommand(term, trimmed.slice(1));
            return;
        }
        if (trimmed === "") {
            if (inputBuffer === "") {
                return;
            }
            const code = inputBuffer;
            inputBuffer = "";
            await runCode(term, code);
            return;
        }
        inputBuffer = inputBuffer ? inputBuffer + "\n" + trimmed : trimmed;
        if (svod.is_incomplete(inputBuffer)) {
            await submitLine(term, await term.read("...> "));
            return;
        }
        const code = inputBuffer;
        inputBuffer = "";
        await runCode(term, code);
    }

    const term = $("#terminal").terminal(
        function (input) {
            return submitLine(this, input);
        },
        {
            greetings: false,
            name: "svod",
            prompt: PROMPT,
            height: 700,
            historySize: 200,
            historyFilter: (line) => line.trim() !== "",
            exit: false,
            clear: false,
            onEchoCommand: function (el, cmd) {
                el.html(PROMPT_HTML + ansiToHtml(svod.highlight(cmd)));
            },
            keymap: {
                "CTRL+L": function () {
                    this.clear();
                },
            },
        },
    );

    // Welcome banner, bold green like the terminal REPL (ANSI 1;32 → Gruvbox).
    term.echo(ansiToHtml("\u001b[1;32m" + welcome_text() + "\u001b[0m"), { raw: true });

    document.getElementById("skeleton-loader").classList.add("hidden");
    term.focus(true);
}

main();
