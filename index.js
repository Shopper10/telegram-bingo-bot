const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// =====================
// ANTI DUPLICADO (RAILWAY FIX)
// =====================
if (global.botRunning) {
    console.log("BOT YA ACTIVO - evitando duplicado");
    process.exit(0);
}
global.botRunning = true;

// =====================
const DATA_FILE = "./data.json";

// =====================
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};

// =====================
// LOAD / SAVE
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
// USER
// =====================
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// =====================
// TIEMPO
// =====================
function formatTiempo(ms) {
    let t = Math.max(0, Math.floor(ms / 1000));
    let m = Math.floor(t / 60);
    let s = t % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// =====================
// TABLERO (FIX CLAVE)
// =====================
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];

        // 🔥 SIEMPRE DISPONIBLE SI NO EXISTE
        if (!item) {
            kb.push([{
                text: `🟢 ${i} - DISPONIBLE`,
                callback_data: `num_${i}`
            }]);
            continue;
        }

        const u = item.user.name;

        let text = `🟢 ${i} - DISPONIBLE`;

        if (item.estado === "reservado" || item.estado === "pendiente") {

            let restante = 600000 - (Date.now() - startTimes[i]);

            text = `⛔ ${i} - ${u} ⏱ ${formatTiempo(restante)}`;
        }

        if (item.estado === "pagado") {
            text = `✅ ${i} - ${u}`;
        }

        kb.push([{
            text,
            callback_data: `num_${i}`
        }]);
    }

    return kb;
}

// =====================
// REPOST TABLERO
// =====================
function repostTablero() {

    if (!tableroChatId) return;

    bot.sendMessage(tableroChatId,
`🎰 CASINO BINGO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    }).then(msg => {
        tableroMessageId = msg.message_id;
    });
}

// =====================
// TIMER 10 MIN
// =====================
function iniciarTimer(num) {

    startTimes[num] = Date.now();

    if (timers[num]) clearTimeout(timers[num]);

    timers[num] = setTimeout(() => {

        const item = numeros[num];

        if (!item || item.estado === "pagado") return;

        const user = item.user.name;

        delete numeros[num];
        delete timers[num];
        delete startTimes[num];

        guardarDatos();

        bot.sendMessage(tableroChatId,
`⛔ LIBERADO

🎰 ${num}
👤 ${user}`);

    }, 600000);
}

// =====================
// LOOP RÁPIDO RAILWAY SAFE
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
// START
// =====================
cargarDatos();

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

// =====================
// CALLBACKS (FIXED)
// =====================
bot.on('callback_query', (query) => {

    const data = query.data;

    // =====================
    // TOMAR NÚMERO
    // =====================
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

    // =====================
    // APROBAR
    // =====================
    if (data.startsWith("ok_")) {

        nums.forEach(n => {
            if (numeros[n]) {
                numeros[n].estado = "pagado";
                totalDinero += 3000;
                if (timers[n]) clearTimeout(timers[n]);
            }
        });

        guardarDatos();

        bot.sendMessage(tableroChatId, "✅ CONFIRMADO ✔");

        repostTablero();
        return;
    }

    // =====================
    // RECHAZAR
    // =====================
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