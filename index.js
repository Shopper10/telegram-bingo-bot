const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

const DATA_FILE = "./data.json";

// =====================
// ESTADO
// =====================
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};
let alertados = {};

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
// TABLERO CASINO
// =====================
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];

        let text = `🟢 ${i} DISPONIBLE`;

        if (item) {

            const u = item.user.name;

            if (item.estado === "reservado" || item.estado === "pendiente") {
                let restante = 600000 - (Date.now() - startTimes[i]);
                text = `⛔ ${i} ${u} ⏱ ${formatTiempo(restante)}`;
            }

            if (item.estado === "pagado") {
                text = `🟡 ${i} ${u} ✔`;
            }
        }

        kb.push([{ text, callback_data: `num_${i}` }]);
    }

    return kb;
}

// =====================
// REPOST TABLERO LIMPIO
// =====================
function repostTablero() {

    if (!tableroChatId) return;

    bot.sendMessage(tableroChatId,
`🎰 TABLERO CASINO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    }).then(msg => {
        tableroMessageId = msg.message_id;
    });
}

// =====================
// UPDATE BOTONES
// =====================
function actualizarTablero() {

    if (!tableroChatId || !tableroMessageId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: tableroChatId,
            message_id: tableroMessageId
        }
    ).catch(() => {});
}

// =====================
// TIMER 10 MIN
// =====================
function iniciarTimer(num) {

    startTimes[num] = Date.now();
    alertados[num] = {};

    if (timers[num]) clearTimeout(timers[num]);

    timers[num] = setTimeout(() => {

        const item = numeros[num];

        if (!item || item.estado === "pagado") return;

        const user = item.user.name;

        delete numeros[num];
        delete timers[num];
        delete startTimes[num];
        delete alertados[num];

        guardarDatos();

        bot.sendMessage(tableroChatId,
`⛔ LIBERADO

🎰 ${num}
👤 ${user}`);
    }, 600000);
}

// =====================
// LOOP OPTIMIZADO
// =====================
setInterval(() => {

    actualizarTablero();

}, 6000);

// =====================
// START ANIM
// =====================
async function animacionCasino(chatId) {

    const frames = [
        "🎰 Iniciando casino...",
        "🎲 Girando...",
        "💰 Preparando sistema...",
        "🎰 ONLINE"
    ];

    let msg = await bot.sendMessage(chatId, frames[0]);

    for (let i = 1; i < frames.length; i++) {
        await new Promise(r => setTimeout(r, 500));
        await bot.editMessageText(frames[i], {
            chat_id: chatId,
            message_id: msg.message_id
        });
    }
}

// =====================
// START
// =====================
cargarDatos();

bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    await animacionCasino(msg.chat.id);

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 CASINO BINGO PRO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// =====================
// TOMAR NÚMERO
// =====================
bot.on('callback_query', (query) => {

    const data = query.data;

    if (!data.startsWith("num_")) return;

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
});

// =====================
// ADMIN CONTROL
// =====================
bot.on('callback_query', (query) => {

    if (query.from.id !== ADMIN_ID) return;

    const data = query.data;

    // ✅ APROBAR
    if (data.startsWith("ok_")) {

        const nums = data.split("_")[1].split("-");

        nums.forEach(n => {
            if (numeros[n]) {
                numeros[n].estado = "pagado";
                totalDinero += 3000;
                if (timers[n]) clearTimeout(timers[n]);
            }
        });

        guardarDatos();

        // 💥 MENSAJE CONFIRMADO
        bot.sendMessage(tableroChatId, "✅ CONFIRMADO ✔").then(msg => {

            setTimeout(() => {
                bot.deleteMessage(tableroChatId, msg.message_id).catch(() => {});
            }, 3000);
        });

        repostTablero();
    }

    // ❌ RECHAZAR
    if (data.startsWith("no_")) {

        const nums = data.split("_")[1].split("-");

        nums.forEach(n => {
            delete numeros[n];
            if (timers[n]) clearTimeout(timers[n]);
        });

        guardarDatos();

        bot.sendMessage(tableroChatId, "❌ RECHAZADO");

        repostTablero();
    }
});

// =====================
// FOTO + RUEDA
// =====================
bot.on('message', async (msg) => {

    if (!msg.photo) return;

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in numeros) {

        const item = numeros[n];

        if (
            item &&
            item.user.id === userId &&
            (item.estado === "reservado" || item.estado === "pendiente")
        ) {
            nums.push(n);
        }
    }

    if (!nums.length) return;

    nums.forEach(n => {
        numeros[n].estado = "pendiente";
        iniciarTimer(n);
    });

    guardarDatos();

    let anim = await bot.sendMessage(msg.chat.id, "🎰 VALIDANDO PAGO...");

    const fx = ["🎰", "🎲", "💰 CASINO CHECK"];

    for (let i = 0; i < fx.length; i++) {
        await new Promise(r => setTimeout(r, 500));

        await bot.editMessageText(fx[i], {
            chat_id: msg.chat.id,
            message_id: anim.message_id
        });
    }

    bot.sendPhoto(tableroChatId, fileId, {
        caption:
`📥 COMPROBANTE

👤 ${getUser(msg.from)}
🎰 ${nums.join(", ")}

⚠️ EN REVISIÓN`,
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