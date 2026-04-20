const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

let db = { numeros: {} };
let chatId = null;
let boardId = null;

// =====================
function save() {
    fs.writeFileSync("./data.json", JSON.stringify(db, null, 2));
}

// =====================
function user(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
// ⏱ TIEMPO REAL (NO SE GUARDA, SE CALCULA)
function timeLeft(start) {

    const diff = 10 * 60 * 1000 - (Date.now() - start);

    if (diff <= 0) return "0:00";

    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    return `${m}:${s < 10 ? "0" + s : s}`;
}

// =====================
// 🎰 TABLERO
function board() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i}`, callback_data: `buy_${i}` }]);
            continue;
        }

        if (n.estado === "reservado") {
            kb.push([{ text: `⛔️ ${n.name} ⏱ ${timeLeft(n.time)}`, callback_data: "none" }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{ text: `✅ ${n.name}`, callback_data: "none" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
// 🚀 /bingo
bot.onText(/\/bingo/, async (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    chatId = msg.chat.id;
    db.numeros = {};

    save();

    const sent = await bot.sendMessage(chatId, "🎰 BINGO", {
        reply_markup: board()
    });

    boardId = sent.message_id;
});

// =====================
// 🔥 BOTONES (SOLO UNO - FIX CRÍTICO)
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    if (!chatId) return;

    const d = q.data;

    // =====================
    if (d.startsWith("buy_")) {

        const n = d.split("_")[1];

        if (db.numeros[n]) return;

        db.numeros[n] = {
            name: user(q.from),
            estado: "reservado",
            time: Date.now()
        };

        save();

        refresh();

        return;
    }

    // =====================
    if (d.startsWith("ok_") && q.from.id === ADMIN_ID) {

        let nums = d.split("_")[1].split("-");

        nums.forEach(n => {
            if (db.numeros[n]) db.numeros[n].estado = "pagado";
        });

        save();
        refresh();
    }

    // =====================
    if (d.startsWith("no_") && q.from.id === ADMIN_ID) {

        let nums = d.split("_")[1].split("-");

        nums.forEach(n => delete db.numeros[n]);

        save();
        refresh();
    }
});

// =====================
// 🔄 SOLO REFRESCO BOTONES (NO CRONÓMETRO INTERMITENTE)
function refresh() {

    if (!chatId || !boardId) return;

    bot.editMessageReplyMarkup(board(), {
        chat_id: chatId,
        message_id: boardId
    }).catch(()=>{});
}

// =====================
// ⏱ LIBERACIÓN 10 MIN (CLAVE)
setInterval(() => {

    let changed = false;

    for (let n in db.numeros) {

        const item = db.numeros[n];

        if (item.estado === "reservado") {

            if (Date.now() - item.time >= 10 * 60 * 1000) {

                delete db.numeros[n];
                changed = true;
            }
        }
    }

    if (changed) {
        save();
        refresh();
    }

}, 5000);