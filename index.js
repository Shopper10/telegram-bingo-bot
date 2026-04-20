const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

// 🔥 evitar duplicados Railway
if (global.__RUN__) process.exit(0);
global.__RUN__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

console.log("🎰 CASINO CLEAN ONLINE");

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
// 🧼 TABLERO LIMPIO (SIN BOTONES EXTRA NUNCA)
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

            let t = 600000 - (Date.now() - n.start);
            let m = Math.max(0, Math.floor(t / 60000));

            kb.push([{ text: `⛔ ${i}- ${n.name} ⏱ ${m}m`, callback_data: "ignore" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
// 🔄 ACTUALIZAR TABLERO
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
`🎉🔥 NÚMEROS VENDIDOS COMPLETOS 🔥🎉

🎰 TODOS LOS NÚMEROS FUERON VENDIDOS
🚀 INICIANDO BINGO...`);

    setTimeout(() => {
        startBingo();
    }, 3000);
}

// =====================
// 🎰 INICIO BINGO (SIMPLIFICADO)
function startBingo() {

    let nums = Array.from({ length: 15 }, (_, i) => i + 1);

    bot.sendMessage(chatId, "🎰 INICIANDO BINGO... SUERTE 🍀");

    setTimeout(() => {

        let winner = nums[Math.floor(Math.random() * nums.length)];
        let name = db.numeros[winner]?.name || "Sin registro";

        bot.sendMessage(chatId,
`🏆 BINGO FINAL 🏆

🎰 Número ganador: ${winner}
👤 ${name}

🎉 FELICIDADES!`);

    }, 4000);
}

// =====================
// 🚀 START TABLERO
bot.onText(/\/bingo/, async (msg) => {

    chatId = msg.chat.id;

    const sent = await bot.sendMessage(chatId,
`🎰 CASINO BINGO PRO`, {
        reply_markup: boardUser()
    });

    messageId = sent.message_id;
});

// =====================
// 🎯 CALLBACKS (SIN BOTONES ADMIN EN PÚBLICO)
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

    // ❌ todo lo demás ignorado en público
});

// =====================
// 📸 COMPROBANTE PAGO
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
});