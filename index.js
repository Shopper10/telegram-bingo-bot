const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 1500 }
});

let db = { numeros: {}, total: 0 };
let chatId = null;
let boardMessageId = null;

// =====================
function save() {
    fs.writeFileSync("./data.json", JSON.stringify(db, null, 2));
}

// =====================
function getUser(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
// ⏱ TIEMPO DINÁMICO
function timeLeft(start) {

    const diff = 10 * 60 * 1000 - (Date.now() - start);

    if (diff <= 0) return "0:00";

    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    return `${m}:${s < 10 ? "0" + s : s}`;
}

// =====================
// 🎰 TABLERO (GRUPO)
function board() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i}`, callback_data: `buy_${i}` }]);
            continue;
        }

        if (n.estado === "reservado") {
            kb.push([{
                text: `⛔️ ${n.name} ⏱ ${timeLeft(n.time)}`,
                callback_data: "none"
            }]);
            continue;
        }

        if (n.estado === "pendiente") {
            kb.push([{ text: `🔍 ${n.name}`, callback_data: "none" }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{ text: `✅ ${n.name}`, callback_data: "none" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
// 🚀 /bingo (SOLO ADMIN EN GRUPO)
bot.onText(/\/bingo/, async (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    chatId = msg.chat.id;

    db.numeros = {};
    db.total = 0;

    save();

    const sent = await bot.sendMessage(chatId,
`🎰 BINGO INICIADO`, {
        reply_markup: board()
    });

    boardMessageId = sent.message_id;
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

    refreshBoard();
});

// =====================
// 📸 PAGO
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

    bot.sendMessage(chatId,
`📸 EN REVISIÓN: ${nums.join(", ")}`, {
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

// =====================
// 👮 ADMIN
bot.on("callback_query", (q) => {

    if (q.from.id !== ADMIN_ID) return;

    if (q.data.startsWith("ok_")) {

        let nums = q.data.split("_")[1].split("-");

        nums.forEach(n => {
            if (db.numeros[n]) db.numeros[n].estado = "pagado";
        });

        save();
        refreshBoard();
    }

    if (q.data.startsWith("no_")) {

        let nums = q.data.split("_")[1].split("-");

        nums.forEach(n => delete db.numeros[n]);

        save();
        refreshBoard();
    }
});

// =====================
// 🔄 ACTUALIZACIÓN CONTROLADA (CLAVE)
function refreshBoard() {

    if (!chatId || !boardMessageId) return;

    bot.editMessageReplyMarkup(board(), {
        chat_id: chatId,
        message_id: boardMessageId
    }).catch(()=>{});
}

// =====================
// ⏱ MOTOR 10 MIN (SIN CONGELAR)
setInterval(() => {

    let changed = false;

    for (let n in db.numeros) {

        const item = db.numeros[n];

        if (item.estado === "reservado") {

            if (Date.now() - item.time >= 10 * 60 * 1000) {

                delete db.numeros[n];

                db.total -= 3000;

                changed = true;
            }
        }
    }

    if (changed) {
        save();
        refreshBoard();
    }

}, 5000);