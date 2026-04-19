const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

const DATA_FILE = "./data.json";

let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};
let alertados = {};
let juegoAnunciado = false;

// 🎰 SORTEO
let numerosSorteados = [];
let sorteoActivo = false;

// =====================
function cargarDatos() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            numeros = data.numeros || {};
            totalDinero = data.totalDinero || 0;
        }
    } catch {}
}
function guardarDatos() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ numeros, totalDinero }));
}

function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// =====================
// TABLERO
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        let txt = `🟢 ${i}`;
        let item = numeros[i];

        if (item) {

            if (item.estado === "reservado") {
                let restante = 600000 - (Date.now() - (startTimes[i] || 0));
                txt = `⛔ ${i} ${item.user.name}`;
            }

            if (item.estado === "pendiente") {
                txt = `⏳ ${i} ${item.user.name}`;
            }

            if (item.estado === "pagado") {
                txt = `✅ ${i} ${item.user.name}`;
            }
        }

        kb.push([{ text: txt, callback_data: `num_${i}` }]);
    }

    return kb;
}

function actualizarTablero() {
    if (!tableroChatId || !tableroMessageId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        { chat_id: tableroChatId, message_id: tableroMessageId }
    ).catch(()=>{});
}

setInterval(actualizarTablero, 3000);

// =====================
function reenviarTablero() {
    bot.sendMessage(tableroChatId, `🎰 TABLERO\n💰 $${totalDinero}`, {
        reply_markup: { inline_keyboard: generarTablero() }
    }).then(msg => tableroMessageId = msg.message_id);
}

// =====================
function juegoCompleto() {
    for (let i = 1; i <= 15; i++) {
        if (!numeros[i] || numeros[i].estado !== "pagado") return false;
    }
    return true;
}

// =====================
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id, "🎰 BINGO ACTIVO", {
        reply_markup: { inline_keyboard: generarTablero() }
    });

    tableroMessageId = sent.message_id;
});

// =====================
// TIMER
function iniciarTimer(num) {

    startTimes[num] = Date.now();

    timers[num] = setInterval(() => {

        if (!numeros[num] || numeros[num].estado !== "reservado") {
            clearInterval(timers[num]);
            return;
        }

        let restante = 600000 - (Date.now() - startTimes[num]);

        if (restante <= 0) {

            delete numeros[num];
            clearInterval(timers[num]);

            actualizarTablero();
            guardarDatos();

            bot.sendMessage(tableroChatId, `⛔ ${num} LIBERADO`);
        }

    }, 5000);
}

// =====================
// CALLBACK
bot.on('callback_query', async (q) => {

    let data = q.data;
    let user = getUser(q.from);

    if (data.startsWith("num_")) {

        let num = parseInt(data.split("_")[1]);
        if (numeros[num]) return;

        numeros[num] = {
            user: { id: q.from.id, name: user },
            estado: "reservado"
        };

        iniciarTimer(num);
        actualizarTablero();
        guardarDatos();

        bot.sendMessage(tableroChatId, `🎯 ${user} tomó ${num}`);
        return;
    }

    if (q.from.id !== ADMIN_ID) return;

    let num = parseInt(data.split("_")[1]);

    if (data.startsWith("ok_")) {

        numeros[num].estado = "pagado";
        totalDinero += 3000;

        actualizarTablero();
        guardarDatos();

        setTimeout(() => {

            reenviarTablero();

            if (juegoCompleto() && !juegoAnunciado) {

                juegoAnunciado = true;

                bot.sendMessage(tableroChatId,
`🎉 TODO VENDIDO
🎰 INICIANDO SORTEO...`);

                setTimeout(iniciarSorteo, 3000);
            }

        }, 1000);
    }

    if (data.startsWith("no_")) {
        delete numeros[num];
        actualizarTablero();
        guardarDatos();
    }
});

// =====================
// FOTO
bot.on('message', (msg) => {

    if (!msg.photo) return;

    let userId = msg.from.id;
    let fileId = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in numeros) {
        if (numeros[n]?.user?.id === userId && numeros[n].estado === "reservado") {
            nums.push(n);
        }
    }

    if (!nums.length) return;

    nums.forEach(n => {
        numeros[n].estado = "pendiente";
        clearInterval(timers[n]);
    });

    actualizarTablero();
    guardarDatos();

    bot.sendPhoto(tableroChatId, fileId, {
        caption: `📥 PAGO\n🔢 ${nums.join(", ")}`,
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ APROBAR", callback_data: `ok_${nums[0]}` }],
                [{ text: "❌ RECHAZAR", callback_data: `no_${nums[0]}` }]
            ]
        }
    });
});

// =====================
// 🎰 SORTEO PRO
const LINEAS = [
    [1,2,3,4,5],
    [6,7,8,9,10],
    [11,12,13,14,15]
];

function iniciarSorteo() {

    sorteoActivo = true;
    numerosSorteados = [];

    bot.sendMessage(tableroChatId, "🎰 SORTEO EN VIVO");
    setTimeout(animacionBola, 2000);
}

function animacionBola() {

    let frames = ["🎱 girando.", "🎱 girando..", "🎱 girando..."];
    let i = 0;

    let anim = setInterval(() => {
        bot.sendMessage(tableroChatId, frames[i % frames.length]);
        i++;
        if (i === 3) {
            clearInterval(anim);
            sacarNumero();
        }
    }, 800);
}

function sacarNumero() {

    if (!sorteoActivo) return;

    let disponibles = [];

    for (let i = 1; i <= 15; i++) {
        if (!numerosSorteados.includes(i)) {
            disponibles.push(i);
        }
    }

    if (!disponibles.length) return;

    let num = disponibles[Math.floor(Math.random() * disponibles.length)];
    numerosSorteados.push(num);

    bot.sendMessage(tableroChatId,
`🎯 SALE: ${num}

📊 Historial: ${numerosSorteados.join(" - ")}`);

    verificarLinea(num);

    setTimeout(animacionBola, 3000);
}

function verificarLinea(ultimoNumero) {

    for (let linea of LINEAS) {

        let completa = linea.every(n => numerosSorteados.includes(n));

        if (completa) {

            sorteoActivo = false;

            let ganador = numeros[ultimoNumero]?.user?.name || "Jugador";

            bot.sendMessage(tableroChatId,
`🏆 ¡BINGO!

🎯 ${linea.join(" - ")}
👤 ${ganador}`);

            setTimeout(reiniciarRonda, 5000);
            return;
        }
    }
}

// 🔄 REINICIO AUTOMÁTICO
function reiniciarRonda() {

    numeros = {};
    numerosSorteados = [];
    juegoAnunciado = false;
    totalDinero = 0;

    guardarDatos();

    bot.sendMessage(tableroChatId,
`🔄 NUEVA RONDA

🎰 LISTO PARA JUGAR`);

    reenviarTablero();
}