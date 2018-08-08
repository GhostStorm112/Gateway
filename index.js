require('bluebird')
require('dotenv').config()
const GhostGateway = require('ghost-gateway')
const path = require('path')
const gateway = new GhostGateway({
  amqpUrl: process.env.AMQP_URL,
  redisUrl: process.env.REDIS_URL,
  token: process.env.TOKEN,
  botId: process.env.BOT_ID,
  lavalinkPassword: process.env.LAVALINK_PASSWORD,
  lavalinkRest: process.env.LAVALINK_REST,
  lavalinkWs: process.env.LAVALINK_WS,
  statsHost: process.env.STATS_HOST,
  statsPort: process.env.STATS_PORT,
  statsPrefix: process.env.STATS_PREFIX,
  firstShard: 0,
  lastShard: 0,
  numShards: 1,
  eventPath: path.join(__dirname, './requestHandlers/')
})
async function run () {
  gateway.log.mode = 1

  gateway.log.info('Gateway', 'Starting gateway')

  await gateway.initialize()
  gateway.on('error', error => gateway.log.error('ERROR', error))
  gateway.bot.on('error', error => gateway.log.error('ERROR', error))

  gateway.bot.on('ready', async () => {
    gateway.log.info('Gateway', 'Connected to Discord gateway')
  })

  gateway.bot.on('shardReady', event => {
    gateway.bot.shardStatusUpdate(event.id, {status: 'online', game: {name: `Shard: ${event.id} || ==help`, type: 0}})
    gateway.log.info('Gateway', 'Shard: ' + event.id + ' joined the hive')
    gateway.log.debug('Gateway', `Starting recover for ${event.id}`)
    gateway.workerConnector.sendToQueue({
      t: 'LAVALINK_RECOVER',
      d: {
        shard_amount: 2,
        shard: event.id
      }
    })
  })

  gateway.bot.on('disconnected', () => { gateway.log.info('Gateway', 'All shards disconnected succesfully') })

  gateway.bot.on('event', event => {
    gateway.stats.increment('discordevent', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (err) => {
      if (err) {
        console.log(err)
      }
    })
    if (event.t !== 'PRESENCE_UPDATE') {
      gateway.stats.increment('discordevent.np', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (err) => {
        if (err) {
          console.log(err)
        }
      })
    }
    switch (event.t) {
      case 'VOICE_SERVER_UPDATE':
        gateway.lavalink.voiceServerUpdate(event.d)
        break
      case 'VOICE_STATE_UPDATE':
        gateway.cache.actions.voiceStates.upsert(event.d)
        gateway.lavalink.voiceStateUpdate(event.d)
        break
    }
    if (event.t !== 'PRESENCE_UPDATE') {
      gateway.log.debug('EVENT', event.t)
      gateway.workerConnector.sendToQueue(event)
    }
  })
}
run().catch(error => console.log(error))
