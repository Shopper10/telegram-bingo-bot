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
    } catch (e) {
        console.log("Error:", e.message);
    }
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
// ANIMACIÓN CASINO
// =====================
async function animacionCasino(chatId) {

    const frames = [
        "🎰 Iniciando casino...",
        "🎲 Girando ruleta...",
        "🎰 █▒▒▒▒▒▒",
        "🎰 ███▒▒▒▒",
        "🎰 █████▒▒",
        "💰 CASINO ONLINE"
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
// TABLERO CASINO
// =====================
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];

        let text = `🟢🎰 ${i} DISPONIBLE`;

        if (item) {

            const u = item.user.name;

            if (item.estado === "reservado" || item.estado === "pendiente") {

                let restante = 600000 - (Date.now() - startTimes[i]);

                text = `🔴🎰 ${i} ${u} ⏱ ${formatTiempo(restante)}`;
            }

            if (item.estado === "pagado") {
                text = `🟡💰 ${i} ${u}`;
            }
        }

        kb.push([{ text, callback_data: `num_${i}` }]);
    }

    return kb;
}

// =====================
// REENVIAR TABLERO
// =====================
function reenviarTablero() {

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
// TIMER 10 MIN
// =====================
function iniciarTimer(num) {

    startTimes[num] = Date.now();
    alertados[num] = { a2: false, a1: false };

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
`⛔️ LIBERADO

🎰 ${num}
👤 ${user}
⌛ Sin pago`);
    }, 600000);
}

// =====================
// LOOP ALERTAS
// =====================
setInterval(() => {

    for (let i in numeros) {

        const item = numeros[i];
        if (!item) continue;

        if (item.estado === "pagado") continue;

        let restante = 600000 - (Date.now() - startTimes[i]);

        if (!alertados[i]) continue;

        if (restante <= 120000 && !alertados[i].a2) {
            alertados[i].a2 = true;

            bot.sendMessage(tableroChatId,
`⚠️ 2 MIN

🎰 ${i}`);
        }

        if (restante <= 60000 && !alertados[i].a1) {
            alertados[i].a1 = true;

            bot.sendMessage(tableroChatId,
`🔥 ÚLTIMO MINUTO

🎰 ${i}`);
        }
    }

    actualizarTablero();

}, 2000);

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
// START
// =====================
cargarDatos();

bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    await animacionCasino(msg.chat.id);

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 CASINO BINGO PRO

💰 Total: $${totalDinero}
🔥 ONLINE`, {
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
📸 Envía pago
⏱ 10 min`);
});

// =====================
// ADMIN
// =====================
bot.on('callback_query', (query) => {

    if (query.from.id !== ADMIN_ID) return;

    const data = query.data;

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

        bot.sendMessage(tableroChatId,
`✅ APROBADO

🎰 ${nums.join(", ")}`);

        reenviarTablero();
    }

    if (data.startsWith("no_")) {

        const nums = data.split("_")[1].split("-");

        nums.forEach(n => {
            delete numeros[n];
            if (timers[n]) clearTimeout(timers[n]);
        });

        guardarDatos();

        bot.sendMessage(tableroChatId,
`❌ RECHAZADO`);

        reenviarTablero();
    }
});

// =====================
// FOTO + RUEDA CASINO
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

    // 🎰 animación casino
    let anim = await bot.sendMessage(msg.chat.id,
`🎰 COMPROBANTE RECIBIDO`);

    const fx = ["🎰", "🎲", "🎰🎲", "💰 CASINO CHECK"];

    for (let i = 0; i < fx.length; i++) {
        await new Promise(r => setTimeout(r, 500));

        await bot.editMessageText(fx[i], {
            chat_id: msg.chat.id,
            message_id: anim.message_id
        });
    }

    bot.sendPhoto(tableroChatId, fileId, {
        caption:
`📥 COMPROBANTE CASINO

👤 ${getUser(msg.from)}
🎰 ${nums.join(", ")}

⚠️ ADMIN REVISA`,
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