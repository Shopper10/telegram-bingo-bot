const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const TOTAL = 15;
const TIME = 600;

let data = {};
let board = null;

/* INIT NUMBERS */
for (let i = 1; i <= TOTAL; i++) {
  data[i] = {
    state: 'free', // free | reserved | paid
    user: null,
    time: 0
  };
}

/* FORMAT TIME */
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

    if (n.state === 'free') {
      text = `🟢 ${i} - DISPONIBLE`;
    }

    if (n.state === 'reserved') {
      text = `⛔ ${i} - @${n.user} ⏱ ${formatTime(n.time)}`;
    }

    if (n.state === 'paid') {
      text = `✅ ${i} - @${n.user} PAGADO`;
    }

    rows.push([
      Markup.button.callback(text, `pick_${i}`)
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

/* 🚀 START */
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(
    '🎱 BINGO RECKER 15 NÚMEROS 🎰',
    keyboard()
  );

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

/* 🎯 TOMAR NÚMERO */
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  const user = ctx.from.username || ctx.from.first_name;

  data[num] = {
    state: 'reserved',
    user,
    time: TIME
  };

  ctx.reply(
`📩 Pago requerido

⏱ Tienes 10 minutos o vuelve a disponible

💳 Nequi: 3123902322`
  );

  await updateBoard();
  ctx.answerCbQuery('✔ tomado');
});

/* 📸 FOTO COMPROBANTE */
bot.on('photo', async (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;

  let num = Object.keys(data).find(
    i => data[i].user === user && data[i].state === 'reserved'
  );

  if (!num) return;

  await ctx.reply(
    `📩 Pago recibido de @${user}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Aprobar', `ok_${num}`),
        Markup.button.callback('❌ Rechazar', `no_${num}`)
      ]
    ])
  );
});

/* 👑 APROBAR */
bot.action(/ok_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const num = ctx.match[1];

  data[num].state = 'paid';

  let msg = await ctx.reply('💚 Procesando pago...');

  for (let i = 0; i <= 10; i++) {
    const bar = '🟩'.repeat(i) + '⬜️'.repeat(10 - i);

    await ctx.telegram.editMessageText(
      msg.chat.id,
      msg.message_id,
      null,
      `💚 Aprobando pago...\n${bar}`
    );

    await new Promise(r => setTimeout(r, 200));
  }

  await updateBoard();
});

/* ❌ RECHAZAR */
bot.action(/no_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const num = ctx.match[1];

  data[num] = {
    state: 'free',
    user: null,
    time: 0
  };

  await updateBoard();
});

/* 🔄 UPDATE TABLERO */
async function updateBoard() {
  if (!board) return;

  try {
    await bot.telegram.editMessageReplyMarkup(
      board.chatId,
      board.messageId,
      null,
      keyboard().reply_markup
    );
  } catch {}
}

/* ⏱ TIMER GLOBAL (CRONÓMETRO REAL) */
setInterval(async () => {
  let changed = false;

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    if (n.state === 'reserved') {
      n.time--;

      if (n.time <= 0) {
        let user = n.user;

        data[i] = {
          state: 'free',
          user: null,
          time: 0
        };

        bot.telegram.sendMessage(
          board.chatId,
          `⏰ @${user} no pagó. Número ${i} liberado`
        );

        changed = true;
      }
    }
  }

  if (changed) {
    await updateBoard();
  }

}, 1000);

bot.launch();

console.log('🎱 BINGO RAILWAY ONLINE');