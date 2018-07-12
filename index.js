require('bluebird')
require('dotenv').config()
const GhostGateway = require('../libs/ghost-gateway')
const amqp = require('amqplib')
const GhostCore = require('ghost-core')
const args = GhostCore.Utils.ParseArgs()
const CloudStorm = require('Cloudstorm')
const Eventemitter = require('eventemitter3')
const promisifyAll = require('tsubaki').promisifyAll
const fs = promisifyAll(require('fs'))
const path = require('path')

const EE = new Eventemitter()
const bot = new CloudStorm(process.env.TOKEN, {
  firstShardId: args.firstShard || 0,
  lastShardId: args.lastShard || (args.numShards ? args.numShards - 1 : 0),
  shardAmount: args.numShards || (args.firstShard && args.lastShard ? args.lastShard - args.firstShard + 1 : 1)
})

// Setup REST

async function run () {
  const connection = await amqp.connect(process.env.AMQP_URL || 'amqp://localhost')
  const channel = await connection.createChannel()
  this.gateway = new GhostGateway({channel: channel})

  this.gateway.log.info('Gateway', 'Starting gateway')

  this.options = Object.assign({
    disabledEvents: null,
    camelCaseEvents: false,
    eventPath: path.join(__dirname, './eventHandlers/')
  })

  this.eventHandlers = new Map()
  this.bot = bot

  await loadRequestHandlers()
  await bot.connect()
  bot.on('error', error => this.gateway.log.error('ERROR', error))
  bot.on('ready', async () => {
    this.gateway.log.info('Gateway', 'Connected to Discord gateway')
    this.gateway.lavalink.recover(args.numShards || 0)

    /* setInterval(() => {
      channel.sendToQueue('weather-pre-cache', Buffer.from(JSON.stringify({t: 'dblu'})))
    }, 1800000) */
  })
  bot.on('shardReady', event => {
    bot.shardStatusUpdate(event.id, {status: 'online', game: {name: `Shard: ${event.id} || ==help`, type: 0}})
    this.gateway.log.info('Gateway', 'Shard: ' + event.id + ' joined the hive')
  })
  bot.on('disconnected', () => { this.gateway.log.info('Gateway', 'All shards disconnected succesfully') })
  // Send events to cache worker
  channel.assertQueue('weather-events', { durable: false, messageTtl: 60e3 })

  bot.on('event', event => {
    this.gateway.stats.increment('discordevent', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (err) => {
      if (err) {
        console.log(err)
      }
    })
    if (event.t !== 'PRESENCE_UPDATE') {
      this.gateway.stats.increment('discordevent.np', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (err) => {
        if (err) {
          console.log(err)
        }
      })
    }

    // Receive request from Discord
    channel.sendToQueue('weather-events', Buffer.from(JSON.stringify(event)))
    if (event.t === 'VOICE_SERVER_UPDATE') {
      this.gateway.lavalink.voiceServerUpdate(event.d)
    }
    if (event.t === 'VOICE_STATE_UPDATE') {
      console.log(event.d)
      this.gateway.cache.actions.voiceStates.upsert(event.d)
      this.gateway.lavalink.voiceStateUpdate(event.d)
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
