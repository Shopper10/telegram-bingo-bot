const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

if (global.__RUN__) process.exit(0);
global.__RUN__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 1500 }
});

const DB_FILE = "./data.json";

let db = { numeros: {}, total: 0 };
let chatId = null;
let messageId = null;
let bingoIniciado = false;

// =====================
function load() {
    if (fs.existsSync(DB_FILE)) {
        db = JSON.parse(fs.readFileSync(DB_FILE));
    }
}
function save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
load();

// =====================
function getUser(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
function getMinutesLeft(start) {
    const limit = 10 * 60 * 1000;
    const diff = limit - (Date.now() - start);
    return Math.ceil(diff / 60000);
}

// =====================
// 🎰 TABLERO LIMPIO
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const item = db.numeros[i];

        if (!item) {
            kb.push([{ text: `🟢 ${i}`, callback_data: `buy_${i}` }]);
            continue;
        }

        if (item.estado === "reservado" || item.estado === "pendiente") {
            kb.push([{
                text: `⛔️ ${item.name} ⏱ ${getMinutesLeft(item.time)}min`,
                callback_data: "wait"
            }]);
            continue;
        }

        if (item.estado === "pagado") {
            kb.push([{ text: `✅ ${item.name}`, callback_data: "wait" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(
`🎰 CASINO BINGO

💰 Total: $${db.total}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: generarTablero()
    }).catch(()=>{});

    checkFull();
}

// =====================
// 🚀 /bingo (RESET TOTAL)
bot.onText(/\/bingo/, async (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    chatId = msg.chat.id;

    // 🔥 RESET TOTAL
    db.numeros = {};
    db.total = 0;
    bingoIniciado = false;

    save();

    const sent = await bot.sendMessage(chatId,
`🎰 CASINO BINGO - NUEVA PARTIDA`, {
        reply_markup: generarTablero()
    });

    messageId = sent.message_id;
});

// =====================
// 🎯 COMPRA
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    if (!q.data.startsWith("buy_")) return;

    let n = q.data.split("_")[1];

    if (db.numeros[n]) return;

    db.numeros[n] = {
        name: getUser(q.from),
        estado: "reservado",
        time: Date.now()
    };

    db.total += 3000;

    save();
    updateBoard();

    bot.sendMessage(chatId,
`💰 RESERVADO
🎰 ${n}
⏱ 10 MIN`);
});

// =====================
// 📸 FOTO + BARRA
bot.on("message", (msg) => {

    if (!msg.photo) return;

    let nums = [];

    for (let n in db.numeros) {
        if (db.numeros[n].name === getUser(msg.from)) {
            db.numeros[n].estado = "pendiente";
            nums.push(n);
        }
    }

    if (!nums.length) return;

    save();

    const bar = [
        "⬜️⬜️⬜️⬜️⬜️",
        "🟩⬜️⬜️⬜️⬜️",
        "🟩🟩⬜️⬜️⬜️",
        "🟩🟩🟩⬜️⬜️",
        "🟩🟩🟩🟩⬜️",
        "🟩🟩🟩🟩🟩"
    ];

    let i = 0;

    bot.sendMessage(chatId, "🔍 COMPROBANDO PAGO...").then((m) => {

        let id = m.message_id;

        let interval = setInterval(() => {

            bot.editMessageText(
`🔍 COMPROBANDO PAGO...

${bar[i]}`, {
                chat_id: chatId,
                message_id: id
            }).catch(()=>{});

            i++;

            if (i >= bar.length) {

                clearInterval(interval);

                bot.sendMessage(chatId,
`📸 PAGO RECIBIDO
🎰 ${nums.join(", ")}
👤 ${getUser(msg.from)}`);

                bot.sendMessage(ADMIN_ID,
`📸 APROBAR PAGO

🎰 ${nums.join(", ")}
👤 ${getUser(msg.from)}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "🟢 APROBAR", callback_data: `ok_${nums.join("-")}` },
                                { text: "🔴 RECHAZAR", callback_data: `no_${nums.join("-")}` }
                            ]
                        ]
                    }
                });
            }

        }, 700);
    });
});

// =====================
// 👮 ADMIN CONTROL
bot.on("callback_query", (q) => {

    if (q.from.id !== ADMIN_ID) return;

    let d = q.data;

    if (d.startsWith("ok_")) {

        let nums = d.split("_")[1].split("-");

        nums.forEach(n => {
            if (db.numeros[n]) db.numeros[n].estado = "pagado";
        });

        save();
        updateBoard();

        bot.sendMessage(ADMIN_ID, "✅ APROBADO");
    }

    if (d.startsWith("no_")) {

        let nums = d.split("_")[1].split("-");

        nums.forEach(n => delete db.numeros[n]);

        save();
        updateBoard();

        bot.sendMessage(ADMIN_ID, "❌ RECHAZADO");
    }
});

// =====================
function checkFull() {

    if (!bingoIniciado && Object.keys(db.numeros).length === 15) {

        bingoIniciado = true;

        bot.sendMessage(chatId, "🎰 INICIO DE BINGO");
    }
}

// =====================
bot.onText(/\/admin/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    if (msg.chat.type !== "private") {
        bot.sendMessage(msg.chat.id, "❌ Solo privado");
        return;
    }

    bot.sendMessage(msg.chat.id,
`🎛 PANEL ADMIN

💰 Total: $${db.total}`);
});