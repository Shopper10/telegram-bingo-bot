const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const TOTAL = 15;
const TIME = 600;

let board = null;

# 🔥 INIT NUMBERS
function init() {
  for (let i = 1; i <= TOTAL; i++) {
    db.run(
      `INSERT OR IGNORE INTO numbers (num, state) VALUES (?, 'free')`,
      [i]
    );
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

# 🎯 TABLERO
function getBoard() {
  return new Promise((resolve) => {
    db.all(`SELECT * FROM numbers ORDER BY num ASC`, [], (err, rows) => {

      let kb = rows.map(n => {
        let text = '';

        if (n.state === 'free') {
          text = `🟢 ${n.num} DISPONIBLE`;
        }

        if (n.state === 'reserved') {
          let remaining = Math.max(0, Math.floor((n.expiresAt - Date.now()) / 1000));
          text = `⛔ ${n.num} @${n.user} ⏱ ${formatTime(remaining)}`;
        }

        if (n.state === 'paid') {
          text = `✅ ${n.num} @${n.user} PAGADO`;
        }

        return [Markup.button.callback(text, `pick_${n.num}`)];
      });

      resolve(Markup.inlineKeyboard(kb));
    });
  });
}

# 🚀 START
bot.command('start', async (ctx) => {
  init();

  const msg = await ctx.reply('🎱 BINGO RAILWAY PRO', await getBoard());

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

# 🎯 TOMAR NÚMERO
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = Number(ctx.match[1]);

  db.get(`SELECT * FROM numbers WHERE num=?`, [num], (err, row) => {

    if (row.state !== 'free') {
      return ctx.answerCbQuery('❌ ocupado');
    }

    db.run(
      `UPDATE numbers SET state='reserved', user=?, expiresAt=? WHERE num=?`,
      [
        ctx.from.username || ctx.from.first_name,
        Date.now() + TIME * 1000,
        num
      ]
    );

    ctx.reply(
`📩 Pago requerido

⏱ 10 minutos para pagar

💳 Nequi: 3123902322`
    );

    updateBoard();
    ctx.answerCbQuery('✔ tomado');
  });
});

# 🔥 TIMER GLOBAL (SIN BUGS)
setInterval(() => {

  db.all(`SELECT * FROM numbers WHERE state='reserved'`, [], (err, rows) => {

    rows.forEach(n => {
      if (n.expiresAt < Date.now()) {

        db.run(
          `UPDATE numbers SET state='free', user=NULL, expiresAt=NULL WHERE num=?`,
          [n.num]
        );

        bot.telegram.sendMessage(
          board.chatId,
          `⏰ @${n.user} no pagó. Número ${n.num} liberado`
        );
      }
    });

    if (rows.length > 0) updateBoard();

  });

}, 5000);

# 🔄 UPDATE TABLERO
async function updateBoard() {
  if (!board) return;

  const keyboard = await getBoard();

  try {
    await bot.telegram.editMessageReplyMarkup(
      board.chatId,
      board.messageId,
      null,
      keyboard.reply_markup
    );
  } catch {}
}

bot.launch();

console.log('🎱 RAILWAY BINGO ONLINE');