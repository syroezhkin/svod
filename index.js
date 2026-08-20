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

// localStorage access may throw in private browsing; the prefs are best-effort.
function loadPref(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function savePref(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Private browsing or disabled storage: just don't persist.
    }
}

// The app languages supported by the browser locale mapping: countries where
// Russian is widely spoken (Russia, Belarus, Ukraine) → ru, everything else → en.
const SLAVIC_LOCALES = ["ru", "uk", "be"];

// The browser locale mapped to an app language, used only while the user has
// not chosen a language explicitly.
function systemLang() {
    const nav = navigator.language || navigator.userLanguage || "";
    const code = nav.split("-")[0].toLowerCase();
    return SLAVIC_LOCALES.includes(code) ? "ru" : "en";
}

// An explicitly saved choice wins; otherwise derive it from the locale.
function resolvedLang() {
    const saved = loadPref(LANG_KEY);
    return saved === "en" || saved === "ru" ? saved : systemLang();
}

// "dark" when the OS asks for dark colour scheme, "light" otherwise.
function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// An explicitly saved choice wins; otherwise follow the system theme.
function resolvedTheme() {
    const saved = loadPref(THEME_KEY);
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
        ru: "<strong>Svod</strong> — это современный интерпретатор расчетов, предназначенный для инженерных вычислений и создания технических отчетов.",
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

Output can be rendered as Typst or LaTeX with :format typst / :format latex.
`,
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

Вывод можно рендерить в Typst или LaTeX: :format typst / :format latex.`,
    };

    // Renders the examples block in the current language; the trailing note
    // (after the last blank line) stays plain prose in the body font. Reads the
    // active ANSI palette, so it is also called when the theme changes.
    function renderHelp() {
        const lang = document.getElementById("lang").value;
        const help = helps[lang];
        const noteAt = help.lastIndexOf("\n\n");
        const examples = noteAt === -1 ? help : help.slice(0, noteAt + 2);
        const note = noteAt === -1 ? "" : help.slice(noteAt + 2);
        document.getElementById("help").innerHTML =
            ansiToHtml(svod.highlight(examples)) +
            '<span class="help-note">' +
            escapeHtml(note).replace(
                /(:format (?:typst|latex))/g,
                '<code class="help-code">$1</code>',
            ) +
            "</span>";
    }

    function applyLang(lang) {
        svod.set_lang(lang);
        document.getElementById("tagline").innerHTML = taglines[lang];
        document.querySelector(".hint").textContent = hints[lang];
        const openFileBtn = document.getElementById("open-file");
        const openLabel = lang === "ru" ? "Открыть файл" : "Open file";
        openFileBtn.title = openLabel;
        openFileBtn.setAttribute("aria-label", openLabel);
        renderHelp();
    }

    document.getElementById("lang").addEventListener("change", (event) => {
        savePref(LANG_KEY, event.target.value);
        applyLang(event.target.value);
    });
    const lang = resolvedLang();
    document.getElementById("lang").value = lang;
    applyLang(lang);

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
        renderHelp();
    }

    applyTheme(resolvedTheme());
    themeButton.addEventListener("click", () => {
        const next =
            document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        savePref(THEME_KEY, next);
        applyTheme(next);
    });
    // Follow the OS theme live, but only while the user has not chosen
    // explicitly: an explicit pick always wins.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (loadPref(THEME_KEY) === null) {
            applyTheme(e.matches ? "dark" : "light");
        }
    });
    // Some Chromium forks never fire the change event live; they refresh
    // `matchMedia` when the tab regains focus/visibility. Re-check there.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && loadPref(THEME_KEY) === null) {
            applyTheme(systemTheme());
        }
    });
    window.addEventListener("focus", () => {
        if (loadPref(THEME_KEY) === null) {
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
                // A choice() prompt is a numbered list (one item per line)
                // followed by the question on the last line; echo the list and
                // read the answer after the final newline, like the CLI REPL.
                const prompt = result.pending_prompt;
                const nl = prompt.lastIndexOf("\n");
                if (nl !== -1) {
                    term.echo(ansiToHtml(prompt.slice(0, nl)), { raw: true });
                    svod.queue_input(await term.read(prompt.slice(nl + 1)));
                } else {
                    svod.queue_input(await term.read(prompt));
                }
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
            height: 240,
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

    // Loading a .svod file runs it like a CLI script: only the results are
    // echoed, `input`/`choice()` prompts ask via the usual read mechanism.
    const openFileBtn = document.getElementById("open-file");
    const fileInput = document.getElementById("file-input");
    openFileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        fileInput.value = "";
        if (!file) {
            return;
        }
        const source = (await file.text())
            .replace(/^\uFEFF/, "")
            .replace(/\r\n/g, "\n");
        if (!source.trim()) {
            return;
        }
        await runCode(term, source);
    });

    document.getElementById("skeleton-loader").classList.add("hidden");
    // On touch devices, auto-focusing on load scrolls the page down to the
    // terminal (below the header), and without a user gesture the keyboard may
    // not open either. Let the user tap the terminal.
    if (!window.matchMedia("(pointer: coarse)").matches) {
        term.focus(true);
    }

    // On phones the on-screen keyboard shrinks the visual viewport, which CSS
    // viewport units ignore. When the keyboard is open, keep the header
    // visible and size the terminal to the remaining space so the input line
    // stays above the keyboard instead of the browser scrolling it away.
    // `userHeight` (set by dragging the corner grip) is restored whenever the
    // keyboard closes.
    //
    // The collapsible browser toolbar also shrinks the visual viewport, but by
    // far less than a keyboard (tens of px vs. a third of the screen). The gap
    // threshold must sit above that, otherwise the toolbar expanding/collapsing
    // while the user scrolls is mistaken for a keyboard toggling and the page
    // jumps to the header. We also react to *resize* only: the toolbar and the
    // keyboard both emit resize, but plain scrolling emits a stream of scroll
    // events that must not re-run the layout.
    const DEFAULT_TERMINAL_HEIGHT = 240;
    const KEYBOARD_VV_GAP = 150;
    let userHeight = null;
    let wasKeyboardOpen = false;
    function sizeTerminal() {
        const vv = window.visualViewport;
        const terminal = document.getElementById("terminal");
        const keyboardOpen = vv && vv.height < window.innerHeight - KEYBOARD_VV_GAP;
        if (keyboardOpen) {
            const header = document.querySelector("#content header");
            const topOffset = 4;
            if (!wasKeyboardOpen) {
                const headerDocTop = header
                    ? header.getBoundingClientRect().top + window.scrollY
                    : 0;
                window.scrollTo(0, Math.max(0, headerDocTop - topOffset));
            }
            // Distance from the header's top to the terminal's top (includes
            // the header and the margins), in document coordinates so it is
            // invariant to scrolling.
            const headerTop = header ? header.getBoundingClientRect().top + window.scrollY : 0;
            const terminalTop = terminal.getBoundingClientRect().top + window.scrollY;
            const gap = terminalTop - headerTop;
            terminal.style.height = Math.max(160, Math.round(vv.height - gap - topOffset - 8)) + "px";
            wasKeyboardOpen = true;
        } else {
            terminal.style.height = (userHeight || DEFAULT_TERMINAL_HEIGHT) + "px";
            wasKeyboardOpen = false;
        }
    }
    window.visualViewport?.addEventListener("resize", sizeTerminal);
    window.addEventListener("resize", sizeTerminal);
    window.addEventListener("orientationchange", sizeTerminal);
    sizeTerminal();

    // Resize the terminal by dragging its bottom-right corner grip.
    const terminalGrip = document.createElement("div");
    terminalGrip.id = "terminal-grip";
    terminalGrip.setAttribute("aria-hidden", "true");
    document.getElementById("terminal").appendChild(terminalGrip);

    let dragging = false;
    let dragStartY = 0;
    let dragStartHeight = 0;
    terminalGrip.addEventListener("pointerdown", (e) => {
        dragging = true;
        dragStartY = e.clientY;
        dragStartHeight = parseInt(document.getElementById("terminal").style.height, 10) || DEFAULT_TERMINAL_HEIGHT;
        document.body.classList.add("resizing");
        terminalGrip.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    terminalGrip.addEventListener("pointermove", (e) => {
        if (!dragging) {
            return;
        }
        const h = Math.max(200, Math.min(1200, dragStartHeight + (e.clientY - dragStartY)));
        userHeight = Math.round(h);
        document.getElementById("terminal").style.height = userHeight + "px";
    });
    terminalGrip.addEventListener("pointerup", () => {
        dragging = false;
        document.body.classList.remove("resizing");
    });
    terminalGrip.addEventListener("pointercancel", () => {
        dragging = false;
        document.body.classList.remove("resizing");
    });
    // Belt-and-suspenders for browsers that ignore `touch-action: none`: block
    // the page scroll during the drag so the gesture always resizes the REPL
    // instead of scrolling. `passive: false` is required for preventDefault.
    terminalGrip.addEventListener("touchmove", (e) => {
        if (dragging) {
            e.preventDefault();
        }
    }, { passive: false });

    // Keep the scrollbar compensation for the full-bleed examples strip in
    // sync (e.g. toggling devtools or rotating the device changes it).
    function updateScrollbarVar() {
        const sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        document.documentElement.style.setProperty("--sbw", sbw + "px");
    }
    window.addEventListener("resize", updateScrollbarVar);
    updateScrollbarVar();

    // The examples strip and the help block are horizontally scrollable but
    // hide their scrollbars, so a mouse has no native way to scroll them: the
    // wheel scrolls the page vertically and there is no drag. Wire both up.
    // Touch keeps its native swipe scrolling untouched.

    // The vertical wheel scrolls the strip horizontally; any part of the wheel
    // delta that cannot be consumed (strip already at an edge) is passed to the
    // page so the document still scrolls while hovering the strip.
    function enableWheelScroll(el) {
        el.addEventListener("wheel", (e) => {
            if (e.ctrlKey) {
                return;
            }
            if (el.scrollWidth <= el.clientWidth + 1) {
                return;
            }
            const max = el.scrollWidth - el.clientWidth;
            const before = el.scrollLeft;
            const target = before + e.deltaY;
            const clamped = Math.max(0, Math.min(max, target));
            if (clamped !== before) {
                el.scrollLeft = clamped;
                e.preventDefault();
            }
            const remaining = target - clamped;
            if (remaining !== 0) {
                window.scrollBy(0, remaining);
            }
        }, { passive: false });
    }

    // Mouse drag-to-scroll. A drag must not open the image in a new tab, so if
    // the pointer travelled more than a few pixels the following click is
    // suppressed; a plain click still follows the link.
    function enableDragScroll(el) {
        let dragging = false;
        let startX = 0;
        let startScrollLeft = 0;
        let moved = 0;

        el.addEventListener("pointerdown", (e) => {
            if (e.pointerType !== "mouse" || e.button !== 0) {
                return;
            }
            dragging = true;
            moved = 0;
            startX = e.clientX;
            startScrollLeft = el.scrollLeft;
            el.classList.add("dragging");
            e.preventDefault();
        });

        window.addEventListener("pointermove", (e) => {
            if (!dragging) {
                return;
            }
            const dx = e.clientX - startX;
            el.scrollLeft = startScrollLeft - dx;
            moved = Math.max(moved, Math.abs(dx));
        });

        function endDrag(e) {
            if (!dragging) {
                return;
            }
            dragging = false;
            el.classList.remove("dragging");
            if (moved > 5) {
                el.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                }, { capture: true, once: true });
            }
        }
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);
    }

    const scrollStrips = [
        document.getElementById("examples"),
        document.getElementById("help"),
    ];
    for (const el of scrollStrips) {
        if (el) {
            enableWheelScroll(el);
            enableDragScroll(el);
        }
    }
}

main();
