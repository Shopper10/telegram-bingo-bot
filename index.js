const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// 📦 ARCHIVO PERSISTENTE
const DATA_FILE = "./data.json";

// =====================
// ESTADO GLOBAL
// =====================
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};
let juegoAnunciado = false;

// =====================
// GUARDAR / CARGAR
// =====================
function cargarDatos() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));

            numeros = data.numeros || {};
            totalDinero = data.totalDinero || 0;

            console.log("📦 Datos cargados");
        }
    } catch (e) {
        console.log("Error cargando datos", e.message);
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
// TABLERO (CON USUARIO AL LADO)
// =====================
function generarTablero() {

    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];

        let texto = `🟢 ${i} - DISPONIBLE`;

        if (item) {

            const u = item.user.name;

            if (item.estado === "reservado") {
                texto = `⛔️ ${i} - ${u} - PENDIENTE`;
            }

            if (item.estado === "pendiente") {
                texto = `⏱️ ${i} - ${u} - ESPERANDO PAGO`;
            }

            if (item.estado === "pagado") {
                texto = `✅ ${i} - ${u} - PAGADO`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// =====================
// ACTUALIZAR TABLERO
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
// TIMER 10 MIN (LIBERA AUTOMÁTICO)
// =====================
function iniciarTimer(num) {

    startTimes[num] = Date.now();

    if (timers[num]) clearTimeout(timers[num]);

    timers[num] = setTimeout(() => {

        const item = numeros[num];

        if (!item || item.estado === "pagado") return;

        const user = item.user.name;

        delete numeros[num];
        delete timers[num];
        delete startTimes[num];

        guardarDatos();
        actualizarTablero();

        bot.sendMessage(tableroChatId,
`⛔️ NÚMERO LIBERADO

🔢 ${num}
👤 ${user}
⌛️ No pagó en 10 minutos`);
    }, 600000);
}

// =====================
// INICIAR BINGO
// =====================
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 BINGO ACTIVO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// =====================
// CALLBACKS (TOMA NÚMERO + ADMIN)
// =====================
bot.on('callback_query', (query) => {

    const data = query.data;
    const user = getUser(query.from);

    // 🎯 TOMAR NÚMERO
    if (data.startsWith("num_")) {

        const num = parseInt(data.split("_")[1]);

        if (numeros[num]) return;

        numeros[num] = {
            user: {
                id: query.from.id,
                name: user
            },
            estado: "reservado"
        };

        iniciarTimer(num);

        guardarDatos();
        actualizarTablero();

        bot.sendMessage(tableroChatId,
`🎯 NÚMERO TOMADO

🔢 ${num}
👤 ${user}

💰 PAGA A NEQUI: 3123902322
📸 Envía comprobante en el grupo
⏱ 10 minutos o se libera`);
        return;
    }

    // 🔒 SOLO ADMIN
    if (query.from.id !== ADMIN_ID) return;

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
        actualizarTablero();

        bot.sendMessage(tableroChatId,
`✅ PAGOS APROBADOS

🔢 ${nums.join(", ")}`);
    }

    // ❌ RECHAZAR
    if (data.startsWith("no_")) {

        const nums = data.split("_")[1].split("-");

        nums.forEach(n => {
            delete numeros[n];
            if (timers[n]) clearTimeout(timers[n]);
        });

        guardarDatos();
        actualizarTablero();

        bot.sendMessage(tableroChatId,
`❌ PAGOS RECHAZADOS

🔢 ${nums.join(", ")} liberados`);
    }
});

// =====================
// 📸 FOTO (SOLO ADMIN DECIDE)
// =====================
bot.on('message', (msg) => {

    if (!msg.photo) return;

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in numeros) {
        if (numeros[n].user.id === userId &&
            numeros[n].estado === "reservado") {
            nums.push(n);
        }
    }

    if (!nums.length) {
        bot.sendMessage(msg.chat.id, "❌ No tienes números activos");
        return;
    }

    nums.forEach(n => {
        numeros[n].estado = "pendiente";
        if (timers[n]) clearTimeout(timers[n]);
    });

    guardarDatos();
    actualizarTablero();

    bot.sendPhoto(tableroChatId, fileId, {
        caption:
`📥 COMPROBANTE RECIBIDO

👤 ${getUser(msg.from)}
🔢 ${nums.join(", ")}

⚠️ SOLO ADMIN PUEDE APROBAR`,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ APROBAR", callback_data: `ok_${nums.join("-")}` },
                    { text: "❌ RECHAZAR", callback_data: `no_${nums.join("-")}` }
                ]
            ]
        }
    });
});

// =====================
// AUTO GUARDADO
// =====================
setInterval(() => {
    guardarDatos();
}, 10000);

// =====================
cargarDatos();