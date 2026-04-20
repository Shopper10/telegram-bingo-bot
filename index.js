const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;

if (global.__RUN__) process.exit(0);
global.__RUN__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

console.log("🎰 CASINO + AI CHECK ONLINE");

// =====================
const DB_FILE = "./data.json";

let db = {
    numeros: {},
    total: 0
};

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
// 🧼 TABLERO LIMPIO
function board() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i} - DISPONIBLE`, callback_data: `buy_${i}` }]);
        } else {
            kb.push([{ text: `⛔️ ${n.name}`, callback_data: "ignore" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(
`🎰 CASINO BINGO

💰 Total: $${db.total}
🎯 Activo`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: board()
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
`🎉🔥 SOLD OUT 🔥🎉

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
        reply_markup: board()
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
        name: user(q.from),
        estado: "reservado",
        time: Date.now()
    };

    db.total += 3000;

    save();
    updateBoard();

    bot.sendMessage(chatId,
`💰 PAGO
🎰 ${n}
📲 Envía comprobante`);
});

// =====================
// 📸 COMPROBANTE + “IA CHECK”
bot.on("message", async (msg) => {

    if (!msg.photo) return;

    let file = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in db.numeros) {

        if (db.numeros[n].name === user(msg.from)) {
            db.numeros[n].estado = "pendiente";
            nums.push(n);
        }
    }

    if (!nums.length) return;

    save();

    // 🔍 SIMULACIÓN IA
    bot.sendMessage(chatId,
`🔍 IA ANALYZER

Analizando comprobante...`);

    // 🧠 SIMULACIÓN DE RESULTADO IA
    setTimeout(() => {

        let aiResult = Math.random();

        let status = aiResult > 0.3 ? "🟢 PARECE VÁLIDO" : "🟡 SOSPECHOSO";

        bot.sendPhoto(chatId, file, {
            caption:
`📥 COMPROBANTE RECIBIDO

🤖 IA RESULTADO: ${status}
🎰 ${nums.join(", ")}

⏳ En revisión final`
        });

        // 🔥 AUTO APROBACIÓN SIMPLE (SIMULADA)
        nums.forEach(n => {
            db.numeros[n].estado = "pagado";
        });

        save();
        updateBoard();
        checkSoldOut();

        bot.sendMessage(chatId, "✅ PAGOS ACTUALIZADOS");

    }, 3000);
});