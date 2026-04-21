const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const TOTAL = 15;
const TIME = 10 * 60;

let data = {};
let board = null;
let pending = {};

// INIT
for (let i = 1; i <= TOTAL; i++) {
  data[i] = {
    state: 'free', // free | reserved | paid
    user: null,
    time: 0
  };
}

function formatTime(sec) {
  let m = Math.floor(sec / 60);
  let s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

# 🎯 TABLERO (BOTONES VERTICALES)
function keyboard() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    let text = '';

    if (n.state === 'free') {
      text = `🟢 ${i} DISPONIBLE`;
    }

    if (n.state === 'reserved') {
      text = `⛔ ${i} - @${n.user} ⏱️ ${formatTime(n.time)}`;
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

# 🚀 START
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(
    '🎱 BINGO RECKER - 15 NÚMEROS',
    keyboard()
  );

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

# 🎯 TOMAR NÚMERO
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  let user = ctx.from.username || ctx.from.first_name;

  data[num] = {
    state: 'reserved',
    user,
    time: TIME
  };

  ctx.reply(
`📩 POR FAVOR realizar pago y enviar captura al grupo.

⏱ Tienes 10 minutos o el número vuelve a estar libre.

💳 Nequi: 3123902322`
  );

  startTimer(ctx, num);
  await updateBoard();

  ctx.answerCbQuery('✔ Tomado');
});

# ⏱ TIMER
function startTimer(ctx, num) {
  const interval = setInterval(async () => {

    if (data[num].state !== 'reserved') {
      clearInterval(interval);
      return;
    }

    data[num].time--;

    if (data[num].time <= 0) {

      let user = data[num].user;

      data[num] = {
        state: 'free',
        user: null,
        time: 0
      };

      bot.telegram.sendMessage(
        board.chatId,
        `⏰ @${user} no pagó. Número ${num} liberado`
      );

      await updateBoard();
      clearInterval(interval);
    }

    await updateBoard();

  }, 1000);
}

# 📸 FOTO COMPROBANTE
bot.on('photo', async (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;

  let num = Object.keys(data).find(
    i => data[i].user === user && data[i].state === 'reserved'
  );

  if (!num) return;

  const msg = await ctx.reply('⏳ Verificando pago...');

  pending[msg.message_id] = {
    chatId: ctx.chat.id,
    num,
    user
  };

  await ctx.reply(
    `📩 Pago recibido de @${user}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Aprobar', `ok_${msg.message_id}`),
        Markup.button.callback('❌ Cancelar', `no_${msg.message_id}`)
      ]
    ])
  );
});

# ✅ APROBAR (ADMIN)
bot.action(/ok_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const id = ctx.match[1];
  const p = pending[id];

  if (!p) return;

  // marcar pagado
  data[p.num].state = 'paid';

  let m = await ctx.reply('💚 Procesando pago...');

  // barra animada
  for (let i = 0; i <= 10; i++) {
    let bar = '🟩'.repeat(i) + '⬜️'.repeat(10 - i);

    await ctx.telegram.editMessageText(
      m.chat.id,
      m.message_id,
      null,
      `💚 Aprobando pago...\n${bar}`
    );

    await new Promise(r => setTimeout(r, 300));
  }

  delete pending[id];

  await updateBoard();
});

# ❌ CANCELAR
bot.action(/no_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const id = ctx.match[1];
  const p = pending[id];

  if (!p) return;

  data[p.num] = {
    state: 'free',
    user: null,
    time: 0
  };

  delete pending[id];

  await updateBoard();
});

# 🔄 ACTUALIZAR TABLERO
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

bot.launch();

console.log("🎱 BINGO BOT LISTO");