require('bluebird')
require('dotenv').config()

const GhostCore = require('Core')
const CloudStorm = require('Cloudstorm')
const { default: Cache } = require('@spectacles/cache')
const amqp = require('amqplib')
const Lavalink = require('./Lavalink')
const log = new GhostCore.Logger()

const args = GhostCore.Utils.ParseArgs()

const bot = new CloudStorm(process.env.TOKEN, {
  initialPresence: {
    status: 'online',
    game: { name: process.env.GAME, type: 3 } // Watching the weather
  },
  firstShardId: args.firstShard || 0,
  lastShardId: args.lastShard || (args.numShards ? args.numShards - 1 : 0),
  shardAmount: args.numShards || (args.firstShard && args.lastShard ? args.lastShard - args.firstShard + 1 : 1)
})

async function run () {
  this.redis = new Cache({
    host: process.env.REDIS_URL || 'redis',
    db: 2
  })
  log.info('Gateway', 'Starting gateway')
  const connection = await amqp.connect(process.env.AMQP_URL || 'amqp://localhost')
  const channel = await connection.createChannel()
  this.lavalink = await new Lavalink({
    user: process.env.USERID || '326603853736837121',
    password: process.env.LAVALINK_PASSWORD,
    rest: process.env.LAVALINK_REST,
    ws: process.env.LAVALINK_WS,
    redis: await this.redis,
    gateway: await channel
  })
  this.voiceSessions = new Map()

  await bot.connect()

  bot.on('voiceStateUpdate', message => this.lavalink.voiceStateUpdate(message))
  bot.on('error', error => console.log(error))
  bot.on('ready', () => {
    log.info('Gateway', 'Connected to gateway')
    this.lavalink.recover()
  })
  bot.on('shardReady', event => log.info('Gateway', 'Shard: ' + event.id + ' joined the hive'))

  // Send events to cache worker
  channel.assertQueue('weather-pre-cache', { durable: false, autoDelete: true })

  bot.on('event', event => {
    channel.sendToQueue('weather-pre-cache', Buffer.from(JSON.stringify(event)))
    if (event.t === 'VOICE_SERVER_UPDATE') {
      console.log('VOICE_SERVER_UPDATE')
      this.lavalink.voiceServerUpdate(event.d)
    }
    if (event.t === 'VOICE_STATE_UPDATE') {
      console.log('VOICE_STATE_UPDATE')
      gvsu(event)
      this.lavalink.voiceStateUpdate(event.d)
    }
  })

  // bot.on('event', event => log.info('GatewayEvent', event.t))

  // Receive requests from bot
  channel.assertQueue('weather-gateway-requests', { durable: false, autoDelete: true })
  channel.consume('weather-gateway-requests', event => {
    return processRequest(JSON.parse(event.content.toString()))
  })
}

async function rshards () {
  log.info('rshards', 'Restarting all shards')
  bot.disconnect()
}
async function gvsu (packet) {
  const queue = this.lavalink.queues.get(packet.d.guild_id)
  await queue.player.join(packet.d.channel_id)
  queue.player.on('event', d => console.log(d))
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
  var queue
  var songs
  switch (event.t) {
    case 'STATUS_UPDATE':
      bot.statusUpdate(Object.assign({ status: 'online' }, event.d))
      break
    case 'VOICE_STATE_UPDATE':
      bot.voiceStateUpdate(0, event.d)
      break
    case 'LPLAY':
      queue = await this.lavalink.queues.get(event.d.guild_id)
      songs = await this.lavalink.load(`ytsearch:${event.d.song}`)
      await queue.add(songs[0].track)
      if (!queue.player.playing && !queue.player.paused) await queue.start()
      break
    case 'LSTOP':
      this.lavalink.stop(event.d.guild_id)
      break
    case 'LPAUSE':
      queue = this.lavalink.queues.get(event.d.guild_id)
      await queue.player.pause()
      break
    case 'LSKIP':
      this.lavalink.skip(event.d.guild_id)
      break
    case 'LRESUME':
      queue = this.lavalink.queues.get(event.d.guild_id)
      await queue.player.pause(false)
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

run().catch(error => console.log(error))
