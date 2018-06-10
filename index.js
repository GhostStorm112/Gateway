require('bluebird')
require('dotenv').config()

const GhostCore = require('Core')
const CloudStorm = require('Cloudstorm')
const { default: Cache } = require('@spectacles/cache')
const amqp = require('amqplib')
const express = require('express')
const bodyParser = require('body-parser')
const args = GhostCore.Utils.ParseArgs()
const shardRouter = require('./routes/shardStatusRoutes')
const gatewayRouter = require('./routes/gatewayRoutes')
const app = express()
let StatsD
let statsClient
const log = new GhostCore.Logger()
const bot = new CloudStorm(process.env.TOKEN, {
  firstShardId: args.firstShard || 0,
  lastShardId: args.lastShard || (args.numShards ? args.numShards - 1 : 0),
  shardAmount: args.numShards || (args.firstShard && args.lastShard ? args.lastShard - args.firstShard + 1 : 1)
})

const version = require('./package.json').version

// Setup StatsD

try {
  StatsD = require('hot-shots')
} catch (e) {

}
if (process.env.STATSD) {
  statsClient = new StatsD({
    host: process.env.STATSD_HOST,
    port: process.env.STATSD_PORT,
    prefix: process.env.STATSDGs_PREFIX,
    telegraf: true
  })
}

// Setup REST
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())
app.use((req, res, next) => {
  req.bot = bot
  next()
})
app.use('/shards', shardRouter)
app.use('/gateway', gatewayRouter)
app.all('/', (req, res) => {
  res.json({version: version, gatewayVersion: bot.version})
})
app.listen(process.env.GW_PORT, process.env.GW_HOST)

async function run () {
  log.info('Gateway', 'Starting gateway')
  // Setup redis cache
  this.redis = new Cache({
    port: 6379,
    host: process.env.REDIS_URL,
    db: 2
  })
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
    setInterval(() => {
      channel.sendToQueue('weather-pre-cache', Buffer.from(JSON.stringify({t: 'dblu'})))
    }, 1800000)
  })
  bot.on('shardReady', event => {
    bot.shardStatusUpdate(event.id, {status: 'online', game: {name: `Shard: ${event.id} || ==help`, type: 0}})
    log.info('Gateway', 'Shard: ' + event.id + ' joined the hive')
  })

  // Send events to cache worker
  channel.assertQueue('weather-pre-cache', { durable: false, autoDelete: true })

  bot.on('event', event => {
    if (statsClient) {
      statsClient.increment('discordevent', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (err) => {
        if (err) {
          console.log(err)
        }
      })
      if (event.t !== 'PRESENCE_UPDATE') {
        statsClient.increment('discordevent.np', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (err) => {
          if (err) {
            console.log(err)
          }
        })
      }
    }
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
