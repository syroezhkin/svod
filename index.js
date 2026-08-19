import init, { Svod, setup_panic_hook, welcome_text } from "./pkg/svod_web.js";

// Gruvbox light ANSI palette. jQuery Terminal renders ANSI via hardcoded CSS
// colour keywords and ignores 256-colour codes, so the Rust ANSI output is
// converted to HTML with the exact Gruvbox colours here instead.
const ANSI_COLORS = {
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

// 256-colour foregrounds used by the shared highlighter (only the comment
// grey 245 today), mapped onto the Gruvbox palette. The comment tone is
// darker than the UI chrome (`#928374`) so it reads as dimmed text.
const ANSI_256 = {
    245: "#7c6f64",
};

const LANG_KEY = "svod-lang";

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
                if (ANSI_256[x]) {
                    state.fg = ANSI_256[x];
                }
                i += 2;
            } else if (ANSI_COLORS[n]) {
                state.fg = ANSI_COLORS[n];
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

    const PROMPT = "svod> ";
    const PROMPT_HTML = `<span style="color:#af3a03;font-weight:bold">${PROMPT}</span>`;

    const term = $("#terminal").terminal(
        async function (input) {
            const trimmed = input.trim();
            if (trimmed === "") {
                return;
            }
            if (trimmed.startsWith(":")) {
                const r = svod.command(trimmed.slice(1));
                if (r.quit) {
                    window.location.reload();
                    return;
                }
                if (r.clear) {
                    this.clear();
                }
                if (r.text) {
                    this.echo(ansiToHtml(r.text), { raw: true });
                }
                return;
            }
            svod.reset_input();
            while (true) {
                const result = svod.interpret(input);
                if (result.pending_prompt) {
                    svod.queue_input(await term.read(result.pending_prompt));
                    continue;
                }
                if (result.output) {
                    this.echo(ansiToHtml(result.output), { raw: true });
                }
                return;
            }
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
