const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

if (global.__RUN__) process.exit(0);
global.__RUN__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

console.log("🎰 CASINO PRIVADO FINAL ONLINE");

// =====================
const DB_FILE = "./data.json";

let db = {
    numeros: {},
    total: 0
};

let chatId = null;
let messageId = null;
let timers = {};
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
// 🧠 SOLO PRIVADO CHECK
function isPrivate(msg) {
    return msg.chat.type === "private";
}

// =====================
// 🧼 TABLERO LIMPIO (SIN BOTONES EXTRA)
function boardUser() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i}- DISPONIBLE`, callback_data: `take_${i}` }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{ text: `✅ ${i}- PAGADO`, callback_data: "ignore" }]);
        } else {
            kb.push([{ text: `⛔ ${i}- OCUPADO`, callback_data: "ignore" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
// 🔄 UPDATE TABLERO
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(
`🎰 CASINO BINGO PRO

💰 Total: $${db.total}
🎯 Activo`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: boardUser()
    }).catch(()=>{});
}

// =====================
// ⏱ TIMER
function startTimer(n) {

    if (timers[n]) clearTimeout(timers[n]);

    db.numeros[n].start = Date.now();

    timers[n] = setTimeout(() => {

        delete db.numeros[n];

        save();
        updateBoard();

    }, 600000);
}

// =====================
// 🔥 CHECK SOLD OUT
function checkSoldOut() {

    if (bingoActive) return;

    for (let i = 1; i <= 15; i++) {
        if (!db.numeros[i] || db.numeros[i].estado !== "pagado") return;
    }

    bingoActive = true;

    bot.sendMessage(chatId,
`🎉🔥 SOLD OUT COMPLETO 🔥🎉

🚀 INICIANDO BINGO...`);

    setTimeout(() => startBingo(), 3000);
}

// =====================
// 🎰 BINGO FINAL
function startBingo() {

    let nums = Array.from({ length: 15 }, (_, i) => i + 1);

    let winner = nums[Math.floor(Math.random() * nums.length)];
    let name = db.numeros[winner]?.name || "Sin registro";

    bot.sendMessage(chatId,
`🏆 BINGO FINAL 🏆

🎰 Número ganador: ${winner}
👤 ${name}

🎉 FELICIDADES!`);
}

// =====================
// 🚀 START
bot.onText(/\/bingo/, async (msg) => {

    chatId = msg.chat.id;

    const sent = await bot.sendMessage(chatId,
`🎰 CASINO BINGO PRO`, {
        reply_markup: boardUser()
    });

    messageId = sent.message_id;
});

// =====================
// 🎯 CALLBACKS
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    const d = q.data;

    if (d.startsWith("take_")) {

        let n = d.split("_")[1];

        if (db.numeros[n]) return;

        db.numeros[n] = {
            name: user(q.from),
            estado: "reservado",
            start: Date.now()
        };

        startTimer(n);
        save();
        updateBoard();

        bot.sendMessage(chatId,
`💰 PAGO:
Nequi 3123902322
🎰 Número ${n}
⏱ 10 min`);

        return;
    }
});

// =====================
// 📸 PAGO
bot.on("message", (msg) => {

    if (!msg.photo) return;

    let file = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in db.numeros) {

        if (db.numeros[n].name === user(msg.from)) {
            nums.push(n);
            db.numeros[n].estado = "pendiente";
        }
    }

    if (!nums.length) return;

    save();

    bot.sendMessage(chatId, "🔍 COMPROBANDO PAGO...");

    bot.sendPhoto(chatId, file, {
        caption: `📥 COMPROBANTE\n🎰 ${nums.join(", ")}`
    });

    setTimeout(() => {

        nums.forEach(n => {
            db.numeros[n].estado = "pagado";
            db.total += 3000;
        });

        save();
        updateBoard();
        checkSoldOut();

        bot.sendMessage(chatId, "✅ PAGO APROBADO");

    }, 3000);
});

// =====================
// 🛠 COMANDOS SOLO PRIVADO 🤖

bot.onText(/\/payall/, (msg) => {

    if (!isPrivate(msg)) return;
    if (msg.from.id !== ADMIN_ID) return;

    for (let i = 1; i <= 15; i++) {
        db.numeros[i] = {
            name: "ADMIN",
            estado: "pagado",
            start: Date.now()
        };
    }

    db.total = 15 * 3000;

    save();
    updateBoard();
    checkSoldOut();

    bot.sendMessage(msg.chat.id, "⚡ TODOS PAGADOS");
});

// --------------------

bot.onText(/\/reset/, (msg) => {

    if (!isPrivate(msg)) return;
    if (msg.from.id !== ADMIN_ID) return;

    db = { numeros: {}, total: 0 };
    bingoActive = false;

    save();
    updateBoard();

    bot.sendMessage(msg.chat.id, "🔄 REINICIADO");
});

// --------------------

bot.onText(/\/status/, (msg) => {

    if (!isPrivate(msg)) return;
    if (msg.from.id !== ADMIN_ID) return;

    bot.sendMessage(msg.chat.id,
`📊 STATUS

💰 Total: $${db.total}
🎰 Activos: ${Object.keys(db.numeros).length}`);
});