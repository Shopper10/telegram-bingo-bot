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
let juegoAnunciado = false;

// =====================
// PERSISTENCIA
// =====================
function cargarDatos() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            numeros = data.numeros || {};
            totalDinero = data.totalDinero || 0;
        }
    } catch (e) {
        console.log("Error carga:", e.message);
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
// TABLERO
// =====================
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];
        let txt = `🟢 ${i} DISPONIBLE`;

        if (item) {
            if (item.estado === "reservado") txt = `⛔ ${i} ${item.user.name}`;
            if (item.estado === "pendiente") txt = `⏱️ ${i} ${item.user.name}`;
            if (item.estado === "pagado") txt = `✅ ${i} ${item.user.name}`;
        }

        kb.push([{ text: txt, callback_data: `num_${i}` }]);
    }

    return kb;
}

// =====================
// UPDATE TABLERO
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
// REENVIAR
// =====================
function reenviarTablero() {

    if (!tableroChatId) return;

    bot.sendMessage(tableroChatId,
`🎰 TABLERO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    }).then(msg => {
        tableroMessageId = msg.message_id;
    });
}

// =====================
// CHECK FULL
// =====================
function juegoCompleto() {
    for (let i = 1; i <= 15; i++) {
        if (!numeros[i] || numeros[i].estado !== "pagado") return false;
    }
    return true;
}

function verificarJuego() {

    if (juegoAnunciado) return;

    if (juegoCompleto()) {
        juegoAnunciado = true;

        bot.sendMessage(tableroChatId,
`🎉 TODOS LOS NÚMEROS VENDIDOS

🎰 INICIA EL BINGO`);
    }
}

// =====================
// START
// =====================
cargarDatos();

bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 BINGO ACTIVO`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// =====================
// TOMAR NÚMERO
// =====================
function iniciarTimer(num) {

    startTimes[num] = Date.now();

    timers[num] = setTimeout(() => {

        if (numeros[num] && numeros[num].estado === "reservado") {

            delete numeros[num];

            actualizarTablero();
            guardarDatos();

            bot.sendMessage(tableroChatId,
`⛔ EXPIRADO ${num}`);
        }

    }, 600000);
}

// =====================
// CALLBACKS
// =====================
bot.on('callback_query', async (q) => {

    const data = q.data;
    const user = getUser(q.from);

    if (data.startsWith("num_")) {

        const num = parseInt(data.split("_")[1]);

        if (numeros[num]) return;

        numeros[num] = {
            user: { id: q.from.id, name: user },
            estado: "reservado"
        };

        iniciarTimer(num);

        actualizarTablero();
        guardarDatos();

        bot.sendMessage(tableroChatId,
`🎯 TOMADO ${num}`);

        return;
    }

    if (q.from.id !== ADMIN_ID) return;

    const num = parseInt(data.split("_")[1]);

    if (!numeros[num]) return;

    if (data.startsWith("no_")) {

        delete numeros[num];

        actualizarTablero();
        guardarDatos();

        reenviarTablero();
        return;
    }

    if (data.startsWith("ok_")) {

        numeros[num].estado = "pagado";
        totalDinero += 3000;

        actualizarTablero();
        guardarDatos();

        setTimeout(() => {
            reenviarTablero();
            verificarJuego();
        }, 1000);
    }
});

// =====================
// 🔥 FOTO FIX REAL (IMPORTANTE)
// =====================
bot.on('message', (msg) => {

    if (!msg.photo) return;

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    console.log("📸 FOTO RECIBIDA");

    let nums = [];

    for (let n in numeros) {
        if (numeros[n]?.user?.id === userId && numeros[n].estado === "reservado") {
            nums.push(n);
        }
    }

    if (!nums.length) {
        bot.sendMessage(msg.chat.id,
"❌ Sin números activos");
        return;
    }

    nums.forEach(n => {
        numeros[n].estado = "pendiente";
        clearTimeout(timers[n]);
    });

    actualizarTablero();
    guardarDatos();

    if (!tableroChatId) return;

    bot.sendPhoto(tableroChatId, fileId, {
        caption:
`📥 PAGO

🔢 ${nums.join(", ")}
💰 $${nums.length * 3000}`
    });
});