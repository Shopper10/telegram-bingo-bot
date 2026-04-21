const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const NumberModel = require('./model/Number');

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);
const TOTAL = 15;
const TIME = 600;

let board = null;

/* 🔌 MONGO */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('MongoDB OK'))
  .catch(err => console.log(err));

/* 🚀 INIT NUMBERS */
async function initNumbers() {
  for (let i = 1; i <= TOTAL; i++) {
    await NumberModel.updateOne(
      { num: i },
      { num: i },
      { upsert: true }
    );
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* 🎯 TABLERO */
async function keyboard() {
  const nums = await NumberModel.find().sort({ num: 1 });

  return Markup.inlineKeyboard(
    nums.map(n => {
      let text = '';

      if (n.state === 'free') {
        text = `🟢 ${n.num} DISPONIBLE`;
      }

      if (n.state === 'reserved') {
        const remaining = Math.max(0, Math.floor((n.expiresAt - Date.now()) / 1000));
        text = `⛔ ${n.num} @${n.user} ⏱ ${formatTime(remaining)}`;
      }

      if (n.state === 'paid') {
        text = `✅ ${n.num} @${n.user} PAGADO`;
      }

      return [Markup.button.callback(text, `pick_${n.num}`)];
    })
  );
}

/* 🚀 START */
bot.command('start', async (ctx) => {
  await initNumbers();

  const msg = await ctx.reply(
    '🎱 BINGO PRO PRODUCCIÓN',
    await keyboard()
  );

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

/* 🎯 TOMAR NÚMERO */
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = Number(ctx.match[1]);

  const n = await NumberModel.findOne({ num });

  if (n.state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  await NumberModel.updateOne(
    { num },
    {
      state: 'reserved',
      user: ctx.from.username || ctx.from.first_name,
      expiresAt: Date.now() + TIME * 1000
    }
  );

  ctx.reply(
`📩 POR FAVOR REALIZAR PAGO

⏱ 10 minutos o el número vuelve a estar libre

💳 Nequi: 3123902322`
  );

  await updateBoard();
  ctx.answerCbQuery('✔ tomado');
});

/* 📸 FOTO COMPROBANTE */
bot.on('photo', async (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;

  const n = await NumberModel.findOne({
    user,
    state: 'reserved'
  });

  if (!n) return;

  const msg = await ctx.reply('⏳ Verificando pago...');

  ctx.reply(
`📩 Pago recibido de @${user}`,
Markup.inlineKeyboard([
  [
    Markup.button.callback('✅ Aprobar', `ok_${n.num}`),
    Markup.button.callback('❌ Rechazar', `no_${n.num}`)
  ]
])
  );
});

/* 👑 APROBAR */
bot.action(/ok_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const num = Number(ctx.match[1]);

  await NumberModel.updateOne(
    { num },
    { state: 'paid' }
  );

  let m = await ctx.reply('💚 Procesando pago...');

  for (let i = 0; i <= 10; i++) {
    const bar = '🟩'.repeat(i) + '⬜️'.repeat(10 - i);

    await ctx.telegram.editMessageText(
      m.chat.id,
      m.message_id,
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

  const num = Number(ctx.match[1]);

  await NumberModel.updateOne(
    { num },
    {
      state: 'free',
      user: null,
      expiresAt: null
    }
  );

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
      (await keyboard()).reply_markup
    );
  } catch {}
}

/* ⏱ CHECKER GLOBAL */
setInterval(async () => {
  const now = Date.now();

  const expired = await NumberModel.find({
    state: 'reserved',
    expiresAt: { $lt: now }
  });

  for (let n of expired) {
    await NumberModel.updateOne(
      { num: n.num },
      {
        state: 'free',
        user: null,
        expiresAt: null
      }
    );

    bot.telegram.sendMessage(
      board.chatId,
      `⏰ @${n.user} no pagó. Número ${n.num} liberado`
    );
  }

  if (expired.length > 0) {
    await updateBoard();
  }

}, 5000);

bot.launch();

console.log('🎱 BINGO PRO PRODUCCIÓN ONLINE');