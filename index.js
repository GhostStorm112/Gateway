require('bluebird')
require('dotenv').config()

const { default: Cache } = require('@spectacles/cache')
const amqp = require('amqplib')
const GhostCore = require('Core')
const args = GhostCore.Utils.ParseArgs()
const bodyParser = require('body-parser')
const CloudStorm = require('Cloudstorm')
const Eventemitter = require('eventemitter3')
const express = require('express')
const app = express()
const promisifyAll = require('tsubaki').promisifyAll
const fs = promisifyAll(require('fs'))
const gatewayRouter = require('./routes/gatewayRoutes')
const path = require('path')
const shardRouter = require('./routes/shardStatusRoutes')
const StatsD = require('hot-shots')

const EE = new Eventemitter()
const log = new GhostCore.Logger()
const bot = new CloudStorm(process.env.TOKEN, {
  firstShardId: args.firstShard || 0,
  lastShardId: args.lastShard || (args.numShards ? args.numShards - 1 : 0),
  shardAmount: args.numShards || (args.firstShard && args.lastShard ? args.lastShard - args.firstShard + 1 : 1)
})

const version = require('./package.json').version
let statsClient
// Setup StatsD
if (process.env.STATSD) {
  statsClient = new StatsD({
    host: process.env.STATSD_HOST,
    port: process.env.STATSD_PORT,
    prefix: process.env.STATSDC_PREFIX,
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

  this.options = Object.assign({
    disabledEvents: null,
    camelCaseEvents: false,
    eventPath: path.join(__dirname, './eventHandlers/')
  })

  // Setup lavalink music client
  this.lavalink = await new GhostCore.LavalinkGatway({
    user: process.env.BOT_ID,
    password: process.env.LAVALINK_PASSWORD,
    rest: process.env.LAVALINK_REST,
    ws: process.env.LAVALINK_WS,
    redis: this.redis,
    gateway: await channel
  })
  this.eventHandlers = new Map()
  this.bot = bot
  await loadRequestHandlers()
  await bot.connect()
  bot.on('error', error => log.error('ERROR', error))
  bot.on('ready', async () => {
    log.info('Gateway', 'Connected to Discord gateway')
    this.lavalink.recover(args.numShards || 0)

    setInterval(() => {
      channel.sendToQueue('weather-pre-cache', Buffer.from(JSON.stringify({t: 'dblu'})))
    }, 1800000)
  })
  bot.on('shardReady', event => {
    bot.shardStatusUpdate(event.id, {status: 'online', game: {name: `Shard: ${event.id} || ==help`, type: 0}})
    log.info('Gateway', 'Shard: ' + event.id + ' joined the hive')
  })
  bot.on('disconnected', () => { log.info('Gateway', 'All shards disconnected succesfully') })
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
    // Receive request from Discord
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
    EE.emit(devent.t, devent.d)
  })
}

async function loadRequestHandlers () {
  const files = await fs.readdirAsync('./requestHandlers')

  for (const file of files) {
    if (!file.endsWith('.js') || file.includes(' ')) { continue }

    const handler = new (require('./requestHandlers/' + file))(this)
    this.eventHandlers.set(handler.name, handler)

    if (typeof handler.init === 'function') { await handler.init() }

    for (const event of handler.canHandle) {
      EE.on(event, handler.handle.bind(handler))
    }
  }
}

run().catch(error => console.log(error))
