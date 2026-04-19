const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 Base de datos en memoria
let numeros = {}; 
// estructura:
// numeros[1] = { user, estado, timeout }

let contadorUsuarios = {};

// ⏱ tiempo de expiración (5 min)
const TIEMPO_RESERVA = 5 * 60 * 1000;

// 🎮 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        "🎱 Bingo activo\n\nUsa /numeros para elegir tu número"
    );
});

// 📊 CONTADOR DE USUARIOS
function actualizarContador(user, delta) {
    if (!contadorUsuarios[user]) {
        contadorUsuarios[user] = 0;
    }
    contadorUsuarios[user] += delta;
}

// 🎱 TABLERO DINÁMICO
function generarTeclado() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        let texto = `🟢 ${i}`;

        if (numeros[i]) {
            let user = numeros[i].user;

            if (numeros[i].estado === "reservado") {
                texto = `🟡 ${i} ${user} (pendiente)`;
            }

            if (numeros[i].estado === "pagado") {
                texto = `🔴 ${i} ${user} (pagado)`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// 🎱 MOSTRAR TABLERO
bot.onText(/\/numeros/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 TABLERO BINGO:", {
        reply_markup: {
            inline_keyboard: generarTeclado()
        }
    });
});

// ⏱ AUTO LIBERAR
function programarLiberacion(num) {
    if (numeros[num].timeout) clearTimeout(numeros[num].timeout);

    numeros[num].timeout = setTimeout(() => {
        let user = numeros[num].user;

        delete numeros[num];

        actualizarContador(user, -1);

        bot.sendMessage(
            Object.keys(contadorUsuarios).length > 0 ? msg.chat.id : 0,
            `⏱ Número ${num} liberado por no pago`
        );
    }, TIEMPO_RESERVA);
}

// 🎯 CLICK NÚMERO
bot.on('callback_query', (query) => {

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const user = query.from.username
        ? `@${query.from.username}`
        : query.from.first_name;

    const num = parseInt(query.data.split("_")[1]);

    // ❌ ocupado
    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "❌ No disponible"
        });
        return;
    }

    // 🟡 reservar
    numeros[num] = {
        user: user,
        estado: "reservado"
    };

    actualizarContador(user, 1);

    bot.answerCallbackQuery(query.id, {
        text: `🟡 Reservaste ${num} (5 min)`
    });

    // ⏱ iniciar timer
    numeros[num].timeout = setTimeout(() => {
        if (numeros[num] && numeros[num].estado === "reservado") {

            actualizarContador(numeros[num].user, -1);

            delete numeros[num];

            bot.sendMessage(chatId,
                `⏱ Número ${num} liberado por no pago`
            );
        }
    }, TIEMPO_RESERVA);

    // 🔄 actualizar tablero
    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTeclado() },
        { chat_id: chatId, message_id: messageId }
    );

    bot.sendMessage(chatId,
        `🟡 ${user} reservó el número ${num}\n💰 Pendiente de pago`
    );
});

// 💰 MARCAR PAGO (ADMIN)
bot.onText(/\/pagar (\d+)/, (msg, match) => {

    const num = parseInt(match[1]);

    if (!numeros[num]) {
        bot.sendMessage(msg.chat.id, "❌ No existe ese número");
        return;
    }

    numeros[num].estado = "pagado";

    if (numeros[num].timeout) {
        clearTimeout(numeros[num].timeout);
    }

    bot.sendMessage(msg.chat.id,
        `🔴 Número ${num} PAGADO por ${numeros[num].user}`
    );
});

// 📊 VER CONTADORES
bot.onText(/\/stats/, (msg) => {

    let texto = "📊 NUMEROS POR USUARIO:\n\n";

    for (let user in contadorUsuarios) {
        texto += `${user}: ${contadorUsuarios[user]}\n`;
    }

    bot.sendMessage(msg.chat.id, texto);
});

// 🔄 RESET
bot.onText(/\/reset/, (msg) => {
    numeros = {};
    contadorUsuarios = {};
    bot.sendMessage(msg.chat.id, "🔄 Bingo reiniciado");
});