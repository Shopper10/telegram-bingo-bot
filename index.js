const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

const DATA_FILE = "./data.json";

// =====================
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};

let bingoActivo = false;
let numerosSorteados = [];

// =====================
function cargarDatos() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            numeros = data.numeros || {};
            totalDinero = data.totalDinero || 0;
        }
    } catch (e) {}
}

function guardarDatos() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        numeros,
        totalDinero
    }));
}

// =====================
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// =====================
function formatTiempo(ms) {
    let t = Math.max(0, Math.floor(ms / 1000));
    let m = Math.floor(t / 60);
    let s = t % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// =====================
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];

        if (!item) {
            kb.push([{
                text: `🟢 ${i}- DISPONIBLE`,
                callback_data: `num_${i}`
            }]);
            continue;
        }

        let text = `🟢 ${i}- DISPONIBLE`;

        if (item.estado === "reservado" || item.estado === "pendiente") {

            let restante = 600000 - (Date.now() - startTimes[i]);
            text = `⛔ ${i}- ${item.user.name} ⏱ ${formatTiempo(restante)}`;
        }

        if (item.estado === "pagado") {
            text = `✅ ${i}- ${item.user.name} - PAGADO`;
        }

        kb.push([{ text, callback_data: `num_${i}` }]);
    }

    return kb;
}

// =====================
function repostTablero() {

    if (!tableroChatId) return;

    bot.sendMessage(tableroChatId,
`🎰 CASINO BINGO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });
}

// =====================
// DEBUG SYSTEM 🔥
function debugEstado(chatId) {

    let pagados = [];
    let pendientes = [];
    let reservados = [];
    let faltantes = [];

    for (let i = 1; i <= 15; i++) {

        const n = numeros[i];

        if (!n) {
            faltantes.push(i);
        } else if (n.estado === "pagado") {
            pagados.push(i);
        } else if (n.estado === "pendiente") {
            pendientes.push(i);
        } else {
            reservados.push(i);
        }
    }

    const msg =
`🧠 DEBUG CASINO

✅ PAGADOS: ${pagados.join(", ") || "ninguno"}
⏳ PENDIENTES: ${pendientes.join(", ") || "ninguno"}
⛔ RESERVADOS: ${reservados.join(", ") || "ninguno"}
❌ FALTANTES: ${faltantes.join(", ") || "ninguno"}

📊 TOTAL PAGADOS: ${pagados.length}/15`;

    bot.sendMessage(chatId, msg);
}

// =====================
function todosVendidos() {

    let count = 0;

    for (let i = 1; i <= 15; i++) {
        if (numeros[i] && numeros[i].estado === "pagado") {
            count++;
        }
    }

    console.log("VENDIDOS:", count);

    return count === 15;
}

// =====================
function iniciarBingo() {

    if (bingoActivo) return;

    bingoActivo = true;
    numerosSorteados = [];

    bot.sendMessage(tableroChatId,
`🎉 TODOS LOS NÚMEROS VENDIDOS

🎰 INICIA EL BINGO`);

    setTimeout(sacarNumero, 3000);
}

// =====================
function sacarNumero() {

    if (!bingoActivo) return;

    let disponibles = [];

    for (let i = 1; i <= 15; i++) {
        if (!numerosSorteados.includes(i)) {
            disponibles.push(i);
        }
    }

    if (!disponibles.length) return;

    let num = disponibles[Math.floor(Math.random() * disponibles.length)];

    numerosSorteados.push(num);

    bot.sendMessage(tableroChatId,
`🎰 SALE: ${num}

📊 ${numerosSorteados.join(" - ")}`);

    verificarGanador();

    setTimeout(sacarNumero, 2500);
}

// =====================
function verificarGanador() {

    const lineas = [
        [1,2,3,4,5],
        [6,7,8,9,10],
        [11,12,13,14,15]
    ];

    for (let l of lineas) {

        if (l.every(n => numerosSorteados.includes(n))) {

            bingoActivo = false;

            bot.sendMessage(tableroChatId,
`🏆 ¡BINGO!

🎯 Línea: ${l.join(" - ")}`);

            return;
        }
    }
}

// =====================
function iniciarTimer(num) {

    startTimes[num] = Date.now();

    if (timers[num]) clearTimeout(timers[num]);

    timers[num] = setTimeout(() => {

        if (!numeros[num] || numeros[num].estado === "pagado") return;

        const user = numeros[num].user.name;

        delete numeros[num];

        guardarDatos();

        bot.sendMessage(tableroChatId,
`⛔ LIBERADO

🎰 ${num}
👤 ${user}`);

    }, 600000);
}

// =====================
setInterval(() => {

    if (!tableroChatId || !tableroMessageId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: tableroChatId,
            message_id: tableroMessageId
        }
    ).catch(() => {});

}, 6000);

// =====================
cargarDatos();

// =====================
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 CASINO BINGO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// ===================== 🔥 DEBUG COMMAND
bot.onText(/\/debug/, (msg) => {
    debugEstado(msg.chat.id);
});

// =====================
bot.on('callback_query', (query) => {

    const data = query.data;

    if (data.startsWith("num_")) {

        const num = parseInt(data.split("_")[1]);

        if (numeros[num]) return;

        numeros[num] = {
            user: {
                id: query.from.id,
                name: getUser(query.from)
            },
            estado: "reservado"
        };

        iniciarTimer(num);
        guardarDatos();

        bot.sendMessage(tableroChatId,
`🎰 TOMADO

🎰 ${num}
👤 ${numeros[num].user.name}

💰 Nequi: 3123902322
⏱ 10 min`);

        return;
    }

    if (query.from.id !== ADMIN_ID) return;

    const nums = data.split("_")[1]?.split("-") || [];

    if (data.startsWith("ok_")) {

        nums.forEach(n => {
            if (numeros[n]) {
                numeros[n].estado = "pagado";
                totalDinero += 3000;
                if (timers[n]) clearTimeout(timers[n]);
            }
        });

        guardarDatos();

        bot.sendMessage(tableroChatId, "🔍 COMPROBANDO PAGO...");

        repostTablero();

        setTimeout(() => {

            if (todosVendidos()) {
                bot.sendMessage(tableroChatId, "🎉 TODOS LOS NÚMEROS VENDIDOS");
                iniciarBingo();
            }

        }, 1200);

        return;
    }

    if (data.startsWith("no_")) {

        nums.forEach(n => {
            delete numeros[n];
            if (timers[n]) clearTimeout(timers[n]);
        });

        guardarDatos();

        bot.sendMessage(tableroChatId, "❌ RECHAZADO");

        repostTablero();
        return;
    }
});

// =====================
bot.on('message', (msg) => {

    if (!msg.photo) return;

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in numeros) {

        const item = numeros[n];

        if (item && item.user.id === userId &&
            (item.estado === "reservado" || item.estado === "pendiente")) {
            nums.push(n);
        }
    }

    if (!nums.length) return;

    nums.forEach(n => {
        numeros[n].estado = "pendiente";
    });

    guardarDatos();

    bot.sendMessage(tableroChatId, "🔍 COMPROBANDO PAGO...");

    bot.sendPhoto(tableroChatId, fileId, {
        caption: `📥 COMPROBANTE\n👤 ${getUser(msg.from)}\n🎰 ${nums.join(", ")}`,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🟢 APROBAR", callback_data: `ok_${nums.join("-")}` },
                    { text: "🔴 RECHAZAR", callback_data: `no_${nums.join("-")}` }
                ]
            ]
        }
    });
});