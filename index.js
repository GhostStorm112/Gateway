require('bluebird')
require('dotenv').config()

const GhostCore = require('Core')
const CloudStorm = require('Cloudstorm')
const amqp = require('amqplib')
const log = new GhostCore.Logger()
const args = GhostCore.Utils.ParseArgs()

const bot = new CloudStorm(process.env.TOKEN, {
  initialPresence: {
    status: 'online',
    game: { name: 'the weather', type: 3 } // Watching the weather
  },
  firstShardId: args.firstShard || 0,
  lastShardId: args.lastShard || (args.numShards ? args.numShards - 1 : 0),
  shardAmount: args.numShards || (args.firstShard && args.lastShard ? args.lastShard - args.firstShard + 1 : 1)
})

async function run () {
  log.info('Gateway', 'Starting gateway')
  const connection = await amqp.connect(process.env.AMQP_URL || 'amqp://localhost')
  const channel = await connection.createChannel()

  await bot.connect()

  bot.on('error', error => log.error('Gateway', error))
  bot.on('ready', () => log.info('Gateway', 'Connected to gateway'))
  bot.on('shardReady', event => log.info('Gateway', 'Shard: ' + event.id + ' joined the hive'))

  // Send events to cache worker
  channel.assertQueue('weather-pre-cache', { durable: false, autoDelete: true })
  bot.on('event', event => channel.sendToQueue('weather-pre-cache', Buffer.from(JSON.stringify(event))))
  bot.on('event', event => log.info('GatewayEvent', event.t))
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

function processRequest (event) {
  switch (event.t) {
    case 'STATUS_UPDATE':
      bot.statusUpdate(Object.assign({ status: 'online' }, event.d))
      break
    case 'VOICE_STATE_UPDATE':
      bot.voiceStateUpdate(0, event.d)
      break
    case 'RSHARDS':
      rshards()
      break
    default:
      break
  }

  return null
}

run().catch(error => log.error('STARTUP\n', error))
