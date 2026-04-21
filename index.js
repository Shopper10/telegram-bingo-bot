const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const TOTAL = 15;
const TIME = 600;

/* 🧠 DATA */
let data = {};
let board = null;

/* 🚀 INIT */
for (let i = 1; i <= TOTAL; i++) {
  data[i] = { state: 'free', user: null, time: 0 };
}

/* =========================
   🔒 SISTEMA ANTI BAN (QUEUE)
========================= */

let queue = [];
let sending = false;

function enqueue(fn) {
  queue.push(fn);
  processQueue();
}

async function processQueue() {
  if (sending) return;
  sending = true;

  while (queue.length > 0) {
    const fn = queue.shift();

    try {
      await fn();
    } catch (e) {
      if (e.response && e.response.error_code === 429) {
        const wait = (e.response.parameters?.retry_after || 3) * 1000;
        await new Promise(r => setTimeout(r, wait));
      }
    }

    await new Promise(r => setTimeout(r, 300)); // 🔥 velocidad segura
  }

  sending = false;
}

/* ========================= */

function safeSendMessage(chatId, text, extra = {}) {
  enqueue(() => bot.telegram.sendMessage(chatId, text, extra));
}

function safeEdit(chatId, messageId, markup) {
  enqueue(() =>
    bot.telegram.editMessageReplyMarkup(chatId, messageId, null, markup)
  );
}

function safeEditText(chatId, messageId, text) {
  enqueue(() =>
    bot.telegram.editMessageText(chatId, messageId, null, text)
  );
}

/* ⏱ FORMAT */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* 🎯 TABLERO */
function keyboard() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];
    let text = '';

    if (n.state === 'free') text = `🟢 ${i} - DISPONIBLE`;
    if (n.state === 'reserved') text = `⛔ ${i} - @${n.user} ⏱ ${formatTime(n.time)}`;
    if (n.state === 'paid') text = `✅ ${i} - @${n.user} PAGADO`;

    rows.push([Markup.button.callback(text, `pick_${i}`)]);
  }

  return Markup.inlineKeyboard(rows);
}

/* 🚀 START */
bot.command('start', async (ctx) => {
  const msg = await ctx.reply('🎱 BINGO RECKER PRO', keyboard());

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

/* 🎯 TOMAR */
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  const user = ctx.from.username || ctx.from.first_name;

  data[num] = { state: 'reserved', user, time: TIME };

  ctx.answerCbQuery('✔ Número tomado');

  safeSendMessage(
    board.chatId,
`📩 PAGO REQUERIDO
⏱ 10 minutos

💳 Nequi: 3123902322`
  );

  updateBoard();
});

/* 📸 FOTO MULTI */
bot.on('photo', async (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;

  let nums = [];

  for (let i = 1; i <= TOTAL; i++) {
    if (data[i].user === user && data[i].state === 'reserved') {
      nums.push(i);
    }
  }

  if (!nums.length) return;

  safeSendMessage(
    board.chatId,
`📩 Pago de @${user}
🎟 ${nums.join(', ')}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ APROBAR TODO', `ok_all_${user}`),
        Markup.button.callback('❌ RECHAZAR TODO', `no_all_${user}`)
      ]
    ])
  );
});

/* 👑 APROBAR */
bot.action(/ok_all_(.+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const user = ctx.match[1];
  let nums = [];

  for (let i = 1; i <= TOTAL; i++) {
    if (data[i].user === user && data[i].state === 'reserved') {
      data[i].state = 'paid';
      nums.push(i);
    }
  }

  let msg = await ctx.reply('💚 Procesando...');

  for (let i = 0; i <= 10; i++) {
    const bar = '🟩'.repeat(i) + '⬜️'.repeat(10 - i);
    safeEditText(msg.chat.id, msg.message_id, `💚\n${bar}`);
    await new Promise(r => setTimeout(r, 200));
  }

  safeEditText(msg.chat.id, msg.message_id, `💚 PAGADO ✅`);

  const newMsg = await bot.telegram.sendMessage(
    board.chatId,
    '🎱 TABLERO ACTUALIZADO',
    keyboard()
  );

  board.messageId = newMsg.message_id;
});

/* ❌ RECHAZAR */
bot.action(/no_all_(.+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const user = ctx.match[1];

  for (let i = 1; i <= TOTAL; i++) {
    if (data[i].user === user) {
      data[i] = { state: 'free', user: null, time: 0 };
    }
  }

  updateBoard();
});

/* 🔄 UPDATE */
function updateBoard() {
  if (!board) return;
  safeEdit(board.chatId, board.messageId, keyboard().reply_markup);
}

/* ⏱ TIMER OPTIMIZADO */
setInterval(() => {
  let expired = [];

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    if (n.state === 'reserved') {
      n.time--;

      if (n.time <= 0) {
        expired.push(i);
        data[i] = { state: 'free', user: null, time: 0 };
      }
    }
  }

  if (expired.length) {
    safeSendMessage(
      board.chatId,
      `⏰ Disponibles: ${expired.join(', ')}`
    );
    updateBoard();
  }

}, 4000); // 🔥 clave anti-ban

/* 🔁 RESET */
bot.command('reset', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  for (let i = 1; i <= TOTAL; i++) {
    data[i] = { state: 'free', user: null, time: 0 };
  }

  const msg = await ctx.reply('🔄 Reiniciado');

  const newMsg = await bot.telegram.sendMessage(
    board.chatId,
    '🎱 NUEVO JUEGO',
    keyboard()
  );

  board.messageId = newMsg.message_id;
});

bot.launch();

console.log('🔥 BINGO ANTI-BAN ACTIVO');