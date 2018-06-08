require('bluebird')
require('dotenv').config()

const GhostCore = require('Core')
const CloudStorm = require('Cloudstorm')
const { default: Cache } = require('@spectacles/cache')
const amqp = require('amqplib')
const log = new GhostCore.Logger()
const args = GhostCore.Utils.ParseArgs()
const bot = new CloudStorm(process.env.TOKEN, {
  firstShardId: args.firstShard || 0,
  lastShardId: args.lastShard || (args.numShards ? args.numShards - 1 : 0),
  shardAmount: args.numShards || (args.firstShard && args.lastShard ? args.lastShard - args.firstShard + 1 : 1)
})

const DBL = require('dblapi.js')
const dbl = new DBL(process.env.DB_TOKEN)
async function run () {
  // Setup redis cache
  this.redis = new Cache({
    port: 6379,
    host: process.env.REDIS_URL,
    db: 2
  })
  log.info('Gateway', 'Starting gateway')
  const connection = await amqp.connect(process.env.AMQP_URL || 'amqp://localhost')
  const channel = await connection.createChannel()

  // Setup lavalink music client
  this.lavalink = await new GhostCore.LavalinkGatway({
    user: process.env.USERID || '326603853736837121',
    password: process.env.LAVALINK_PASSWORD,
    rest: process.env.LAVALINK_REST,
    ws: process.env.LAVALINK_WS,
    redis: this.redis,
    gateway: await channel
  })

  await bot.connect()

  bot.on('error', error => log.error('ERROR', error))
  bot.on('ready', () => {
    log.info('Gateway', 'Connected to gateway')
    this.lavalink.recover()
  })
  bot.on('shardReady', event => {
    bot.shardStatusUpdate(event.id, {status: 'online', game: {name: `Shard: ${event.id} || ==help`, type: 0}})
    log.info('Gateway', 'Shard: ' + event.id + ' joined the hive')
  })

  // Send events to cache worker
  channel.assertQueue('weather-pre-cache', { durable: false, autoDelete: true })

  bot.on('event', event => {
    // const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    channel.sendToQueue('weather-pre-cache', Buffer.from(JSON.stringify(event)))
    if (event.t === 'VOICE_SERVER_UPDATE') {
      this.lavalink.voiceServerUpdate(event.d)
    }
    if (event.t === 'VOICE_STATE_UPDATE') {
      this.lavalink.voiceStateUpdate(event.d)
    }
  })

  // Receive requests from bot
  channel.assertQueue('weather-gateway-requests', { durable: false, autoDelete: true })
  channel.consume('weather-gateway-requests', event => {
    const devent = JSON.parse(event.content.toString())
    if (devent.t === 'LAVALINK') {
      return processMusicRequest(devent)
    } else {
      return processRequest(devent)
    }
  })
}

async function rshards () {
  log.info('rshards', 'Restarting all shards')
  bot.disconnect()
}
// Cache players
async function gvsu (packet) {
  const queue = this.lavalink.queues.get(packet.d.guild_id)

  await queue.player.join(packet.d.channel_id)
  queue.player.on('error', console.error)

  const players = await this.redis.storage.get('players', { type: 'arr' })
  let index

  if (Array.isArray(players)) index = players.findIndex(player => player.guild_id === packet.d.guild_id)
  if (((!players && !index) || index < 0) && packet.d.channel_id) {
    await this.redis.storage.upsert('players', [{ guild_id: packet.d.guild_id, channel_id: packet.d.channel_id }])
  } else if (players && typeof index !== 'undefined' && index >= 0 && !packet.d.channel_id) {
    players.splice(index, 1)
    if (players.length === 0) await this.redis.storage.delete('players')
    else await this.redis.storage.set('players', players)
    queue.player.removeAllListeners()
  }
}
async function processRequest (event) {
  switch (event.t) {
    case 'STATUS_UPDATE':
      bot.statusUpdate(Object.assign({ status: 'online' }, event.d))
      break
    case 'VOICE_STATE_UPDATE':
      gvsu(event)
      this.lavalink.voiceStateUpdate(event.d)
      bot.voiceStateUpdate(event.d.shard_id || 0, event.d)
      break
    case 'LCQUEUE':
      break
    case 'RSHARDS':
      rshards()
      break
    default:
      break
  }

  return null
}

async function processMusicRequest (event) {
  let queue = await this.lavalink.queues.get(event.d.guild_id)
  switch (event.d.action) {
    case 'PLAY':
      await queue.add(event.d.song)
      if (!queue.player.playing && !queue.player.paused) await queue.start()
      break
    case 'STOP':
      queue.stop()
      break
    case 'PAUSE':
      await queue.player.pause()
      break
    case 'SKIP':
      queue.next()
      break
    case 'RESUME':
      await queue.player.pause(false)
      break
    case 'LEAVE':
      await queue.stop()
      bot.voiceStateUpdate(event.d.shard_id || 0, {
        guild_id: event.d.guild_id,
        channel_id: null,
        self_mute: false,
        self_deaf: false
      })
      break
  }
}

run().catch(error => console.log(error))
