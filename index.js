const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;

if (global.__RUN__) process.exit(0);
global.__RUN__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 1500 }
});

const DB_FILE = "./data.json";

let db = { numeros: {}, total: 0 };
let chatId = null;
let messageId = null;
let bingoActive = false;

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
function user(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
// ⏱ TIMER SEGUNDOS
function getSecondsLeft(start) {
    const limit = 10 * 60 * 1000;
    const diff = limit - (Date.now() - start);
    return diff > 0 ? Math.floor(diff / 1000) : 0;
}

// =====================
// 🎰 BOTONES TABLERO
function buildBoard() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        // 🟢 DISPONIBLE
        if (!n) {
            kb.push([{
                text: `🟢 ${i} - DISPONIBLE`,
                callback_data: `buy_${i}`
            }]);
            continue;
        }

        // ⛔ RESERVADO
        if (n.estado === "reservado") {
            kb.push([{
                text: `⛔️ ${n.name} ⏱️ ${getSecondsLeft(n.time)}s`,
                callback_data: "wait"
            }]);
            continue;
        }

        // 🔍 PENDIENTE
        if (n.estado === "pendiente") {
            kb.push([{
                text: `🔍 ${n.name} COMPROBANDO`,
                callback_data: "wait"
            }]);
            continue;
        }

        // ✅ PAGADO
        if (n.estado === "pagado") {
            kb.push([{
                text: `✅ ${n.name} PAGADO`,
                callback_data: "wait"
            }]);
        }
    }

    return {
        inline_keyboard: kb
    };
}

// =====================
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(`🎰 CASINO BINGO\n\n💰 Total: $${db.total}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: buildBoard()
    }).catch(()=>{});
}

// =====================
// 🔥 SOLD OUT
function checkSoldOut() {

    if (bingoActive) return;

    for (let i = 1; i <= 15; i++) {
        if (!db.numeros[i]) return;
    }

    bingoActive = true;

    bot.sendMessage(chatId,
`🎉🔥 SOLD OUT COMPLETO 🔥🎉

🚀 INICIANDO BINGO...`);

    setTimeout(startBingo, 3000);
}

// =====================
function startBingo() {

    let nums = Array.from({ length: 15 }, (_, i) => i + 1);

    let winner = nums[Math.floor(Math.random() * nums.length)];
    let name = db.numeros[winner]?.name || "Sin registro";

    bot.sendMessage(chatId,
`🏆 BINGO FINAL 🏆

🎰 ${winner}
👤 ${name}`);
}

// =====================
// 🚀 START
bot.onText(/\/bingo/, async (msg) => {

    chatId = msg.chat.id;

    const sent = await bot.sendMessage(chatId,
`🎰 CASINO BINGO`, {
        reply_markup: buildBoard()
    });

    messageId = sent.message_id;
});

// =====================
// 🎯 CLICK BOTONES
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    if (!q.data.startsWith("buy_")) return;

    let n = q.data.split("_")[1];

    if (db.numeros[n]) return;

    db.numeros[n] = {
        name: user(q.from),
        estado: "reservado",
        time: Date.now()
    };

    db.total += 3000;

    save();
    updateBoard();

    bot.sendMessage(chatId,
`💰 RESERVADO
🎰 ${n}
⏱️ 10 MIN`);
});

// =====================
// 📸 PAGO
bot.on("message", (msg) => {

    if (!msg.photo) return;

    let nums = [];

    for (let n in db.numeros) {

        if (db.numeros[n].name === user(msg.from)) {
            db.numeros[n].estado = "pendiente";
            nums.push(n);
        }
    }

    if (!nums.length) return;

    save();

    bot.sendMessage(chatId, "🔍 COMPROBANDO PAGOS...");

    setTimeout(() => {

        nums.forEach(n => {
            db.numeros[n].estado = "pagado";
        });

        save();
        updateBoard();
        checkSoldOut();

        bot.sendMessage(chatId, "✅ PAGOS APROBADOS");

    }, 3000);
});

// =====================
// 🔁 LOOP TIMER + UPDATE
setInterval(() => {

    updateBoard();

}, 2000);